import 'server-only'
import * as XLSX from 'xlsx'
import type { Prisma, PrismaClient } from '@/generated/prisma'
import { logAuditEvent } from '@/lib/audit-log'
import {
  KURAL_SURUMU,
  pdksTakvimTipi,
  puantajHesapla,
  yerel,
  type IzinKaynagi,
  type PuantajSonucu,
  type VardiyaTanim,
} from './puantaj-motor'
import { prismaIzinKaynagi } from '../izin/pdks-izin-kaynagi'

/**
 * PDKS Faz 4 — puantaj servisi: motoru (puantaj-motor.ts, saf) DB'ye bağlar.
 * - gunuHesapla: bir vardiya günü için kişileri yükler, hesaplar; kaydet=true ise KİLİTSİZ satırları yazar.
 * - Kilitli gün yeniden hesaplanmaz (sonuclariYaz atlar); kilit aç/kapa denetim kaydı yazar.
 * - Gri yaka varsayılan vardiya/tolerans için MAVI sayılır (Melih 27.09); atama her şeyi ezer.
 */

type Db = PrismaClient

// ── Yardımcılar ──────────────────────────────────────────────────────────────

export const gunStr = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10)
export const bugunStr = () => gunStr(new Date())
export function gunEkle(gun: string, n: number): string {
  const d = new Date(`${gun}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** @db.Date kolonları için: "YYYY-MM-DD" → UTC gece yarısı Date */
export const dbGun = (gun: string) => new Date(`${gun}T00:00:00Z`)
export const GUN_DESENI = /^\d{4}-\d{2}-\d{2}$/

type YakaRengi = 'MAVI' | 'BEYAZ' | 'GRI'
const yakaTipi = (y: YakaRengi): 'BEYAZ' | 'MAVI' => (y === 'BEYAZ' ? 'BEYAZ' : 'MAVI')

// ── Yazma yolu (kilit burada uygulanır — birim testli) ──────────────────────

export interface PuantajYazici {
  kilitliler(gun: string, personelIdleri: string[]): Promise<Set<string>>
  yaz(gun: string, satirlar: { personnelId: string; sonuc: PuantajSonucu }[], hesaplandiAt: Date): Promise<void>
}

export async function sonuclariYaz(
  yazici: PuantajYazici,
  gun: string,
  sonuclar: { personnelId: string; sonuc: PuantajSonucu }[],
  hesaplandiAt = new Date(),
): Promise<{ yazilan: number; kilitliAtlanan: number }> {
  const kilitli = await yazici.kilitliler(gun, sonuclar.map((s) => s.personnelId))
  const yazilacak = sonuclar.filter((s) => !kilitli.has(s.personnelId))
  if (yazilacak.length) await yazici.yaz(gun, yazilacak, hesaplandiAt)
  return { yazilan: yazilacak.length, kilitliAtlanan: sonuclar.length - yazilacak.length }
}

export function prismaPuantajYazici(db: Db): PuantajYazici {
  return {
    async kilitliler(gun, ids) {
      const rs = await db.pdksPuantajGun.findMany({
        where: { gun: dbGun(gun), personnelId: { in: ids }, kilitli: true },
        select: { personnelId: true },
      })
      return new Set(rs.map((r) => r.personnelId))
    },
    async yaz(gun, satirlar, hesaplandiAt) {
      await db.$transaction(
        satirlar.map(({ personnelId, sonuc: s }) => {
          const data = {
            vardiyaId: s.vardiyaId,
            vardiyaKaynak: s.vardiyaKaynak,
            beklenenBaslangic: s.beklenenBaslangic,
            beklenenBitis: s.beklenenBitis,
            ilkGiris: s.ilkGiris,
            sonCikis: s.sonCikis,
            ilkGirisGecisId: s.ilkGirisGecisId,
            sonCikisGecisId: s.sonCikisGecisId,
            girisKaynak: s.girisKaynak,
            cikisKaynak: s.cikisKaynak,
            kartOkutamamaId: s.kartOkutamamaId,
            durum: s.durum,
            gecDakika: s.gecDakika,
            erkenCikisDakika: s.erkenCikisDakika,
            calismaDakika: s.calismaDakika,
            onayliMesaiDakika: s.onayliMesaiDakika,
            fazlaDakika: s.fazlaDakika,
            fiiliDakika: s.fiiliDakika,
            dusulenMolaDakika: s.dusulenMolaDakika,
            mesaiPersonelId: s.mesaiPersonelId,
            izinTalepId: s.izinTalepId,
            izinPay: s.izinPay,
            izinEtiketi: s.izinEtiketi,
            uyarilar: s.uyarilar,
            hesaplamaSurumu: KURAL_SURUMU,
            hesaplandiAt,
          }
          return db.pdksPuantajGun.upsert({
            where: { personnelId_gun: { personnelId, gun: dbGun(gun) } },
            create: { personnelId, gun: dbGun(gun), ...data },
            update: data,
          })
        }),
      )
    },
  }
}

// ── Yükleme + hesap ──────────────────────────────────────────────────────────

async function ayarOku(db: Db, key: string, varsayilan: string): Promise<string> {
  const a = await db.systemSetting.findUnique({ where: { key }, select: { value: true } })
  return a?.value?.trim() || varsayilan
}

export interface GunHesapSonucu {
  gun: string
  hesaplanan: number
  yazilan: number
  kilitliAtlanan: number
  vardiyasiz: string[]
  sonuclar: { personnelId: string; sonuc: PuantajSonucu }[]
}

export async function gunuHesapla(
  db: Db,
  gun: string,
  o: { personelIdleri?: string[]; kaydet?: boolean; simdi?: Date; izinKaynagi?: IzinKaynagi } = {},
): Promise<GunHesapSonucu> {
  if (!GUN_DESENI.test(gun)) throw new Error(`gün YYYY-MM-DD olmalı: ${gun}`)
  const simdi = o.simdi ?? new Date()
  const kaydet = o.kaydet ?? true

  const personeller = await db.personnel.findMany({
    where: o.personelIdleri ? { id: { in: o.personelIdleri } } : { aktif: true },
    select: { id: true, sicilNo: true, yakaRengi: true, departmentId: true, iseGirisTarihi: true, aktif: true },
  })
  const ids = personeller.map((p) => p.id)
  if (!ids.length) return { gun, hesaplanan: 0, yazilan: 0, kilitliAtlanan: 0, vardiyasiz: [], sonuclar: [] }

  const [vardiyalar, atamalar, tatil, sensorZ, yarimBitis] = await Promise.all([
    db.pdksVardiya.findMany({ where: { aktif: true }, include: { molalar: { where: { aktif: true } } }, orderBy: { sira: 'asc' } }),
    db.pdksPersonelVardiya.findMany({
      where: { personnelId: { in: ids }, baslangic: { lte: dbGun(gun) }, OR: [{ bitis: null }, { bitis: { gte: dbGun(gun) } }] },
      orderBy: { baslangic: 'desc' },
      select: { personnelId: true, vardiyaId: true },
    }),
    db.iproTatil.findUnique({ where: { tarih: dbGun(gun) }, select: { tip: true } }),
    ayarOku(db, 'pdks_gecis_sensoru_zorunlu', 'false'),
    ayarOku(db, 'pdks_yarim_gun_bitis', '13:00'),
  ])
  const vById = new Map(vardiyalar.map((v) => [v.id, v]))
  const tanim = (v: (typeof vardiyalar)[number]): VardiyaTanim => ({
    id: v.id, kod: v.kod, girisSaat: v.girisSaat, cikisSaat: v.cikisSaat, gunDonumSaat: v.gunDonumSaat,
    gecToleransDk: v.gecToleransDk, erkenToleransDk: v.erkenToleransDk,
    molalar: v.molalar.map((m) => ({ tur: m.tur, baslangic: m.baslangic, bitis: m.bitis, dusulur: m.dusulur, departmentId: m.departmentId })),
  })
  const varsayilan = (y: 'BEYAZ' | 'MAVI') =>
    vardiyalar.find((v) => v.varsayilan && v.yakaTipi === y) ?? vardiyalar.find((v) => v.varsayilan && v.yakaTipi === 'HEPSI')
  const atamaBy = new Map<string, string>()
  for (const a of atamalar) if (!atamaBy.has(a.personnelId)) atamaBy.set(a.personnelId, a.vardiyaId) // en yeni başlangıç

  // Geçiş penceresi: gün 00:00 → +2 gün (her gün dönüm saati kapsanır; motor vardiya gününe süzer)
  const [gecisler, kartFormlari, mesai] = await Promise.all([
    db.pdksGecis.findMany({
      where: { personnelId: { in: ids }, olayTipi: 'GECERLI_KART', olayZamani: { gte: yerel(gun, '00:00'), lt: yerel(gun, '00:00', 2) } },
      select: { id: true, personnelId: true, olayZamani: true, yon: true, _count: { select: { sensorOlaylari: true } } },
    }),
    db.bulkCardScanFailure.findMany({
      where: { personnelId: { in: ids }, tarih: dbGun(gun) },
      select: { id: true, personnelId: true, girisSaati: true, cikisSaati: true, onayDurumu: true, ivOnaylandi: true },
    }),
    db.overtimePersonnel.findMany({
      where: { personnelId: { in: ids }, overtimeForm: { status: 'APPROVED', formTipi: 'MESAI', date: dbGun(gun) } },
      select: { id: true, personnelId: true, overtimeForm: { select: { isFullDay: true, startTime: true, endTime: true } } },
    }),
  ])
  // İzin: varsayılan kaynak onaylı izin günleri (İzin Faz 3). Testler kendi kaynağını verir.
  const izinler = await (o.izinKaynagi ?? prismaIzinKaynagi(db)).izinDurumlari(ids, gun)
  const takvim = pdksTakvimTipi(gun, tatil?.tip ?? null)
  const saatGecerli = (s: string | null) => (s && /^\d{2}:\d{2}$/.test(s) ? s : null)

  const sonuclar: { personnelId: string; sonuc: PuantajSonucu }[] = []
  const vardiyasiz: string[] = []
  for (const p of personeller) {
    const atanan = atamaBy.get(p.id)
    const v = (atanan && vById.get(atanan)) || varsayilan(yakaTipi(p.yakaRengi as YakaRengi))
    if (!v) {
      vardiyasiz.push(p.sicilNo ?? p.id)
      continue
    }
    const sonuc = puantajHesapla({
      gun,
      vardiya: tanim(v),
      vardiyaKaynak: atanan && vById.get(atanan) ? 'ATAMA' : 'VARSAYILAN',
      departmentId: p.departmentId,
      takvim,
      iseGiris: gunStr(p.iseGirisTarihi),
      gecisler: gecisler
        .filter((x) => x.personnelId === p.id)
        .map((x) => ({ id: x.id, zaman: x.olayZamani, yon: x.yon, sensorBagli: x._count.sensorOlaylari > 0 })),
      kartFormlari: kartFormlari
        .filter((f) => f.personnelId === p.id)
        .map((f) => ({ id: f.id, girisSaati: saatGecerli(f.girisSaati), cikisSaati: saatGecerli(f.cikisSaati), onayDurumu: f.onayDurumu, ivOnaylandi: f.ivOnaylandi })),
      mesaiFormlari: mesai
        .filter((m) => m.personnelId === p.id)
        .map((m) => ({ overtimePersonnelId: m.id, isFullDay: m.overtimeForm.isFullDay, startTime: saatGecerli(m.overtimeForm.startTime), endTime: saatGecerli(m.overtimeForm.endTime) })),
      ayarlar: { sensorZorunlu: sensorZ === 'true', yarimGunBitis: /^\d{2}:\d{2}$/.test(yarimBitis) ? yarimBitis : '13:00' },
      izin: izinler.get(p.id) ?? null,
      simdi,
    })
    sonuclar.push({ personnelId: p.id, sonuc })
  }
  const yaz = kaydet ? await sonuclariYaz(prismaPuantajYazici(db), gun, sonuclar, simdi) : { yazilan: 0, kilitliAtlanan: 0 }
  return { gun, hesaplanan: sonuclar.length, ...yaz, vardiyasiz, sonuclar }
}

/** Gece cron'u: dün + son 7 gün (kilitliler atlanır). */
export async function araligiHesapla(db: Db, bas: string, bit: string) {
  const ozet: Omit<GunHesapSonucu, 'sonuclar'>[] = []
  for (let g = bas; g <= bit; g = gunEkle(g, 1)) {
    const { sonuclar: _s, ...r } = await gunuHesapla(db, g)
    ozet.push(r)
  }
  return ozet
}

// ── Kilit ────────────────────────────────────────────────────────────────────

export async function kilitDegistir(db: Db, bas: string, bit: string, kilitli: boolean, aktorId: string) {
  if (!GUN_DESENI.test(bas) || !GUN_DESENI.test(bit) || bas > bit) throw new Error('Geçersiz tarih aralığı')
  return db.$transaction(async (tx) => {
    const r = await tx.pdksPuantajGun.updateMany({
      where: { gun: { gte: dbGun(bas), lte: dbGun(bit) }, kilitli: !kilitli },
      data: kilitli ? { kilitli: true, kilitleyenId: aktorId, kilitAt: new Date() } : { kilitli: false, kilitleyenId: aktorId, kilitAt: new Date() },
    })
    await logAuditEvent({
      tx,
      action: kilitli ? 'PDKS_PUANTAJ_KILITLENDI' : 'PDKS_PUANTAJ_KILIT_ACILDI',
      actorId: aktorId,
      targetType: 'PDKS_PUANTAJ',
      targetId: `${bas}..${bit}`,
      details: { bas, bit, adet: r.count },
    })
    return { adet: r.count }
  })
}

// ── Ekran sorgusu ────────────────────────────────────────────────────────────

const PUANTAJ_SEC = {
  personnelId: true, gun: true, durum: true, ilkGiris: true, sonCikis: true, girisKaynak: true, cikisKaynak: true,
  gecDakika: true, erkenCikisDakika: true, calismaDakika: true, fiiliDakika: true, dusulenMolaDakika: true,
  onayliMesaiDakika: true, fazlaDakika: true, uyarilar: true, kilitli: true, hesaplamaSurumu: true, hesaplandiAt: true, izinPay: true,
  vardiya: { select: { kod: true, ad: true } },
  personnel: { select: { sicilNo: true, adSoyad: true, bolum: true, departmentId: true, department: { select: { name: true } } } },
} satisfies Prisma.PdksPuantajGunSelect

export async function puantajGunu(db: Db, gun: string, f: { departmentId?: string | null; q?: string | null }) {
  const q = (f.q ?? '').trim()
  const where: Prisma.PdksPuantajGunWhereInput = {
    gun: dbGun(gun),
    personnel: {
      aktif: true,
      ...(f.departmentId ? { departmentId: f.departmentId } : {}),
      ...(q ? { OR: [{ sicilNo: { contains: q, mode: 'insensitive' } }, { adSoyad: { contains: q, mode: 'insensitive' } }] } : {}),
    },
  }
  const [satirlar, aktifPersonel, departmanlar] = await Promise.all([
    db.pdksPuantajGun.findMany({ where, select: PUANTAJ_SEC, orderBy: { personnel: { adSoyad: 'asc' } } }),
    db.personnel.count({ where: { aktif: true, ...(f.departmentId ? { departmentId: f.departmentId } : {}) } }),
    db.departmentDefinition.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  const bekleyen = (d: string) => !['TATIL', 'HAFTA_SONU', 'BEKLENMIYOR', 'IZINLI'].includes(d)
  const ozet = {
    beklenen: satirlar.filter((s) => bekleyen(s.durum)).length,
    tam: satirlar.filter((s) => s.durum === 'TAM' || s.durum === 'TAM_FORMLA' || s.durum === 'MESAI').length,
    eksik: satirlar.filter((s) => s.durum === 'EKSIK_GIRIS' || s.durum === 'EKSIK_CIKIS').length,
    gelmedi: satirlar.filter((s) => s.durum === 'GELMEDI').length,
    izinli: satirlar.filter((s) => s.durum === 'IZINLI').length,
    gec: satirlar.filter((s) => s.gecDakika > 0).length,
  }
  const hesaplandi = satirlar.reduce<Date | null>((m, s) => (!m || s.hesaplandiAt > m ? s.hesaplandiAt : m), null)
  return {
    gun,
    satirlar: satirlar.map((s) => ({
      personnelId: s.personnelId,
      sicil: s.personnel.sicilNo,
      adSoyad: s.personnel.adSoyad,
      departman: s.personnel.department?.name ?? s.personnel.bolum,
      vardiya: s.vardiya?.kod ?? null,
      ilkGiris: s.ilkGiris?.toISOString() ?? null,
      sonCikis: s.sonCikis?.toISOString() ?? null,
      girisKaynak: s.girisKaynak,
      cikisKaynak: s.cikisKaynak,
      gecDakika: s.gecDakika,
      erkenCikisDakika: s.erkenCikisDakika,
      calismaDakika: s.calismaDakika,
      fiiliDakika: s.fiiliDakika,
      onayliMesaiDakika: s.onayliMesaiDakika,
      durum: s.durum,
      uyarilar: s.uyarilar,
      kilitli: s.kilitli,
    })),
    ozet,
    meta: {
      kayit: satirlar.length,
      aktifPersonel,
      hesaplanmamis: Math.max(0, aktifPersonel - satirlar.length),
      sonHesaplama: hesaplandi?.toISOString() ?? null,
      kuralSurumleri: [...new Set(satirlar.map((s) => s.hesaplamaSurumu))].sort(),
      guncelKuralSurumu: KURAL_SURUMU,
      kilitli: satirlar.length > 0 && satirlar.every((s) => s.kilitli),
      kismenKilitli: satirlar.some((s) => s.kilitli) && !satirlar.every((s) => s.kilitli),
    },
    departmanlar,
  }
}

// ── Excel ────────────────────────────────────────────────────────────────────

const DURUM_ETIKET: Record<string, string> = {
  TAM: 'Tam', TAM_FORMLA: 'Tam (formla)', EKSIK_GIRIS: 'Eksik giriş', EKSIK_CIKIS: 'Eksik çıkış', GELMEDI: 'Gelmedi', IZINLI: 'İzinli',
  TATIL: 'Tatil', HAFTA_SONU: 'Hafta sonu', MESAI: 'Mesai (onaylı form)', BEKLENMIYOR: 'Beklenmiyor',
}
const saatStr = (d: Date | null) => (d ? new Date(d.getTime() + 3 * 3600_000).toISOString().slice(11, 16) : '')

/**
 * Puantaj Excel'i (xlsx Buffer). Günlük (bas=bit) ya da aylık. KVKK: DOSYAYA YAZILMAZ — yanıt olarak
 * indirilir; çağıran route denetim kaydı yazar.
 */
export async function puantajExcel(db: Db, bas: string, bit: string, departmentId?: string | null): Promise<{ buffer: Buffer; satir: number }> {
  const rs = await db.pdksPuantajGun.findMany({
    where: { gun: { gte: dbGun(bas), lte: dbGun(bit) }, ...(departmentId ? { personnel: { departmentId } } : {}) },
    select: { ...PUANTAJ_SEC, beklenenBaslangic: true, beklenenBitis: true },
    orderBy: [{ personnel: { adSoyad: 'asc' } }, { gun: 'asc' }],
  })
  const detay = rs.map((s) => ({
    Tarih: s.gun.toISOString().slice(0, 10),
    Sicil: s.personnel.sicilNo ?? '',
    'Ad Soyad': s.personnel.adSoyad,
    Departman: s.personnel.department?.name ?? s.personnel.bolum,
    Vardiya: s.vardiya?.kod ?? '',
    'İlk giriş': saatStr(s.ilkGiris) + (s.girisKaynak === 'FORM' ? ' (form)' : ''),
    'Son çıkış': saatStr(s.sonCikis) + (s.cikisKaynak === 'FORM' ? ' (form)' : ''),
    'Geç (dk)': s.gecDakika,
    'Erken (dk)': s.erkenCikisDakika,
    'Fiili turnike (dk)': s.fiiliDakika ?? '',
    'Düşülen mola (dk)': s.dusulenMolaDakika ?? '',
    'Mesai formu (dk)': s.onayliMesaiDakika ?? '',
    'Çalışma (dk)': s.calismaDakika ?? '',
    Durum: DURUM_ETIKET[s.durum] ?? s.durum,
    Kilitli: s.kilitli ? 'evet' : '',
    Uyarılar: s.uyarilar.join(', '),
  }))
  const kisi = new Map<string, { Sicil: string; 'Ad Soyad': string; Departman: string; 'Çalışma (dk)': number; 'Mesai formu (dk)': number; 'Geç (dk)': number; 'Geç gün': number; 'Eksik okutma gün': number; 'Gelmedi gün': number; 'İzinli gün': number; 'Formla tamamlanan': number }>()
  for (const s of rs) {
    const k = kisi.get(s.personnelId) ?? { Sicil: s.personnel.sicilNo ?? '', 'Ad Soyad': s.personnel.adSoyad, Departman: s.personnel.department?.name ?? s.personnel.bolum, 'Çalışma (dk)': 0, 'Mesai formu (dk)': 0, 'Geç (dk)': 0, 'Geç gün': 0, 'Eksik okutma gün': 0, 'Gelmedi gün': 0, 'İzinli gün': 0, 'Formla tamamlanan': 0 }
    k['Çalışma (dk)'] += s.calismaDakika ?? 0
    k['Mesai formu (dk)'] += s.onayliMesaiDakika ?? 0
    k['Geç (dk)'] += s.gecDakika
    if (s.gecDakika > 0) k['Geç gün']++
    if (s.durum === 'EKSIK_GIRIS' || s.durum === 'EKSIK_CIKIS') k['Eksik okutma gün']++
    if (s.durum === 'GELMEDI') k['Gelmedi gün']++
    k['İzinli gün'] += s.durum === 'IZINLI' ? Number(s.izinPay ?? 1) : s.izinPay ? Number(s.izinPay) : 0
    if (s.durum === 'TAM_FORMLA') k['Formla tamamlanan']++
    kisi.set(s.personnelId, k)
  }
  const wb = XLSX.utils.book_new()
  if (bas !== bit) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...kisi.values()]), 'Özet')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detay), 'Günlük')
  return { buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer, satir: rs.length }
}
