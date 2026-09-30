import 'server-only'
import { prisma } from '@/lib/prisma'
import { getIfsConfig } from '@/lib/ifs/config'
import { getRaftakiStok, moveStok, type StokKimlik } from '@/lib/ifs/depo-stok'
import { iptalEt as topluIptal, satirSil as topluSatirSil, type TasimaStokSatiri } from '@/lib/ifs/toplu-tasima'
import { paleteEkle, palettenCikar, paletDegistir, paletTasi, type HuStokSatiri } from '@/lib/ifs/tasima-birimi'
import { stokKaldir, talepGetir as transferTalepGetir } from '@/lib/ifs/transfer-talebi'
import { satirCikar as mtSatirCikar } from '@/lib/ifs/malzeme-talebi'
import { sevkiyatGetir, toplamaGeriAl } from '@/lib/ifs/sevkiyat'
import { geriAlindiDus, okutmaSil } from '@/lib/depo/sevkiyat-okutma'
import { getSatirCikis, unissueSatir } from '@/lib/ifs/tuketim'
import { dostaneIfsHata } from '@/lib/ifs/ifs-hata'
import { sayilanYaz } from '@/lib/ifs/sayim'
import { rezerveMesaji } from '@/lib/depo/miktar'
import { olayAdi } from '@/lib/depo/olay-adlari'

/**
 * Depo "Son İşlemlerim" — operatörün kendi hareketini geri alması (Hub'ın mevcut ters işlemleri + Faz 2:
 * Malzeme Toplama çıkışı → ShopOrderHandling UnissueMaterial, yalnız satırın çıkılanı = kayıttaki miktar iken).
 *
 * Kurallar: yalnız kendi işlemi · işlemden sonra en fazla GERI_AL_SAAT saat · bir işlem yalnız BİR kez
 * (DepoHareketLog.geriAlinanId @unique; GERI_AL satırı IFS'ten ÖNCE yazılır, hata olursa silinir → yarışta da tek) ·
 * geri almanın geri alması yok · ters işlemden önce güncel stok/durum kontrolü (IFS'e gitmeden açık mesaj).
 * TRANSFER_TALEBI_TRANSFER geri alınamaz: CancelTransfer IFS özelleştirmesiyle reddediliyor (ORA-20100, ters kayıt ister).
 */

export const GERI_AL_SAAT = 12

export type GeriAlDurum = { uygun: true } | { uygun: false; neden: string }

/** Geri alınamayan olaylar ve nedeni (ekranda gösterilir). */
const ALINAMAZ: Record<string, string> = {
  ETIKET_BASMA: 'Etiket basımı geri alınamaz (IFS barkodları kalıcı)',
  HU_ETIKET: 'Etiket basımı geri alınamaz',
  HU_OLUSTUR: 'Palet silinemez — boş palet IFS\'te kalır',
  MALZEME_TALEBI_OLUSTUR: 'Talep silinemez — ofis kapatır',
  MALZEME_TALEBI_CIKAR: 'Yeniden ekleyin (Malzeme Talebi ekranı)',
  MALZEME_TALEBI_TUKET: 'Tüketim terminalden geri alınamaz — ofise bildirin',
  TOPLU_TASIMA_SIL: 'Satırı yeniden ekleyin (Toplu Taşıma ekranı)',
  TOPLU_TASIMA_IPTAL: 'İptal edilen fiş geri açılamaz',
  TRANSFER_TALEBI_KALDIR: 'Stoğu yeniden bağlayın (Transfer Talebi ekranı)',
  SEVKIYAT_HAZIRLA: 'Sevkiyat hazırlığı terminalden geri alınmaz',
  SEVKIYAT_SIL: 'Yeniden okutun (Sevkiyat ekranı)',
  SEVKIYAT_GERIAL: 'Yeniden toplayın (Sevkiyat ekranı)',
  TRANSFER_TALEBI_TRANSFER: 'Transfer iptal edilemez (IFS ters kayıt ister) — ofise bildirin',
  GERI_AL: 'Geri alma işlemi geri alınamaz',
}

