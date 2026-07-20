import 'server-only'
import { prisma } from '@/lib/prisma'
import { getIfsConfig } from '@/lib/ifs/config'
import { getIfsAccessToken } from '@/lib/ifs/token'
import {
  startsWithKod, kodCikar, sifirsiz, makineDegil, adCikar,
  type IfsResource,
} from '@/lib/ipro/tezgah-esleme'

export { startsWithKod, kodCikar, sifirsiz, makineDegil, adCikar } from '@/lib/ipro/tezgah-esleme'
export type { IfsResource } from '@/lib/ipro/tezgah-esleme'

/**
 * IFS → ILERIHub tezgah senkronu — ORTAK MANTIK.
 *
 * YÖN: IFS güncel ve doğru kaynak, MAS eski (19.07.2026 kararı). Bu modül hem
 * cron endpoint'i hem elle koşulan script tarafından kullanılır; eşleştirme
 * mantığı tek yerde durur.
 *
 * Yaptığı: yeni makine EKLE + mevcutta ad/WC değişmişse GÜNCELLE + backfill
 * (boş IFS alanlarını doldur). PASİFLEME YOK — aşama 2 kararı ayrı; IFS kaynak
 * listesinde karşılığı olmayan tezgahlar bu modülde ELE ALINMAZ.
 *
 * Kaynak: WorkCenterHandling.svc/Reference_WorkCenterResource.
 */

export type TezgahSyncSonuc = {
  taranan: number // IFS makine kaynağı sayısı (planlama WC + fason hariç)
  eklenen: number
  guncellenen: number // ad/WC değişikliği + backfill birlikte
  atlanan: number // IFS ile birebir aynı, değişiklik yok
  hatalilar: Array<{ kod: string; detay: string }>
}

// ── IFS okuma (config/token lib'i üzerinden — cron için) ─────────────────

/** WorkCenterHandling /main gateway kökü. config.baseUrl /int'te. */
function workCenterRoot(): string {
  const { baseUrl } = getIfsConfig()
  return baseUrl.replace(/[A-Za-z]+\.svc\/?$/, '').replace('/int/', '/main/')
}

/** IFS makine kaynaklarını çeker (planlama WC + fason DAHİL — filtre çağırana). */
export async function ifsResourcesFetch(): Promise<IfsResource[]> {
  const { contract } = getIfsConfig()
  const token = await getIfsAccessToken()
  const url =
    `${workCenterRoot()}WorkCenterHandling.svc/Reference_WorkCenterResource` +
    `?$filter=${encodeURIComponent(`Contract eq '${contract}'`)}&$top=1000`
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (r.status !== 200) throw new Error(`Reference_WorkCenterResource HTTP ${r.status}`)
  const v = ((await r.json()) as { value?: Record<string, unknown>[] }).value ?? []
  return v
    .map((x) => ({
      rid: String(x.ResourceId ?? '').trim(),
      wc: String(x.WorkCenterNo ?? '').trim(),
      desc: String(x.Description ?? '').trim(),
    }))
    .filter((x) => x.rid)
}

// ── Senkron çekirdeği ────────────────────────────────────────────────────

/**
 * Çekirdek: IFS kaynak listesini alıp ILERIHub tezgahlarını hizalar.
 *
 * @param resources IFS kaynakları (test için enjekte edilebilir; verilmezse
 *   canlı IFS'ten çekilir). PASİFLEME YAPMAZ.
 */
