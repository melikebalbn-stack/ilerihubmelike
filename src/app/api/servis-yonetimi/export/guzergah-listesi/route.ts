import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import {
  exportDenetimiHatasi,
  exportDenetimiYaz,
  exportYetkisiIste,
} from '@/lib/servis-yonetimi/export-denetim'
import { GUZERGAH_LISTESI_HEADERS, guzergahListesiSatirlariOlustur } from '@/lib/servis-yonetimi/export'

export const dynamic = 'force-dynamic'

// GET /api/servis-yonetimi/export/guzergah-listesi — Excel (.xlsx).
// Tüm güzergahlar (aktif+pasif) — desen: quality/uygunsuzluk/export/route.ts.
// Yetki: servis.view VE servis.export; denetim fail-closed (export-denetim.ts).
export async function GET() {
  const { error, userId } = await exportYetkisiIste()
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
  if (!(await exportDenetimiYaz(userId, { rapor: 'GUZERGAH_LISTESI_EXCEL', format: 'XLSX', satirSayisi: rows.length - 1 }))) {
    return exportDenetimiHatasi()
  }
  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Servis-Listesi-${stamp}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
