import 'server-only'
import * as XLSX from 'xlsx'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit-log'
import { bugunStr } from '@/lib/pdks/puantaj-servis'
import type { DefterSatiri, IzinHareketTuru } from './bakiye'
import { GECIS_TARIHI_AYARI, YILLIK_KOD } from './acilis-import'
import { kisiBakiyeOzeti, yakindaMi, type KisiBakiyeOzeti } from './bakiye-ozet'
import { IzinGirdiHatasi, IzinYetkiHatasi } from './gun-sayimi'

/**
 * İzin Faz 2 — Türler ve Bakiye Yönetimi (İV). Okuma izin.admin; defter düzeltmesi izin.bakiye.admin.
 * Yalnız YILLIK türün defteri (bakiyeli tek tür). Yaş hiçbir yanıtta yok.
 */

export function izinHata(e: unknown, varsayilan = 'İşlem başarısız') {
  if (e instanceof IzinYetkiHatasi) return NextResponse.json({ ok: false, error: e.message }, { status: 403 })
  if (e instanceof IzinGirdiHatasi) return NextResponse.json({ ok: false, error: e.message }, { status: 400 })
  if (e instanceof SyntaxError) return NextResponse.json({ ok: false, error: 'Geçersiz istek gövdesi' }, { status: 400 })
  const kod = (e as { code?: string })?.code
  if (kod === 'P2002') return NextResponse.json({ ok: false, error: 'Bu kayıt zaten var' }, { status: 409 })
  if (kod === 'P2025') return NextResponse.json({ ok: false, error: 'Kayıt bulunamadı' }, { status: 404 })
  console.error('[izin]', e)
  return NextResponse.json({ ok: false, error: varsayilan }, { status: 500 })
}

const g = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)
const BEKLEYEN = ['BEKLIYOR_YONETICI', 'BEKLIYOR_IV'] as const

async function yillikTurId() {
  const t = await prisma.izinTuru.findUnique({ where: { kod: YILLIK_KOD }, select: { id: true } })
  if (!t) throw new IzinGirdiHatasi('YILLIK izin türü tanımlı değil')
  return t.id
}

// ── Bakiye listesi ───────────────────────────────────────────────────────────

export type BakiyeFiltre = { durum: 'AKTIF' | 'AYRILAN'; departmentId?: string | null; q?: string | null; yakinda?: boolean }

export interface BakiyeSatiri {
  personnelId: string
  sicil: string | null
  adSoyad: string
  departman: string | null
  yaka: string
  ozet: KisiBakiyeOzeti
  acilisVar: boolean
  /** İV override (Personnel.kidemBaslangici); null = otomatik (en eski dönem) */
  kidemOverride: string | null
}

async function bakiyeHesapla(f: BakiyeFiltre) {
  const turId = await yillikTurId()
  const bugun = bugunStr()
  const q = f.q?.trim()
  const ps = await prisma.personnel.findMany({
    where: {
      aktif: f.durum === 'AKTIF',
      ...(f.departmentId ? { departmentId: f.departmentId } : {}),
      ...(q ? { OR: [{ adSoyad: { contains: q, mode: 'insensitive' as const } }, { sicilNo: { contains: q, mode: 'insensitive' as const } }] } : {}),
      // Ayrılanlarda yalnız defteri olanlar (bakiyesi hiç yazılmamış eski ayrılanlar listeyi doldurmasın)
      ...(f.durum === 'AYRILAN' ? { izinBakiyeHareketleri: { some: { turId } } } : {}),
    },
    orderBy: [{ adSoyad: 'asc' }],
    select: {
      id: true, sicilNo: true, adSoyad: true, yakaRengi: true, aktif: true, iseGirisTarihi: true, kidemBaslangici: true, bolum: true,
      department: { select: { name: true } },
      employmentPeriods: { select: { girisTarihi: true, cikisTarihi: true } },
    },
  })
  const ids = ps.map((p) => p.id)
  const [defter, bekleyen, hassas] = await Promise.all([
    prisma.izinBakiyeHareketi.findMany({ where: { turId, personnelId: { in: ids } }, select: { personnelId: true, hareket: true, gun: true, tarih: true } }),
    prisma.izinTalep.findMany({ where: { personnelId: { in: ids }, durum: { in: [...BEKLEYEN] }, turId }, select: { personnelId: true, gunSayisi: true } }),
    prisma.personnelSensitive.findMany({ where: { personnelId: { in: ids }, dogumTarihi: { not: null } }, select: { personnelId: true, dogumTarihi: true } }),
  ])
  const defterBy = new Map<string, DefterSatiri[]>()
  const acilisVar = new Set<string>()
  for (const d of defter) {
    const l = defterBy.get(d.personnelId) ?? []
    l.push({ hareket: d.hareket as IzinHareketTuru, gun: Number(d.gun), tarih: g(d.tarih)! })
    defterBy.set(d.personnelId, l)
    if (d.hareket === 'ACILIS') acilisVar.add(d.personnelId)
  }
  const bekBy = new Map<string, number[]>()
  for (const b of bekleyen) bekBy.set(b.personnelId, [...(bekBy.get(b.personnelId) ?? []), Number(b.gunSayisi)])
  const dogum = new Map(hassas.map((h) => [h.personnelId, g(h.dogumTarihi)]))

  let satirlar: BakiyeSatiri[] = ps.map((p) => ({
    personnelId: p.id,
    sicil: p.sicilNo,
    adSoyad: p.adSoyad,
    departman: p.department?.name ?? p.bolum ?? null,
    yaka: p.yakaRengi,
    acilisVar: acilisVar.has(p.id),
    kidemOverride: g(p.kidemBaslangici),
    ozet: kisiBakiyeOzeti({
      defter: defterBy.get(p.id) ?? [],
      bekleyenGunler: bekBy.get(p.id) ?? [],
      iseGirisTarihi: g(p.iseGirisTarihi)!,
      donemler: p.employmentPeriods.map((d) => ({ giris: g(d.girisTarihi)!, cikis: g(d.cikisTarihi) })),
      kidemOverride: g(p.kidemBaslangici),
      dogumTarihi: dogum.get(p.id) ?? null,
      aktif: p.aktif,
      bugun,
    }),
  }))
  if (f.yakinda) satirlar = satirlar.filter((s) => yakindaMi(s.ozet, bugun)).sort((a, b) => a.ozet.sonraki!.tarih.localeCompare(b.ozet.sonraki!.tarih))
  return { bugun, satirlar }
}

