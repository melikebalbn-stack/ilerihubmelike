import 'server-only'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit-log'
import { PdksGirdiHatasi } from './cihaz-yonetim'
import { GUN_DESENI, dbGun, gunEkle } from './puantaj-servis'

/**
 * /pdks/vardiyalar servisi (pdks.manage). Vardiya + mola tanımları ve tarih aralıklı kişi ataması.
 * Atama kuralı: yeni atamadan ÖNCE başlamış ve yeni başlangıca uzanan atama, yeni başlangıçtan bir gün
 * önce KAPATILIR. Yeni başlangıçla AYNI GÜN ya da SONRA başlayan mevcut atama varsa kişi ATLANIR (rapor).
 */

const SAAT = /^([01]\d|2[0-3]):[0-5]\d$/
const saat = (v: unknown, ad: string) => {
  if (typeof v !== 'string' || !SAAT.test(v)) throw new PdksGirdiHatasi(`${ad} "HH:mm" olmalı`)
  return v
}
const dk = (v: unknown, ad: string) => {
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 180) throw new PdksGirdiHatasi(`${ad} 0-180 dk arasında tam sayı olmalı`)
  return n
}
const metin = (v: unknown, ad: string, max = 80) => {
  if (typeof v !== 'string' || !v.trim()) throw new PdksGirdiHatasi(`${ad} zorunlu`)
  if (v.trim().length > max) throw new PdksGirdiHatasi(`${ad} en fazla ${max} karakter`)
  return v.trim()
}
const gun = (v: unknown, ad: string) => {
  if (typeof v !== 'string' || !GUN_DESENI.test(v)) throw new PdksGirdiHatasi(`${ad} YYYY-MM-DD olmalı`)
  return v
}
const YAKA = ['BEYAZ', 'MAVI', 'HEPSI'] as const
const TUR = ['YEMEK', 'CAY'] as const

// ── Liste ────────────────────────────────────────────────────────────────────

export async function vardiyaEkrani() {
  const bugun = dbGun(new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10))
  const [vardiyalar, atamalar, departmanlar] = await Promise.all([
    prisma.pdksVardiya.findMany({
      orderBy: [{ aktif: 'desc' }, { sira: 'asc' }],
      include: {
        molalar: { orderBy: [{ tur: 'asc' }, { baslangic: 'asc' }], include: { department: { select: { name: true } } } },
        _count: { select: { atamalar: true } },
      },
    }),
    prisma.pdksPersonelVardiya.findMany({
      where: { OR: [{ bitis: null }, { bitis: { gte: bugun } }] },
      orderBy: [{ baslangic: 'desc' }],
      take: 1000,
      select: {
        id: true, baslangic: true, bitis: true, vardiya: { select: { kod: true } },
        personnel: { select: { sicilNo: true, adSoyad: true, department: { select: { name: true } } } },
      },
    }),
    prisma.departmentDefinition.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  return {
    vardiyalar,
    atamalar: atamalar.map((a) => ({
      id: a.id, vardiya: a.vardiya.kod, sicil: a.personnel.sicilNo, adSoyad: a.personnel.adSoyad,
      departman: a.personnel.department?.name ?? null,
      baslangic: a.baslangic.toISOString().slice(0, 10), bitis: a.bitis?.toISOString().slice(0, 10) ?? null,
    })),
    departmanlar,
  }
}

// ── Vardiya ──────────────────────────────────────────────────────────────────

export async function vardiyaKaydet(id: string | null, b: Record<string, unknown>, aktorId: string) {
  const yakaTipi = (b.yakaTipi ?? 'HEPSI') as (typeof YAKA)[number]
  if (!YAKA.includes(yakaTipi)) throw new PdksGirdiHatasi('Yaka tipi BEYAZ / MAVI / HEPSI olmalı')
  const data = {
    ad: metin(b.ad, 'Ad'),
    girisSaat: saat(b.girisSaat, 'Giriş saati'),
    cikisSaat: saat(b.cikisSaat, 'Çıkış saati'),
    gunDonumSaat: saat(b.gunDonumSaat, 'Gün dönüm saati'),
    yakaTipi,
    gecToleransDk: dk(b.gecToleransDk ?? 0, 'Geç giriş toleransı'),
    erkenToleransDk: dk(b.erkenToleransDk ?? 0, 'Erken çıkış toleransı'),
    varsayilan: Boolean(b.varsayilan),
    aktif: b.aktif === undefined ? true : Boolean(b.aktif),
    sira: Number.isInteger(Number(b.sira)) ? Number(b.sira) : 0,
  }
  // Gün dönümü vardiya penceresinin İÇİNDE olamaz (olay yanlış güne yazılırdı).
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))
  const g = m(data.girisSaat), c = m(data.cikisSaat), d = m(data.gunDonumSaat)
  const icinde = c > g ? d > g && d < c : d > g || d < c
  if (icinde) throw new PdksGirdiHatasi('Gün dönüm saati vardiya saatleri ARASINDA olamaz (ör. 07–17 için 04:00; 21–07 için 12:00)')

  return prisma.$transaction(async (tx) => {
    if (data.varsayilan && data.aktif) {
      await tx.pdksVardiya.updateMany({ where: { yakaTipi, varsayilan: true, ...(id ? { id: { not: id } } : {}) }, data: { varsayilan: false } })
    }
    const v = id
      ? await tx.pdksVardiya.update({ where: { id }, data })
      : await tx.pdksVardiya.create({ data: { ...data, kod: metin(b.kod, 'Kod', 32).toUpperCase() } })
    await logAuditEvent({ tx, action: id ? 'PDKS_VARDIYA_UPDATED' : 'PDKS_VARDIYA_CREATED', actorId: aktorId, targetType: 'PDKS_VARDIYA', targetId: v.id, details: { kod: v.kod, ...data } })
    return v
  })
}

