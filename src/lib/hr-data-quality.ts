import { prisma } from '@/lib/prisma'
import { YAKA_DETAY_MAP } from '@/lib/personnel-constants'

// Haftalık İK veri kalitesi denetimi. Aktif personel eksik alan + tutarsızlık +
// pasif çıkış nedeni eksikliği. SALT-OKUR (yazma yok). Kategori bazlı sonuç döner;
// boş kategoriler dahil edilmez.

export type AuditRecord = { sicil: string; adSoyad: string; detay: string }
export type AuditCategory = { baslik: string; kayitlar: AuditRecord[] }
export type AuditResult = { kategoriler: AuditCategory[]; toplamSorun: number }

const sc = (s: string | null | undefined) => (s && s.trim() ? s : '(sicil yok)')

export async function runHrDataQualityAudit(): Promise<AuditResult> {
  const kategoriler: AuditCategory[] = []
  const push = (baslik: string, kayitlar: AuditRecord[]) => {
    if (kayitlar.length > 0) kategoriler.push({ baslik, kayitlar })
  }

  // Aktif personel + KVKK (sensitive) + istihdam dönemleri
  const aktif = await prisma.personnel.findMany({
    where: { aktif: true },
    select: {
      sicilNo: true,
      adSoyad: true,
      kanGrubu: true,
      yakaRengi: true,
      yakaDetayi: true,
      bolum: true,
      gorev: true,
      iseGirisTarihi: true,
      sensitive: { select: { tcKimlikNo: true, dogumTarihi: true } },
      employmentPeriods: { select: { cikisTarihi: true } },
    },
  })

  // ── AKTİF PERSONEL EKSİK ALANLAR ──
  push('Aktif — Kan Grubu Boş', aktif
    .filter((p) => !p.kanGrubu)
    .map((p) => ({ sicil: sc(p.sicilNo), adSoyad: p.adSoyad, detay: 'Kan grubu girilmemiş' })))

  push('Aktif — Doğum Tarihi Boş', aktif
    .filter((p) => !p.sensitive?.dogumTarihi)
    .map((p) => ({ sicil: sc(p.sicilNo), adSoyad: p.adSoyad, detay: 'Doğum tarihi yok' })))

  push('Aktif — TC Eksik / Hatalı', aktif
    .filter((p) => { const tc = p.sensitive?.tcKimlikNo?.trim(); return !tc || tc.length !== 11 })
    .map((p) => {
      const tc = p.sensitive?.tcKimlikNo?.trim()
      return { sicil: sc(p.sicilNo), adSoyad: p.adSoyad, detay: !tc ? 'TC boş' : `TC ${tc.length} hane (11 olmalı)` }
    }))

  push('Aktif — Bölüm Boş', aktif
    .filter((p) => !p.bolum?.trim())
    .map((p) => ({ sicil: sc(p.sicilNo), adSoyad: p.adSoyad, detay: 'Bölüm boş' })))

  push('Aktif — Görev Boş', aktif
    .filter((p) => !p.gorev?.trim())
    .map((p) => ({ sicil: sc(p.sicilNo), adSoyad: p.adSoyad, detay: 'Görev boş' })))

  push('Aktif — Yaka Detayı Boş', aktif
    .filter((p) => !p.yakaDetayi)
    .map((p) => ({ sicil: sc(p.sicilNo), adSoyad: p.adSoyad, detay: `Yaka ${p.yakaRengi} ama detay yok` })))

  // sicil no + işe giriş: yalnız eksik varsa kategori oluşur (push zaten boşları eler → gürültü yok)
  push('Aktif — Sicil No Boş', aktif
    .filter((p) => !p.sicilNo?.trim())
    .map((p) => ({ sicil: '(yok)', adSoyad: p.adSoyad, detay: 'Sicil no boş' })))

  push('Aktif — İşe Giriş Tarihi Boş', aktif
    .filter((p) => !p.iseGirisTarihi)
    .map((p) => ({ sicil: sc(p.sicilNo), adSoyad: p.adSoyad, detay: 'İşe giriş tarihi yok' })))

  // ── TUTARSIZLIKLAR ──
  push('Tutarsızlık — Yaka Detayı Uyumsuz', aktif
    .filter((p) => p.yakaDetayi && !(YAKA_DETAY_MAP[p.yakaRengi] ?? []).includes(p.yakaDetayi))
    .map((p) => ({ sicil: sc(p.sicilNo), adSoyad: p.adSoyad, detay: `${p.yakaRengi} + ${p.yakaDetayi} — YAKA_DETAY_MAP dışı` })))

  push('Tutarsızlık — Aktif ama Açık Dönem Yok', aktif
    .filter((p) => !p.employmentPeriods.some((e) => e.cikisTarihi === null))
    .map((p) => ({ sicil: sc(p.sicilNo), adSoyad: p.adSoyad, detay: 'Aktif ama açık EmploymentPeriod (cikisTarihi=null) yok' })))

  // Sicil çakışması — aktif+pasif tüm kayıtlar, sicil(TRIM+UPPER) bazında grupla
  const hepsi = await prisma.personnel.findMany({
    where: { sicilNo: { not: null } },
    select: { sicilNo: true, adSoyad: true, aktif: true },
  })
  const grup = new Map<string, { adSoyad: string; aktif: boolean }[]>()
  for (const p of hepsi) {
    const k = p.sicilNo!.trim().toUpperCase()
    if (!grup.has(k)) grup.set(k, [])
    grup.get(k)!.push({ adSoyad: p.adSoyad, aktif: p.aktif })
  }
  const cakisma: AuditRecord[] = []
  for (const [sicil, arr] of grup) {
    if (arr.length > 1) {
      for (const r of arr) {
        cakisma.push({ sicil, adSoyad: r.adSoyad, detay: `Aynı sicilde ${arr.length} kayıt (${r.aktif ? 'aktif' : 'pasif'})` })
      }
    }
  }
  push('Tutarsızlık — Sicil Çakışması', cakisma)

  // ── PASİF ÇIKIŞ NEDENİ EKSİK ──
  const pasif = await prisma.personnel.findMany({
    where: { aktif: false },
    select: {
      sicilNo: true,
      adSoyad: true,
      employmentPeriods: {
        where: { cikisTarihi: { not: null } },
        select: { exitReason: true, exitParty: true, exitTurnoverType: true },
      },
    },
  })
  const pasifEksik: AuditRecord[] = []
  for (const p of pasif) {
    if (p.employmentPeriods.length === 0) continue // kapalı dönemi yok → kontrol dışı
    const eksik = p.employmentPeriods.find(
      (e) => !e.exitReason?.trim() || !e.exitParty?.trim() || !e.exitTurnoverType?.trim()
    )
    if (eksik) {
      const alanlar = [
        !eksik.exitReason?.trim() && 'neden',
        !eksik.exitParty?.trim() && 'taraf',
        !eksik.exitTurnoverType?.trim() && 'devir tipi',
      ].filter(Boolean).join(', ')
      pasifEksik.push({ sicil: sc(p.sicilNo), adSoyad: p.adSoyad, detay: `Çıkış bilgisi eksik: ${alanlar}` })
    }
  }
  push('Pasif — Çıkış Nedeni Eksik', pasifEksik)

  const toplamSorun = kategoriler.reduce((s, k) => s + k.kayitlar.length, 0)
  return { kategoriler, toplamSorun }
}