type LogSatiri = {
  id: string
  olay: string
  userId: string
  partNo: string
  lotBatchNo: string | null
  miktar: unknown
  kaynakLok: string | null
  hedefLok: string | null
  orderNo: string | null
  releaseNo: string | null
  sequenceNo: string | null
  lineItemNo: number | null
  detay: unknown
  createdAt: Date
}
type Detay = Record<string, unknown>
const det = (l: LogSatiri): Detay => (l.detay && typeof l.detay === 'object' ? (l.detay as Detay) : {})
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const nz = (v: unknown) => { const s = v == null ? '' : String(v).trim(); return s || '*' }

/** Kayda özgü (IFS'siz) uygunluk: olay türü, süre, sahiplik, veri yeterliliği. Geri alınmış mı ayrıca kontrol edilir. */
export function geriAlUygunlugu(l: LogSatiri, userId: string, simdi = new Date()): GeriAlDurum {
  if (l.userId !== userId) return { uygun: false, neden: 'Yalnız kendi işleminizi geri alabilirsiniz' }
  if (ALINAMAZ[l.olay]) return { uygun: false, neden: ALINAMAZ[l.olay] }
  if (simdi.getTime() - l.createdAt.getTime() > GERI_AL_SAAT * 3600_000) return { uygun: false, neden: `${GERI_AL_SAAT} saatten eski — ofise bildirin` }
  const d = det(l)
  switch (l.olay) {
    case 'STOK_TASIMA':
    case 'TOPLU_TASIMA_TRANSFER':
      return l.kaynakLok && l.hedefLok && num(l.miktar) > 0 ? { uygun: true } : { uygun: false, neden: 'Kayıtta lokasyon/miktar eksik' }
    case 'TOPLU_TASIMA_EKLE':
      return d.stok && l.orderNo ? { uygun: true } : { uygun: false, neden: 'Kayıtta satır kimliği yok' }
    case 'TOPLU_TASIMA_OLUSTUR':
      return l.orderNo ? { uygun: true } : { uygun: false, neden: 'Kayıtta fiş no yok' }
    case 'HU_EKLE':
    case 'HU_CIKAR':
      return d.stok && d.handlingUnitId ? { uygun: true } : { uygun: false, neden: 'Kayıtta palet/stok kimliği yok' }
    case 'HU_DEGISTIR':
      return d.stok && d.handlingUnitId && d.hedefHandlingUnitId ? { uygun: true } : { uygun: false, neden: 'Kayıtta palet kimliği yok' }
    case 'HU_TASI':
      return d.handlingUnitId && l.kaynakLok ? { uygun: true } : { uygun: false, neden: 'Paletin önceki lokasyonu bilinmiyor' }
    case 'TRANSFER_TALEBI_BAGLA':
      return d.stok && l.orderNo ? { uygun: true } : { uygun: false, neden: 'Kayıtta stok kimliği yok' }
    case 'MALZEME_TALEBI_REZERV':
      return l.orderNo && d.lineNo && l.releaseNo ? { uygun: true } : { uygun: false, neden: 'Kayıtta talep satırı yok' }
    case 'SEVKIYAT_OKUT':
      return d.okutmaId && l.orderNo ? { uygun: true } : { uygun: false, neden: 'Kayıtta okutma kimliği yok' }
    case 'SEVKIYAT_TOPLA':
      return l.orderNo && l.kaynakLok && l.hedefLok ? { uygun: true } : { uygun: false, neden: 'Kayıtta lokasyon eksik' }
    case 'TOPLAMA_CIKIS': {
      const kirilim = Array.isArray(d.kirilim) ? (d.kirilim as { locationNo?: string }[]) : []
      if (new Set(kirilim.map((k) => k.locationNo)).size > 1) return { uygun: false, neden: 'Birden çok raftan toplandı — ofise bildirin' }
      return l.orderNo && l.kaynakLok && l.lineItemNo != null && num(l.miktar) > 0
        ? { uygun: true }
        : { uygun: false, neden: 'Kayıtta iş emri satırı/raf eksik' }
    }
    case 'SAYIM_YAZ':
    case 'SAYIM_AYNI':
      return typeof d.onceki === 'number'
        ? { uygun: true }
        : { uygun: false, neden: 'İlk sayım — geri almak yerine yeniden sayın' }
    default:
      return { uygun: false, neden: 'Bu işlem türü geri alınamaz' }
  }
}

// ── Ters işlemler ────────────────────────────────────────────────────────────

