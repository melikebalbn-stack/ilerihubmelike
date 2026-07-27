import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

// Sıradaki ILR- sicil numarası önerisi.
// TÜM personelde (aktif + pasif/ayrılmış — hepsi sicilNo tutar, unique) en büyük
// ILR-NNNNN sayısal değerini bulup +1 önerir, 5 hane sıfır dolgulu.
// Sadece öneridir; İK dönen personel için eski numarayı elle girebilir.
export async function GET() {
  const { user, error } = await requireUser()
  if (error) return error
  // Personel oluşturma ile AYNI yetki (route.ts hasPersonnelAccess deseni).
  if (!(ALLOWED_ROLES.includes(user.role) || isInsanVarliklari(user.department))) {
    return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
  }

  // ILR- ile başlayan tüm sicilleri çek, sayısal kısmı JS'te maksimize et
  // (string sıralama sıfır-dolgusuz/legacy formatlarda yanıltır; sayısal güvenli).
  const rows = await prisma.personnel.findMany({
    where: { sicilNo: { startsWith: 'ILR-' } },
    select: { sicilNo: true },
  })
  let max = 0
  for (const r of rows) {
    const m = /^ILR-(\d+)$/.exec(r.sicilNo ?? '')
    if (m) {
      const n = parseInt(m[1], 10)
      if (Number.isFinite(n) && n > max) max = n
    }
  }
  const nextSicil = `ILR-${String(max + 1).padStart(5, '0')}`
  return NextResponse.json({ nextSicil, currentMax: max })
}
