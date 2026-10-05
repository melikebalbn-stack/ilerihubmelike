// GET /api/personnel/eski-kayit-ara?adSoyad=…&tcKimlikNo=…
//
// "Bu kişi daha önce çalışmış mı?" — personel EKLEME formunun yardımcı ucu.
// Yalnız PASİF (ayrılmış) kayıtlarda arar; aktif biri zaten kadroda olduğu için
// yeniden işe alım konusu değildir (aktif mükerrer uyarısı ayrı iş).
//
// EŞLEŞME: TC tam eşleşme (PersonnelSensitive.tcKimlikNo) VEYA ad-soyad
// TR-normalize tam eşleşme. TC prod'da pasif kayıtların yalnız %57'sinde dolu
// (05.10 ölçümü) — bu yüzden ad-soyad yolu ŞART, tek başına TC yetmez.
//
// KVKK: yanıtta TC/hassas alan DÖNMEZ. Yalnız "eşleşti" bilgisi + kadro alanları
// (sicil, ad, bölüm, görev, giriş/çıkış tarihi) döner; bunlar İV'nin zaten
// gördüğü alanlar. Erişim personel POST'uyla AYNI kapı.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'
import { normalizeTr } from '@/lib/normalize-tr'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

export type EskiKayitEslesmesi = {
  id: string
  sicilNo: string | null
  adSoyad: string
  bolum: string | null
  gorev: string | null
  yakaRengi: string | null
  iseGirisTarihi: string | null
  cikisTarihi: string | null
  /** 'TC' | 'AD' — eşleşmenin hangi alandan geldiği (ekranda gösterilir). */
  eslesme: 'TC' | 'AD'
}

function ad(s: string): string {
  return normalizeTr(s).replace(/\s+/g, ' ').trim()
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!(ALLOWED_ROLES.includes(user.role) || isInsanVarliklari(user.department))) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const sp = request.nextUrl.searchParams
    const adSoyad = (sp.get('adSoyad') ?? '').trim()
    const tcKimlikNo = (sp.get('tcKimlikNo') ?? '').trim()
    // Çok kısa girdide arama yapma (her tuşta tüm pasif kadroyu taramasın).
    if (adSoyad.length < 3 && tcKimlikNo.length !== 11) {
      return NextResponse.json({ eslesmeler: [] })
    }

    // TC yolu: hassas tabloda tam eşleşme → personnelId kümesi.
    let tcPersonnelIdler: string[] = []
    if (tcKimlikNo.length === 11) {
      const rows = await prisma.personnelSensitive.findMany({
        where: { tcKimlikNo },
        select: { personnelId: true },
      })
      tcPersonnelIdler = rows.map((r) => r.personnelId)
    }

    // Ad yolu: normalize karşılaştırma SQL'de yapılamıyor (normalizeTr JS tarafı),
    // bu yüzden pasif kadro çekilip bellekte süzülür. Pasif kayıt ~1.2k satır,
    // yalnız kadro alanları seçiliyor — ölçülü.
    const pasifler = await prisma.personnel.findMany({
      where: { aktif: false },
      select: {
        id: true,
        sicilNo: true,
        adSoyad: true,
        bolum: true,
        gorev: true,
        yakaRengi: true,
        iseGirisTarihi: true,
      },
      orderBy: { adSoyad: 'asc' },
    })

    const hedefAd = adSoyad ? ad(adSoyad) : ''
    const secilen = pasifler.filter(
      (p) =>
        tcPersonnelIdler.includes(p.id) || (hedefAd.length >= 3 && ad(p.adSoyad) === hedefAd),
    )
    if (secilen.length === 0) return NextResponse.json({ eslesmeler: [] })

    // Çıkış tarihi: en son KAPALI dönemden (Personnel.exit* alanları DROP edildi,
    // tek kaynak EmploymentPeriod).
    const donemler = await prisma.employmentPeriod.findMany({
      where: { personnelId: { in: secilen.map((p) => p.id) }, cikisTarihi: { not: null } },
      select: { personnelId: true, cikisTarihi: true },
      orderBy: { cikisTarihi: 'desc' },
    })
    const sonCikis = new Map<string, Date>()
    for (const d of donemler) {
      if (!sonCikis.has(d.personnelId) && d.cikisTarihi) sonCikis.set(d.personnelId, d.cikisTarihi)
    }

    const eslesmeler: EskiKayitEslesmesi[] = secilen.map((p) => ({
      id: p.id,
      sicilNo: p.sicilNo,
      adSoyad: p.adSoyad,
      bolum: p.bolum,
      gorev: p.gorev,
      yakaRengi: p.yakaRengi,
      iseGirisTarihi: p.iseGirisTarihi ? p.iseGirisTarihi.toISOString().slice(0, 10) : null,
      cikisTarihi: sonCikis.get(p.id)?.toISOString().slice(0, 10) ?? null,
      eslesme: tcPersonnelIdler.includes(p.id) ? 'TC' : 'AD',
    }))

    // TC eşleşmesi önce (daha güçlü kanıt), sonra çıkış tarihi yeniden eskiye.
    eslesmeler.sort((a, b) => {
      if (a.eslesme !== b.eslesme) return a.eslesme === 'TC' ? -1 : 1
      return (b.cikisTarihi ?? '').localeCompare(a.cikisTarihi ?? '')
    })

    return NextResponse.json({ eslesmeler })
  } catch (err) {
    console.error('Eski kayıt arama hatası:', err)
    return NextResponse.json({ error: 'Arama başarısız' }, { status: 500 })
  }
}