export async function bakiyeListesi(f: BakiyeFiltre) {
  const [{ bugun, satirlar }, ivBekleyen, aktifSayi, departmanlar, gecis] = await Promise.all([
    bakiyeHesapla(f),
    prisma.izinTalep.count({ where: { durum: 'BEKLIYOR_IV' } }),
    prisma.personnel.count({ where: { aktif: true } }),
    prisma.departmentDefinition.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.systemSetting.findUnique({ where: { key: GECIS_TARIHI_AYARI }, select: { value: true } }),
  ])
  const yarimTopla = (xs: number[]) => xs.reduce((t, x) => t + Math.round(x * 2), 0) / 2
  return {
    bugun,
    gecisTarihi: gecis?.value ?? null,
    satirlar,
    departmanlar,
    ozet: {
      aktifPersonel: aktifSayi,
      toplamKalan: yarimTopla(satirlar.map((s) => Math.max(0, s.ozet.kalan))),
      ivOnayiBekleyen: ivBekleyen,
      otuzGunuAsan: satirlar.filter((s) => s.ozet.kalan > 30).length,
    },
  }
}

const YAKA: Record<string, string> = { MAVI: 'Mavi', BEYAZ: 'Beyaz', GRI: 'Gri' }
export const kidemMetni = (o: KisiBakiyeOzeti) => (o.kidemYil >= 1 ? `${o.kidemYil} yıl` : `${o.kidemAy} ay`)