/** Hedefteki satırı bulup kaynağa geri taşır (Stok Taşıma / Toplu Taşıma transfer). Rezerve koruması dahil. */
async function tersTasima(l: LogSatiri, anahtar: Partial<TasimaStokSatiri> | undefined): Promise<string> {
  const miktar = num(l.miktar)
  const kaynak = l.kaynakLok!, hedef = l.hedefLok!
  const hedeftekiler = (await getRaftakiStok(hedef)).filter((k) => k.kimlik.partNo === l.partNo)
  const eslesen = anahtar
    ? hedeftekiler.filter((k) =>
        k.kimlik.lotBatchNo === nz(anahtar.lotBatchNo) && k.kimlik.serialNo === nz(anahtar.serialNo) &&
        k.kimlik.engChgLevel === nz(anahtar.engChgLevel) && k.kimlik.waivDevRejNo === nz(anahtar.waivDevRejNo) &&
        k.kimlik.configurationId === nz(anahtar.configurationId) && k.kimlik.activitySeq === num(anahtar.activitySeq) &&
        k.kimlik.handlingUnitId === num(anahtar.handlingUnitId))
    : hedeftekiler.filter((k) => k.kimlik.lotBatchNo === nz(l.lotBatchNo) && k.kimlik.handlingUnitId === 0)
  if (!eslesen.length) throw new Error(`${l.partNo} artık ${hedef} lokasyonunda yok — geri alınamaz`)
  if (eslesen.length > 1) throw new Error(`${hedef} lokasyonunda ${l.partNo} için birden çok stok satırı — Stok Taşıma ekranından elle taşıyın`)
  const k = eslesen[0]
  if (miktar > k.miktar + 1e-9) throw new Error(`${hedef}: ${rezerveMesaji(k.miktar, k.rezerve)}`)
  const s = await moveStok(k.kimlik as StokKimlik, kaynak, miktar)
  if (!s.ok) throw new Error(s.error ?? 'IFS geri taşıma başarısız')
  return `${l.partNo} · ${miktar} ${hedef} → ${kaynak} geri taşındı`
}

