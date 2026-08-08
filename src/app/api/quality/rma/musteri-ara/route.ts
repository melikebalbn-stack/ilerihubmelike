import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

export const dynamic = 'force-dynamic'

/**
 * TR-normalize: küçült (tr-TR) + diakritik/İ-I fold. Prod'da unaccert uzantısı
 * güvenilir değil (kayıt drift'i) → arama UYGULAMA tarafında normalize edilir.
 */
function normTr(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * GET /api/quality/rma/musteri-ara?q= — aranabilir müşteri seçici kaynağı.
 * Auth: oturum. Yalnız isActive. Ad VEYA kod üzerinden; ham + normalize eşleşme. Limit 20.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 1) return NextResponse.json({ items: [] })

  const nq = normTr(q)

  // Aktif müşteriler (740 kayıt) — küçük küme; uygulamada normalize-filtre (unaccent'e bağlanmadan).
  const all = await prisma.costCustomer.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
  })

  const matched = all
    .filter((c) => normTr(c.name).includes(nq) || normTr(c.code).includes(nq))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    .slice(0, 20)

  return NextResponse.json({ items: matched })
}