/** Excel (xlsx Buffer). KVKK: dosyaya yazılmaz — yanıt olarak iner; route denetim kaydı yazar. */
export async function bakiyeExcel(f: BakiyeFiltre): Promise<{ buffer: Buffer; satir: number }> {
  const { satirlar } = await bakiyeHesapla(f)
  const rows = satirlar.map((s) => ({
    Sicil: s.sicil ?? '',
    'Ad Soyad': s.adSoyad,
    Departman: s.departman ?? '',
    Yaka: YAKA[s.yaka] ?? s.yaka,
    Kıdem: kidemMetni(s.ozet),
    'Yıllık hak': s.ozet.yillikHak ?? '',
    'Bu yıl kullanılan': s.ozet.kullanilanBuYil,
    Bekleyen: s.ozet.bekleyen,
    Bakiye: s.ozet.bakiye,
    Kalan: s.ozet.kalan,
    'Sonraki hak ediş': s.ozet.sonraki ? `${s.ozet.sonraki.tarih} (+${s.ozet.sonraki.gun})` : '',
    'Açılış yüklendi': s.acilisVar ? 'evet' : '',
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), f.durum === 'AYRILAN' ? 'Ayrılanlar' : 'Bakiyeler')
  return { buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer, satir: rows.length }
}

// ── Hareketler (defter) ──────────────────────────────────────────────────────

export async function kisiHareketleri(personnelId: string) {
  const turId = await yillikTurId()
  const p = await prisma.personnel.findUnique({ where: { id: personnelId }, select: { id: true, sicilNo: true, adSoyad: true, aktif: true } })
  if (!p) throw new IzinGirdiHatasi('Personel bulunamadı')
  const hs = await prisma.izinBakiyeHareketi.findMany({
    where: { personnelId, turId },
    orderBy: [{ tarih: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, hareket: true, gun: true, tarih: true, aciklama: true, olusturanId: true, createdAt: true, talepId: true },
  })
  const kullanicilar = await prisma.user.findMany({
    where: { id: { in: [...new Set(hs.map((h) => h.olusturanId))] } },
    select: { id: true, name: true, email: true },
  })
  const ad = new Map(kullanicilar.map((u) => [u.id, u.name ?? u.email]))
  let yuruyen = 0
  return {
    personel: { id: p.id, sicil: p.sicilNo, adSoyad: p.adSoyad, aktif: p.aktif },
    hareketler: hs.map((h) => {
      yuruyen += Math.round(Number(h.gun) * 2)
      return {
        id: h.id,
        hareket: h.hareket,
        gun: Number(h.gun),
        tarih: g(h.tarih),
        aciklama: h.aciklama,
        olusturan: h.olusturanId === 'sistem' ? 'Sistem' : ad.get(h.olusturanId) ?? h.olusturanId,
        zaman: h.createdAt.toISOString(),
        talepVar: !!h.talepId,
        bakiye: yuruyen / 2,
      }
    }),
  }
}

/** Defter düzeltmesi (izin.bakiye.admin): yeni DUZELTME satırı — defter yalnız EKLENİR. Gerekçe zorunlu. */
export async function duzeltmeYap(personnelId: string, b: Record<string, unknown>, aktorId: string) {
  const n = typeof b.gun === 'string' ? Number(b.gun.replace(',', '.')) : Number(b.gun)
  if (!Number.isFinite(n) || n === 0) throw new IzinGirdiHatasi('Gün sıfırdan farklı bir sayı olmalı (düşmek için eksi)')
  if (Math.abs(n * 2 - Math.round(n * 2)) > 1e-9) throw new IzinGirdiHatasi("Gün 0,5'in katı olmalı")
  if (Math.abs(n) > 100) throw new IzinGirdiHatasi('Tek düzeltme en fazla ±100 gün')
  const gerekce = typeof b.gerekce === 'string' ? b.gerekce.trim() : ''
  if (gerekce.length < 5) throw new IzinGirdiHatasi('Gerekçe zorunlu (en az 5 karakter)')
  if (gerekce.length > 500) throw new IzinGirdiHatasi('Gerekçe en fazla 500 karakter')
  const turId = await yillikTurId()
  const p = await prisma.personnel.findUnique({ where: { id: personnelId }, select: { sicilNo: true } })
  if (!p) throw new IzinGirdiHatasi('Personel bulunamadı')
  const bugun = bugunStr()
  return prisma.$transaction(async (tx) => {
    const h = await tx.izinBakiyeHareketi.create({
      data: { personnelId, turId, hareket: 'DUZELTME', gun: Math.round(n * 2) / 2, tarih: new Date(`${bugun}T00:00:00Z`), aciklama: gerekce, olusturanId: aktorId },
      select: { id: true },
    })
    await logAuditEvent({ tx, action: 'IZIN_BAKIYE_DUZELTILDI', actorId: aktorId, targetType: 'IZIN_BAKIYE', targetId: personnelId, details: { sicil: p.sicilNo, gun: n, gerekce, hareketId: h.id } })
    return h
  })
}

/**
 * Kıdem başlangıcı override (İV): Personnel.kidemBaslangici set/temizle. Yalnız GÖSTERİM kıdemini
 * etkiler; yıllık izin hak edişi daima son işe giriş tarihinden. tarih boş → otomatiğe (en eski dönem)
 * döner. Gerekçe zorunlu; denetime yazılır.
 */
export async function kidemBaslangiciKaydet(personnelId: string, b: Record<string, unknown>, aktorId: string) {
  const ham = typeof b.tarih === 'string' ? b.tarih.trim() : ''
  const gerekce = typeof b.gerekce === 'string' ? b.gerekce.trim() : ''
  if (gerekce.length < 5) throw new IzinGirdiHatasi('Gerekçe zorunlu (en az 5 karakter)')
  if (gerekce.length > 500) throw new IzinGirdiHatasi('Gerekçe en fazla 500 karakter')
  const bugun = bugunStr()
  let tarih: Date | null = null
  if (ham) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ham)) throw new IzinGirdiHatasi('Tarih YYYY-AA-GG olmalı')
    if (ham > bugun) throw new IzinGirdiHatasi('Kıdem başlangıcı bugünden ileri olamaz')
    if (ham < '1950-01-01') throw new IzinGirdiHatasi('Tarih 1950 sonrası olmalı')
    tarih = new Date(`${ham}T00:00:00Z`)
  }
  const p = await prisma.personnel.findUnique({ where: { id: personnelId }, select: { sicilNo: true, kidemBaslangici: true } })
  if (!p) throw new IzinGirdiHatasi('Personel bulunamadı')
  await prisma.$transaction(async (tx) => {
    await tx.personnel.update({ where: { id: personnelId }, data: { kidemBaslangici: tarih } })
    await logAuditEvent({
      tx, action: 'IZIN_KIDEM_DUZELTILDI', actorId: aktorId, targetType: 'PERSONNEL', targetId: personnelId,
      details: { sicil: p.sicilNo, eski: g(p.kidemBaslangici), yeni: ham || null, gerekce },
    })
  })
  return { kidemBaslangici: ham || null }
}