async function tersIslem(l: LogSatiri): Promise<string> {
  const d = det(l)
  const miktar = num(l.miktar)
  switch (l.olay) {
    case 'STOK_TASIMA':
      return tersTasima(l, d.kimlik as Partial<TasimaStokSatiri> | undefined)
    case 'TOPLU_TASIMA_TRANSFER':
      return tersTasima(l, d.stok as Partial<TasimaStokSatiri> | undefined)
    case 'TOPLU_TASIMA_EKLE': {
      await topluSatirSil(Number(l.orderNo), d.stok as TasimaStokSatiri)
      return `Fiş ${l.orderNo}: ${l.partNo} satırı silindi`
    }
    case 'TOPLU_TASIMA_OLUSTUR': {
      await topluIptal(Number(l.orderNo))
      return `Fiş ${l.orderNo} iptal edildi`
    }
    case 'HU_EKLE': {
      const id = num(d.handlingUnitId)
      await palettenCikar(id, { ...(d.stok as HuStokSatiri), handlingUnitId: id }, miktar)
      return `${l.partNo} · ${miktar} palet ${id}'den geri çıkarıldı`
    }
    case 'HU_CIKAR': {
      const id = num(d.handlingUnitId)
      await paleteEkle(id, { ...(d.stok as HuStokSatiri), handlingUnitId: 0 }, miktar)
      return `${l.partNo} · ${miktar} palet ${id}'e geri eklendi`
    }
    case 'HU_DEGISTIR': {
      const id = num(d.handlingUnitId), hedefId = num(d.hedefHandlingUnitId)
      await paletDegistir(hedefId, id, { ...(d.stok as HuStokSatiri), handlingUnitId: hedefId }, miktar)
      return `${l.partNo} · ${miktar} palet ${hedefId} → ${id} geri aktarıldı`
    }
    case 'HU_TASI': {
      const id = num(d.handlingUnitId)
      await paletTasi(id, l.kaynakLok!)
      return `Palet ${id} ${l.hedefLok ?? ''} → ${l.kaynakLok} geri taşındı`
    }
    case 'TRANSFER_TALEBI_BAGLA': {
      const no = Number(l.orderNo)
      const t = await transferTalepGetir(no)
      if (!t) throw new Error(`Talep bulunamadı: ${no}`)
      if (t.durum !== 'Prepared') throw new Error(`Talep ${no} ${t.durum} durumunda — bağlama geri alınamaz`)
      const s = d.stok as Partial<TasimaStokSatiri>
      const aday = t.seciliStoklar
        .filter((x) => x.partNo === l.partNo && x.locationNo === s.locationNo && x.lotBatchNo === nz(s.lotBatchNo) &&
          x.handlingUnitId === num(s.handlingUnitId) && Math.abs(x.miktar - miktar) < 1e-9)
        .sort((a, b) => b.taskId - a.taskId || b.lineNo - a.lineNo)
      if (!aday.length) throw new Error('Bu bağlama talepte artık yok (kaldırılmış ya da transfer edilmiş)')
      await stokKaldir(no, aday[0].taskId, aday[0].lineNo)
      return `Talep ${no}: ${l.partNo} · ${miktar} bağlaması kaldırıldı`
    }
    case 'MALZEME_TALEBI_REZERV': {
      await mtSatirCikar(l.orderNo!, { lineNo: String(d.lineNo), releaseNo: l.releaseNo!, lineItemNo: num(l.lineItemNo) })
      return `Talep ${l.orderNo}: ${l.partNo} satırı çıkarıldı (rezerv geri alındı)`
    }
    case 'SEVKIYAT_OKUT': {
      await okutmaSil(Number(l.orderNo), String(d.okutmaId))
      return `Sevkiyat ${l.orderNo}: ${l.partNo} okutması silindi`
    }
    case 'SEVKIYAT_TOPLA': {
      const id = Number(l.orderNo)
      const s = await sevkiyatGetir(id)
      if (!s) throw new Error(`Sevkiyat bulunamadı: ${id}`)
      const r = s.rezervler.find((x) => x.locationNo === l.hedefLok && x.partNo === l.partNo && x.lotBatchNo === nz(l.lotBatchNo) && x.toplanan >= miktar - 1e-9)
      if (!r) throw new Error(`Sevk lokasyonunda (${l.hedefLok}) bu toplama artık yok — geri alınamaz`)
      await toplamaGeriAl(id, r, miktar, l.kaynakLok!)
      await geriAlindiDus(id, l.partNo, nz(l.lotBatchNo), l.kaynakLok!, miktar).catch(() => null)
      return `Sevkiyat ${id}: ${l.partNo} · ${miktar} ${l.hedefLok} → ${l.kaynakLok} geri alındı`
    }
    case 'TOPLAMA_CIKIS': {
      // UnissueMaterial satırın TÜM çıkışını iade eder → yalnız çıkılan = bu kayıttaki miktar iken güvenli.
      const s = { orderNo: l.orderNo!, releaseNo: l.releaseNo ?? '*', sequenceNo: l.sequenceNo ?? '*', lineItemNo: num(l.lineItemNo) }
      const c = await getSatirCikis(s)
      if (!c) throw new Error(`İş emri satırı bulunamadı: ${s.orderNo}/${s.lineItemNo}`)
      if (Math.abs(c.qtyIssued - miktar) > 1e-9) {
        throw new Error(`İş emri ${s.orderNo} satırında çıkılan ${c.qtyIssued}, bu işlem ${miktar} — kısmi iade yapılamaz, ofise bildirin`)
      }
      const r = await unissueSatir(s, l.kaynakLok!)
      if (!r.ok) throw new Error(dostaneIfsHata(r.error ?? '', 'İş emri iadesi başarısız'))
      const son = await getSatirCikis(s)
      if (son && son.qtyIssued > 1e-9) throw new Error(`İade sonrası satırda hâlâ ${son.qtyIssued} çıkılmış görünüyor — ofise bildirin`)
      return `İş emri ${s.orderNo}/${s.lineItemNo}: ${l.partNo} · ${miktar} ${l.kaynakLok} rafına iade edildi`
    }
    case 'SAYIM_YAZ':
    case 'SAYIM_AYNI': {
      const onceki = num(d.onceki)
      await sayilanYaz(l.orderNo!, num(l.lineItemNo), onceki)
      return `Sayım ${l.orderNo}/${l.lineItemNo}: sayılan ${onceki}'a geri alındı`
    }
    default:
      throw new Error('Bu işlem türü geri alınamaz')
  }
}