// ── Mola ─────────────────────────────────────────────────────────────────────

export async function molaKaydet(id: string | null, b: Record<string, unknown>, aktorId: string) {
  const tur = b.tur as (typeof TUR)[number]
  if (!TUR.includes(tur)) throw new PdksGirdiHatasi('Mola türü YEMEK veya CAY olmalı')
  const data = {
    tur,
    baslangic: saat(b.baslangic, 'Başlangıç'),
    bitis: saat(b.bitis, 'Bitiş'),
    dusulur: Boolean(b.dusulur),
    departmentId: typeof b.departmentId === 'string' && b.departmentId ? b.departmentId : null,
    aktif: b.aktif === undefined ? true : Boolean(b.aktif),
  }
  if (data.baslangic === data.bitis) throw new PdksGirdiHatasi('Başlangıç ve bitiş aynı olamaz')
  const mola = id
    ? await prisma.pdksVardiyaMola.update({ where: { id }, data })
    : await prisma.pdksVardiyaMola.create({ data: { ...data, vardiyaId: metin(b.vardiyaId, 'Vardiya') } })
  await logAuditEvent({ action: id ? 'PDKS_MOLA_UPDATED' : 'PDKS_MOLA_CREATED', actorId: aktorId, targetType: 'PDKS_VARDIYA', targetId: mola.vardiyaId, details: { molaId: mola.id, ...data } })
  return mola
}

export async function molaSil(id: string, aktorId: string) {
  const m = await prisma.pdksVardiyaMola.delete({ where: { id } })
  await logAuditEvent({ action: 'PDKS_MOLA_DELETED', actorId: aktorId, targetType: 'PDKS_VARDIYA', targetId: m.vardiyaId, details: { molaId: id, tur: m.tur, baslangic: m.baslangic, bitis: m.bitis } })
}

// ── Atama ────────────────────────────────────────────────────────────────────

export async function atamaYap(b: Record<string, unknown>, aktorId: string) {
  const vardiyaId = metin(b.vardiyaId, 'Vardiya')
  const baslangic = gun(b.baslangic, 'Başlangıç')
  const bitis = b.bitis ? gun(b.bitis, 'Bitiş') : null
  if (bitis && bitis < baslangic) throw new PdksGirdiHatasi('Bitiş başlangıçtan önce olamaz')
  const v = await prisma.pdksVardiya.findUnique({ where: { id: vardiyaId }, select: { aktif: true, kod: true } })
  if (!v?.aktif) throw new PdksGirdiHatasi('Vardiya bulunamadı ya da pasif')

  let personelIdleri: string[]
  if (typeof b.personnelId === 'string' && b.personnelId) personelIdleri = [b.personnelId]
  else if (typeof b.departmentId === 'string' && b.departmentId) {
    personelIdleri = (await prisma.personnel.findMany({ where: { aktif: true, departmentId: b.departmentId }, select: { id: true } })).map((p) => p.id)
    if (!personelIdleri.length) throw new PdksGirdiHatasi('Bu departmanda aktif personel yok')
  } else throw new PdksGirdiHatasi('Personel ya da departman seçilmeli')

  const onceki = gunEkle(baslangic, -1)
  return prisma.$transaction(async (tx) => {
    const mevcut = await tx.pdksPersonelVardiya.findMany({
      where: { personnelId: { in: personelIdleri }, OR: [{ bitis: null }, { bitis: { gte: dbGun(baslangic) } }] },
      select: { id: true, personnelId: true, baslangic: true, personnel: { select: { sicilNo: true } } },
    })
    const atlanan = new Map<string, string>()
    for (const m of mevcut) if (m.baslangic >= dbGun(baslangic)) atlanan.set(m.personnelId, m.personnel.sicilNo ?? m.personnelId)
    const kapatilacak = mevcut.filter((m) => m.baslangic < dbGun(baslangic) && !atlanan.has(m.personnelId))
    if (kapatilacak.length) {
      await tx.pdksPersonelVardiya.updateMany({ where: { id: { in: kapatilacak.map((k) => k.id) } }, data: { bitis: dbGun(onceki) } })
    }
    const atanacak = personelIdleri.filter((id) => !atlanan.has(id))
    if (atanacak.length) {
      await tx.pdksPersonelVardiya.createMany({
        data: atanacak.map((personnelId) => ({ personnelId, vardiyaId, baslangic: dbGun(baslangic), bitis: bitis ? dbGun(bitis) : null, createdById: aktorId })),
      })
    }
    await logAuditEvent({
      tx, action: 'PDKS_ATAMA_YAPILDI', actorId: aktorId, targetType: 'PDKS_VARDIYA', targetId: vardiyaId,
      details: { vardiya: v.kod, baslangic, bitis, departmentId: b.departmentId ?? null, atanan: atanacak.length, kapatilan: kapatilacak.length, atlanan: [...atlanan.values()] },
    })
    return { atanan: atanacak.length, kapatilan: kapatilacak.length, atlanan: [...atlanan.values()] }
  })
}

export async function atamaSil(id: string, aktorId: string) {
  const a = await prisma.pdksPersonelVardiya.delete({ where: { id }, include: { personnel: { select: { sicilNo: true } }, vardiya: { select: { kod: true } } } })
  await logAuditEvent({ action: 'PDKS_ATAMA_SILINDI', actorId: aktorId, targetType: 'PDKS_VARDIYA', targetId: a.vardiyaId, details: { sicil: a.personnel.sicilNo, vardiya: a.vardiya.kod, baslangic: a.baslangic.toISOString().slice(0, 10) } })
}
