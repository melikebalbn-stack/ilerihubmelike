import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

export const dynamic = 'force-dynamic'

function normTr(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\s+/g, ' ').trim()
}

/**
 * GET /api/quality/rma/sorumlu-ara?q= — RMA sorumlu (Personnel) seçici kaynağı.
 * Auth: oturum. Yalnız aktif personel; ad VEYA sicil; app-side TR-normalize. Limit 20.
 * Dönüş {id, code, name} — MusteriSecici ile aynı şekil (code=sicilNo, name=adSoyad).
 */
export async function GET(request: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 1) return NextResponse.json({ items: [] })
  const nq = normTr(q)

  const all = await prisma.personnel.findMany({
    where: { aktif: true },
    select: { id: true, sicilNo: true, adSoyad: true },
  })

  const items = all
    .filter((p) => normTr(p.adSoyad).includes(nq) || normTr(p.sicilNo ?? '').includes(nq))
    .sort((a, b) => a.adSoyad.localeCompare(b.adSoyad, 'tr'))
    .slice(0, 20)
    .map((p) => ({ id: p.id, code: p.sicilNo ?? '—', name: p.adSoyad }))

  return NextResponse.json({ items })
}
