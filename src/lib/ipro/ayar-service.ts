import 'server-only'
import { prisma } from '@/lib/prisma'
import { esikSaniye, cevrimMedyaniGaplerden } from '@/lib/ipro/durus-esik'
import { esikAyarGetir, tezgahEsikMap, birlesikEsikAyar, ayarOnbellekTemizle, ayarGecmisYaz, AYAR_CARPAN, AYAR_TABAN, AYAR_TAVAN } from '@/lib/ipro/ipro-ayar'
import { gunBiti } from '@/lib/ipro/mola-takvim'

// IPRO ayarları servisi — okuma (ekran verisi) + yazma (doğrulama + audit). Değişiklik anında geçerli
// (önbellek temizlenir); kapalı OEE kayıtları yeniden hesaplanmaz.

// ─────────────── SAF doğrulamalar (DB'siz test) ───────────────

/** "HH:mm" → dakika. Geçersiz → null. */
export function hhmmDk(s: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/**
 * Mola vardiya penceresi İÇİNDE mi? Gece vardiyasında (ertesiGuneTasar) pencere 24s'i aşar.
 * Başlangıç dk vardiya [bas, bit) içinde ve başlangıç+süre bit'i aşmıyorsa geçerli.
 */
export function molaVardiyaIcinde(molaBasDk: number, sureDk: number, vBasDk: number, vBitDk: number, ertesiGuneTasar: boolean): boolean {
  const vBit = vBitDk + (ertesiGuneTasar ? 1440 : 0)
  let bas = molaBasDk
  if (ertesiGuneTasar && molaBasDk < vBasDk) bas += 1440 // gece yarısı sonrası
  return bas >= vBasDk && bas + sureDk <= vBit
}

export interface MolaSlot { baslangicDk: number; sureDk: number; gunMaskesi: number }
/**
 * Aynı vardiya+bölüm için yeni molanın MEVCUT (aktif) molalarla ÇAKIŞMASI var mı?
 * Çakışma = zaman aralıkları kesişir VE gün maskeleri ortak bir gün içerir. haricId: kendini hariç tut (güncelleme).
 */
export function molaCakismaVar(yeni: MolaSlot, mevcutlar: MolaSlot[]): boolean {
  const yBas = yeni.baslangicDk, yBit = yeni.baslangicDk + yeni.sureDk
  for (const m of mevcutlar) {
    if ((m.gunMaskesi & yeni.gunMaskesi) === 0) continue // ortak gün yok
    const mBas = m.baslangicDk, mBit = m.baslangicDk + m.sureDk
    if (yBas < mBit && mBas < yBit) return true // zaman kesişimi
  }
  return false
}

// ─────────────── Okuma ───────────────

const GUN_KISA = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'] // bit 1..64

export async function ayarVerisi() {
  const [genel, istisnaMap, tezgahlar, molalar, vardiyalar, tatiller, gecmis] = await Promise.all([
    esikAyarGetir(),
    tezgahEsikMap(),
    prisma.iproTezgah.findMany({ where: { aktif: true }, select: { id: true, kod: true, masGrupAdi: true } }),
    prisma.iproMolaTanim.findMany({ select: { id: true, vardiyaId: true, bolum: true, baslangic: true, sureDk: true, gunMaskesi: true, aktif: true, sebep: { select: { kod: true, ad: true } } }, orderBy: [{ baslangic: 'asc' }] }),
    prisma.iproVardiya.findMany({ orderBy: { sira: 'asc' }, select: { id: true, kod: true, ad: true, baslangicSaat: true, bitisSaat: true, ertesiGuneTasar: true, aktif: true } }),
    prisma.iproTatil.findMany({ orderBy: { tarih: 'desc' }, select: { id: true, tarih: true, tip: true, aciklama: true } }),
    prisma.iproAyarGecmis.findMany({ orderBy: { zaman: 'desc' }, take: 100, select: { zaman: true, kullaniciId: true, alan: true, kayitRef: true, eski: true, yeni: true } }),
  ])
  const kodById = new Map(tezgahlar.map((t) => [t.id, t.kod]))

  // Tezgah istisnaları — ölçülen çevrim (son 50 sayaç gap medyanı) + hesaplanan eşik
  const istisnalar = await Promise.all(
    [...istisnaMap.entries()].map(async ([tezgahId, ist]) => {
      const kod = kodById.get(tezgahId) ?? tezgahId
      const rows = await prisma.iproSayacOkuma.findMany({ where: { tezgahKod: kod }, orderBy: { ts: 'desc' }, take: 51, select: { ts: true } })
      let olculen: number | null = null
      if (rows.length >= 3) {
        const asc = rows.map((r) => r.ts.getTime()).sort((a, b) => a - b)
        const gaps: number[] = []
        for (let i = 1; i < asc.length; i++) gaps.push((asc[i] - asc[i - 1]) / 1000)
        olculen = cevrimMedyaniGaplerden(gaps)
      }
      const efektif = birlesikEsikAyar(genel, ist)
      return { tezgahId, kod, olculenCevrimSn: olculen, hesaplananEsikSn: esikSaniye(olculen, efektif), tabanSn: ist.tabanSn, tavanSn: ist.tavanSn }
    }),
  )

  const molaGoster = molalar.map((m) => ({
    id: m.id, vardiyaId: m.vardiyaId, bolum: m.bolum, baslangic: m.baslangic, sureDk: m.sureDk, aktif: m.aktif,
    sebep: `${m.sebep.kod} ${m.sebep.ad}`,
    gunler: Array.from({ length: 7 }, (_, i) => ({ ad: GUN_KISA[i], on: (m.gunMaskesi & (1 << i)) !== 0 })),
  }))

  const planliSebepler = await prisma.iproDurusSebebi.findMany({ where: { planli: true, aktif: true }, orderBy: { kod: 'asc' }, select: { id: true, kod: true, ad: true } })
  const bolumler = [...new Set(tezgahlar.map((t) => t.masGrupAdi).filter((b): b is string => !!b))].sort((a, b) => a.localeCompare(b, 'tr'))

  return {
    genel,
    istisnalar: istisnalar.sort((a, b) => a.kod.localeCompare(b.kod, 'tr')),
    molalar: molaGoster,
    vardiyalar,
    tatiller: tatiller.map((t) => ({ ...t, tarih: t.tarih.toISOString().slice(0, 10) })),
    gecmis: gecmis.map((g) => ({ ...g, zaman: g.zaman.toISOString() })),
    sebepler: planliSebepler.map((sb) => ({ id: sb.id, ad: `${sb.kod} ${sb.ad}` })),
    bolumler,
    tumTezgahlar: tezgahlar.map((t) => ({ id: t.id, kod: t.kod })).sort((a, b) => a.kod.localeCompare(b.kod, 'tr')),
  }
}

// ─────────────── Yazma (IPRO_AYAR_DUZENLE gerekir — API guard eder) ───────────────

async function ayarSet(anahtar: string, deger: string, kullaniciId: string | null) {
  const mevcut = await prisma.iproAyar.findUnique({ where: { anahtar }, select: { deger: true } })
  if (mevcut?.deger === deger) return
  await prisma.iproAyar.upsert({ where: { anahtar }, update: { deger, guncelleyenId: kullaniciId }, create: { anahtar, deger, guncelleyenId: kullaniciId } })
  await ayarGecmisYaz(kullaniciId, 'ayar', anahtar, mevcut?.deger ?? null, deger)
}

/** Genel eşik ayarları (çarpan/taban/tavan). Doğrulama: taban ≤ tavan, pozitif. */
export async function esikKaydet(kullaniciId: string | null, carpan: number, taban: number, tavan: number) {
  if (!(carpan > 0) || !(taban > 0) || !(tavan > 0)) throw new Error('Çarpan/taban/tavan pozitif olmalı')
  if (taban > tavan) throw new Error('Taban tavandan büyük olamaz')
  await ayarSet(AYAR_CARPAN, String(carpan), kullaniciId)
  await ayarSet(AYAR_TABAN, String(Math.round(taban)), kullaniciId)
  await ayarSet(AYAR_TAVAN, String(Math.round(tavan)), kullaniciId)
  ayarOnbellekTemizle()
}

/** Tezgah istisnası (taban/tavan/not). Doğrulama: taban ≤ tavan (ikisi de doluysa). */
export async function tezgahIstisnaKaydet(kullaniciId: string | null, tezgahId: string, tabanSn: number | null, tavanSn: number | null, not: string | null) {
  if (tabanSn != null && tavanSn != null && tabanSn > tavanSn) throw new Error('Taban tavandan büyük olamaz')
  const eski = await prisma.iproTezgahAyar.findUnique({ where: { tezgahId }, select: { tabanSn: true, tavanSn: true, not: true } })
  await prisma.iproTezgahAyar.upsert({
    where: { tezgahId },
    update: { tabanSn, tavanSn, not, guncelleyenId: kullaniciId },
    create: { tezgahId, tabanSn, tavanSn, not, guncelleyenId: kullaniciId },
  })
  await ayarGecmisYaz(kullaniciId, 'tezgah-istisna', tezgahId, eski ? JSON.stringify(eski) : null, JSON.stringify({ tabanSn, tavanSn, not }))
  ayarOnbellekTemizle()
}

export async function tezgahIstisnaSil(kullaniciId: string | null, tezgahId: string) {
  const eski = await prisma.iproTezgahAyar.findUnique({ where: { tezgahId }, select: { tabanSn: true, tavanSn: true, not: true } })
  if (!eski) return
  await prisma.iproTezgahAyar.delete({ where: { tezgahId } })
  await ayarGecmisYaz(kullaniciId, 'tezgah-istisna', tezgahId, JSON.stringify(eski), null)
  ayarOnbellekTemizle()
}

/** Mola ekle/güncelle. Doğrulama: vardiya penceresi içinde + aynı vardiya+bölüm+gün çakışma yok. */
export async function molaKaydet(kullaniciId: string | null, girdi: { id?: string; vardiyaId: string; bolum: string | null; sebepId: string; baslangic: string; sureDk: number; gunMaskesi: number }) {
  const bas = hhmmDk(girdi.baslangic)
  if (bas == null) throw new Error('Başlangıç HH:mm olmalı')
  if (!(girdi.sureDk > 0)) throw new Error('Süre pozitif olmalı')
  if (!(girdi.gunMaskesi > 0)) throw new Error('En az bir gün seçilmeli')
  const vardiya = await prisma.iproVardiya.findUnique({ where: { id: girdi.vardiyaId }, select: { baslangicSaat: true, bitisSaat: true, ertesiGuneTasar: true } })
  if (!vardiya) throw new Error('Vardiya bulunamadı')
  const vBas = hhmmDk(vardiya.baslangicSaat), vBit = hhmmDk(vardiya.bitisSaat)
  if (vBas == null || vBit == null) throw new Error('Vardiya saatleri geçersiz')
  if (!molaVardiyaIcinde(bas, girdi.sureDk, vBas, vBit, vardiya.ertesiGuneTasar)) throw new Error('Mola vardiya penceresi dışında')
  // Çakışma: aynı vardiya + aynı bölüm (null=tüm) + aktif molalar
  const mevcut = await prisma.iproMolaTanim.findMany({
    where: { vardiyaId: girdi.vardiyaId, bolum: girdi.bolum, aktif: true, ...(girdi.id ? { id: { not: girdi.id } } : {}) },
    select: { baslangic: true, sureDk: true, gunMaskesi: true },
  })
  const slots: MolaSlot[] = mevcut.map((m) => ({ baslangicDk: hhmmDk(m.baslangic) ?? 0, sureDk: m.sureDk, gunMaskesi: m.gunMaskesi }))
  if (molaCakismaVar({ baslangicDk: bas, sureDk: girdi.sureDk, gunMaskesi: girdi.gunMaskesi }, slots)) throw new Error('Aynı vardiya+bölüm+gün için çakışan mola var')

  if (girdi.id) {
    const eski = await prisma.iproMolaTanim.findUnique({ where: { id: girdi.id }, select: { baslangic: true, sureDk: true } })
    await prisma.iproMolaTanim.update({ where: { id: girdi.id }, data: { bolum: girdi.bolum, sebepId: girdi.sebepId, baslangic: girdi.baslangic, sureDk: girdi.sureDk, gunMaskesi: girdi.gunMaskesi } })
    await ayarGecmisYaz(kullaniciId, 'mola', girdi.id, eski ? `${eski.baslangic}/${eski.sureDk}dk` : null, `${girdi.baslangic}/${girdi.sureDk}dk`)
  } else {
    const yeni = await prisma.iproMolaTanim.create({ data: { vardiyaId: girdi.vardiyaId, bolum: girdi.bolum, sebepId: girdi.sebepId, baslangic: girdi.baslangic, sureDk: girdi.sureDk, gunMaskesi: girdi.gunMaskesi } })
    await ayarGecmisYaz(kullaniciId, 'mola', yeni.id, null, `${girdi.baslangic}/${girdi.sureDk}dk`)
  }
}

/** Mola pasif yap (silme YOK). */
export async function molaPasifYap(kullaniciId: string | null, id: string, aktif: boolean) {
  await prisma.iproMolaTanim.update({ where: { id }, data: { aktif } })
  await ayarGecmisYaz(kullaniciId, 'mola', id, aktif ? 'pasif' : 'aktif', aktif ? 'aktif' : 'pasif')
}

/** Vardiya saatleri güncelle. Doğrulama: geçerli HH:mm. */
export async function vardiyaKaydet(kullaniciId: string | null, id: string, baslangicSaat: string, bitisSaat: string, ertesiGuneTasar: boolean) {
  if (hhmmDk(baslangicSaat) == null || hhmmDk(bitisSaat) == null) throw new Error('Saat HH:mm olmalı')
  const eski = await prisma.iproVardiya.findUnique({ where: { id }, select: { baslangicSaat: true, bitisSaat: true } })
  await prisma.iproVardiya.update({ where: { id }, data: { baslangicSaat, bitisSaat, ertesiGuneTasar } })
  await ayarGecmisYaz(kullaniciId, 'vardiya', id, eski ? `${eski.baslangicSaat}-${eski.bitisSaat}` : null, `${baslangicSaat}-${bitisSaat}`)
}

/** Tatil ekle. tip: TATIL|YARIM|MESAI. */
export async function tatilEkle(kullaniciId: string | null, tarih: string, tip: string, aciklama: string) {
  const d = new Date(tarih)
  if (isNaN(d.getTime())) throw new Error('Tarih geçersiz')
  if (!['TATIL', 'YARIM', 'MESAI'].includes(tip)) throw new Error('Tip geçersiz')
  await prisma.iproTatil.create({ data: { tarih: d, tip, aciklama, yil: d.getUTCFullYear(), createdById: kullaniciId } })
  await ayarGecmisYaz(kullaniciId, 'tatil', tarih, null, `${tip} ${aciklama}`)
}

export async function tatilSil(kullaniciId: string | null, id: string) {
  const eski = await prisma.iproTatil.findUnique({ where: { id }, select: { tarih: true, tip: true } })
  if (!eski) return
  await prisma.iproTatil.delete({ where: { id } })
  await ayarGecmisYaz(kullaniciId, 'tatil', eski.tarih.toISOString().slice(0, 10), `${eski.tip}`, null)
}

export { gunBiti }