export async function tezgahSenkronu(resources?: IfsResource[]): Promise<TezgahSyncSonuc> {
  const sonuc: TezgahSyncSonuc = { taranan: 0, eklenen: 0, guncellenen: 0, atlanan: 0, hatalilar: [] }

  const ifsHepsi = resources ?? (await ifsResourcesFetch())
  const makineler = ifsHepsi.filter((r) => !makineDegil(r))
  sonuc.taranan = makineler.length

  const tezgahlar = await prisma.iproTezgah.findMany({
    select: { id: true, kod: true, ad: true, ifsResourceId: true, ifsWorkCenterNo: true },
    orderBy: { kod: 'asc' },
  })
  const kods = tezgahlar.map((t) => t.kod)
  const kodSet = new Set(kods)
  const byKod = new Map(tezgahlar.map((t) => [t.kod, t]))
  // ifsResourceId → tezgah. Kodsuz IFS kaynağı (desc'te kod deseni yok, kod =
  // ResourceId olarak eklenmiş) kod-önekle bulunamaz; ResourceId ile bulunur.
  const byRid = new Map(tezgahlar.filter((t) => t.ifsResourceId).map((t) => [t.ifsResourceId!, t]))

  for (const r of makineler) {
    try {
      // 0) ifsResourceId ile mevcut kayıt — kodsuz kaynağın idempotent yolu.
      //    Bu ResourceId zaten bir tezgahtaysa kod eşleştirme DENENMEZ; yalnız
      //    ad/WC değişikliği güncellenir. (10101 "Lazer Kesim" gibi kodsuzlar
      //    aksi halde her koşuda yeniden eklenmeye çalışılıp unique hata verir.)
      const ridEsl = byRid.get(r.rid)
      if (ridEsl) {
        const yeniAd = adCikar(r.desc)
        const data: { ad?: string; ifsWorkCenterNo?: string | null } = {}
        if (kodCikar(r.desc) && ridEsl.ad !== yeniAd) data.ad = yeniAd
        if (ridEsl.ifsWorkCenterNo !== (r.wc || null)) data.ifsWorkCenterNo = r.wc || null
        if (Object.keys(data).length) {
          await prisma.iproTezgah.update({ where: { id: ridEsl.id }, data })
          sonuc.guncellenen++
        } else {
          sonuc.atlanan++
        }
        continue
      }

      // 1) Kod-önek eşleşmesi (en uzun kazanır)
      const adaylar = kods.filter((k) => startsWithKod(r.desc, k))
      if (adaylar.length) {
        const kod = adaylar.reduce((a, b) => (b.length > a.length ? b : a))
        const t = byKod.get(kod)!
        const yeniAd = adCikar(r.desc)
        const data: { ad?: string; ifsResourceId?: string; ifsWorkCenterNo?: string | null } = {}
        // Ad IFS'ten güncellenir YALNIZ kod deseni varsa (aksi halde desc = tam ad, üzerine yazma).
        if (kodCikar(r.desc) && t.ad !== yeniAd) data.ad = yeniAd
        if (t.ifsResourceId !== r.rid) data.ifsResourceId = r.rid
        if (t.ifsWorkCenterNo !== (r.wc || null)) data.ifsWorkCenterNo = r.wc || null
        if (Object.keys(data).length) {
          await prisma.iproTezgah.update({ where: { id: t.id }, data })
          sonuc.guncellenen++
        } else {
          sonuc.atlanan++
        }
        continue
      }

      // 2) Sıfır-dolgu şüphelisi → mevcut kayda bağla
      const k = kodCikar(r.desc)
      const sade = k ? sifirsiz(k) : null
      if (sade && kodSet.has(sade)) {
        const t = byKod.get(sade)!
        const data: { ifsResourceId?: string; ifsWorkCenterNo?: string | null } = {}
        if (t.ifsResourceId !== r.rid) data.ifsResourceId = r.rid
        if (t.ifsWorkCenterNo !== (r.wc || null)) data.ifsWorkCenterNo = r.wc || null
        if (Object.keys(data).length) {
          await prisma.iproTezgah.update({ where: { id: t.id }, data })
          sonuc.guncellenen++
        } else {
          sonuc.atlanan++
        }
        continue
      }

      // 3) Yeni makine → ekle. Kod açıklamadan; yoksa ResourceId.
      const kod = k && !kodSet.has(k) ? k : r.rid
      const yeni = await prisma.iproTezgah.create({
        data: { kod, ad: adCikar(r.desc), ifsResourceId: r.rid, ifsWorkCenterNo: r.wc || null, aktif: true },
        select: { id: true, kod: true },
      })
      // Yeni kaydı canlı haritaya ekle — aynı koşuda ikinci referans çakışmasın.
      const yeniKayit = { id: yeni.id, kod: yeni.kod, ad: adCikar(r.desc), ifsResourceId: r.rid, ifsWorkCenterNo: r.wc || null }
      byKod.set(yeni.kod, yeniKayit)
      byRid.set(r.rid, yeniKayit)
      kodSet.add(yeni.kod)
      kods.push(yeni.kod)
      sonuc.eklenen++
    } catch (e) {
      const detay = e instanceof Error ? e.message : String(e)
      sonuc.hatalilar.push({ kod: r.rid, detay })
    }
  }

  return sonuc
}
