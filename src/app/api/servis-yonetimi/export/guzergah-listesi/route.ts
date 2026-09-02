import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { GUZERGAH_LISTESI_HEADERS, guzergahListesiSatirlariOlustur } from '@/lib/servis-yonetimi/export'

export const dynamic = 'force-dynamic'

// GET /api/servis-yonetimi/export/guzergah-listesi — Excel (.xlsx).
// Tüm güzergahlar (aktif+pasif) — desen: quality/uygunsuzluk/export/route.ts.
export async function GET() {
  const { error } = await requirePermission('servis.export')
  if (error) return error

  const guzergahlar = await prisma.servisGuzergah.findMany({
    orderBy: [{ kod: 'asc' }],
    include: {
      yerleske: { select: { kod: true, ad: true } },
      _count: { select: { duraklar: { where: { aktif: true } } } },
    },
  })

  const rows = guzergahListesiSatirlariOlustur(guzergahlar)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = GUZERGAH_LISTESI_HEADERS.map((h) => ({ wch: Math.max(10, Math.min(40, h.length + 4)) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Servis Listesi')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer
  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Servis-Listesi-${stamp}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