// ── Liste + geri alma ────────────────────────────────────────────────────────

export interface SonIslem {
  id: string
  olay: string
  olayAdi: string
  createdAt: string
  partNo: string
  lotBatchNo: string | null
  miktar: number | null
  kaynakLok: string | null
  hedefLok: string | null
  orderNo: string | null
  /** Bu işlemi geri alan kayıt (varsa). */
  geriAlindi: { id: string; createdAt: string; mesaj: string | null } | null
  durum: GeriAlDurum
}

/** Operatörün son `saat` saatteki hareketleri (en yeni önce, en fazla 200). */
export async function sonIslemler(userId: string, saat = GERI_AL_SAAT): Promise<SonIslem[]> {
  const simdi = new Date()
  const kayitlar = await prisma.depoHareketLog.findMany({
    where: { userId, createdAt: { gte: new Date(simdi.getTime() - saat * 3600_000) } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { geriAlma: { select: { id: true, createdAt: true, detay: true } } },
  })
  return kayitlar.map((k) => {
    const ga = k.geriAlma
    const gaDetay = ga?.detay && typeof ga.detay === 'object' ? (ga.detay as Detay) : {}
    return {
      id: k.id,
      olay: k.olay,
      olayAdi: olayAdi(k.olay),
      createdAt: k.createdAt.toISOString(),
      partNo: k.partNo,
      lotBatchNo: k.lotBatchNo,
      miktar: k.miktar == null ? null : Number(k.miktar),
      kaynakLok: k.kaynakLok,
      hedefLok: k.hedefLok,
      orderNo: k.orderNo,
      geriAlindi: ga ? { id: ga.id, createdAt: ga.createdAt.toISOString(), mesaj: typeof gaDetay.sonuc === 'string' ? gaDetay.sonuc : null } : null,
      durum: ga ? { uygun: false, neden: 'Geri alındı' } : geriAlUygunlugu(k, userId, simdi),
    }
  })
}

/**
 * Tek kaydı geri al. Önce GERI_AL satırı (geriAlinanId unique) yazılır → aynı kayıt için ikinci istek
 * burada düşer; IFS ters işlemi hata verirse satır silinir (yeniden denenebilir).
 */
export async function geriAl(logId: string, user: { id: string; ad: string }): Promise<{ mesaj: string }> {
  const l = await prisma.depoHareketLog.findUnique({ where: { id: logId }, include: { geriAlma: { select: { id: true } } } })
  if (!l) throw new Error('İşlem bulunamadı')
  if (l.geriAlma) throw new Error('Bu işlem zaten geri alındı')
  const durum = geriAlUygunlugu(l, user.id)
  if (!durum.uygun) throw new Error(durum.neden)

  let kilit: { id: string }
  try {
    kilit = await prisma.depoHareketLog.create({
      data: {
        olay: 'GERI_AL', userId: user.id, kullaniciAd: user.ad, partNo: l.partNo, lotBatchNo: l.lotBatchNo, miktar: l.miktar ?? undefined,
        // Ters yön: orijinalin hedefi kaynak olur.
        kaynakLok: l.hedefLok, hedefLok: l.kaynakLok, orderNo: l.orderNo, releaseNo: l.releaseNo, sequenceNo: l.sequenceNo, lineItemNo: l.lineItemNo,
        geriAlinanId: l.id,
        detay: { olay: l.olay, durum: 'isleniyor', contract: getIfsConfig().contract },
      },
      select: { id: true },
    })
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') throw new Error('Bu işlem zaten geri alındı ya da şu an geri alınıyor')
    throw e
  }
  try {
    const mesaj = await tersIslem(l)
    await prisma.depoHareketLog.update({ where: { id: kilit.id }, data: { detay: { olay: l.olay, durum: 'tamam', sonuc: mesaj } } })
    return { mesaj }
  } catch (e) {
    await prisma.depoHareketLog.delete({ where: { id: kilit.id } }).catch((err) => console.error('[geri-al] kilit silinemedi', kilit.id, err))
    throw new Error(`${olayAdi(l.olay)} geri alınamadı: ${e instanceof Error ? e.message : String(e)}`)
  }
}