// ── Türler ───────────────────────────────────────────────────────────────────

export async function turListesi() {
  const turler = await prisma.izinTuru.findMany({
    orderBy: [{ aktif: 'desc' }, { sira: 'asc' }, { ad: 'asc' }],
    include: { _count: { select: { talepler: true } } },
  })
  return turler.map(({ _count, ...t }) => ({ ...t, talepSayisi: _count.talepler }))
}

const KOD = /^[A-Z][A-Z0-9_]{1,31}$/
const bool = (v: unknown, varsayilan: boolean) => (v === undefined ? varsayilan : v === true || v === 'true')

/**
 * Şirkete özel tür ekle / düzenle (izin.admin). YASAL türler KİLİTLİ. Şirkete özel tür: bakiyesiz, özel
 * nitelikli DEĞİL (sağlık verisi yalnız yasal RAPOR türünde), PDKS etiketi "İzinli". Kod oluşturulduktan
 * sonra değişmez. Silme yok — pasife alınır (talep geçmişi korunur).
 */
export async function turKaydet(id: string | null, b: Record<string, unknown>, aktorId: string) {
  if (id) {
    const mevcut = await prisma.izinTuru.findUnique({ where: { id }, select: { yasal: true } })
    if (!mevcut) throw new IzinGirdiHatasi('Tür bulunamadı')
    if (mevcut.yasal) throw new IzinGirdiHatasi('Yasal türler değiştirilemez')
  }
  const ad = typeof b.ad === 'string' ? b.ad.trim() : ''
  if (ad.length < 2 || ad.length > 60) throw new IzinGirdiHatasi('Ad 2–60 karakter olmalı')
  const sabitHam = b.sabitGun === '' || b.sabitGun === null || b.sabitGun === undefined ? null : Number(b.sabitGun)
  if (sabitHam !== null && (!Number.isInteger(sabitHam) || sabitHam < 1 || sabitHam > 365)) throw new IzinGirdiHatasi('Sabit gün 1–365 arası tam sayı olmalı (boş = sınırsız)')
  const gunSayimi = b.gunSayimi === 'TAKVIM_GUNU' ? 'TAKVIM_GUNU' : 'IS_GUNU'
  const data = {
    ad,
    sabitGun: sabitHam,
    gunSayimi: gunSayimi as 'IS_GUNU' | 'TAKVIM_GUNU',
    ucretli: bool(b.ucretli, true),
    yarimGunOlur: bool(b.yarimGunOlur, false),
    onayAkisi: 'YONETICI_IV' as const,
    belgeZorunlu: false,
    ozelNitelikli: false,
    bakiyeli: false,
    pdksEtiketi: 'İzinli',
    aktif: bool(b.aktif, true),
    sira: Number.isInteger(Number(b.sira)) ? Number(b.sira) : 100,
  }
  return prisma.$transaction(async (tx) => {
    let t
    if (id) t = await tx.izinTuru.update({ where: { id }, data })
    else {
      const kod = typeof b.kod === 'string' ? b.kod.trim().toUpperCase() : ''
      if (!KOD.test(kod)) throw new IzinGirdiHatasi('Kod büyük harf/rakam/alt çizgi, 2–32 karakter (ör. DOGUM_GUNU)')
      t = await tx.izinTuru.create({ data: { ...data, kod, yasal: false } })
    }
    await logAuditEvent({ tx, action: id ? 'IZIN_TURU_GUNCELLENDI' : 'IZIN_TURU_EKLENDI', actorId: aktorId, targetType: 'IZIN_TURU', targetId: t.id, details: { kod: t.kod, ...data } })
    return t
  })
}
