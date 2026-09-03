import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERSONEL_ATAMA_LISTESI_HEADERS, personelAtamaListesiSatirlariOlustur } from '@/lib/servis-yonetimi/export'

export const dynamic = 'force-dynamic'

// GET /api/servis-yonetimi/export/personel-atama-listesi — Excel (.xlsx).
// Tüm atamalar (aktif+pasif), tüm güzergahlar genelinde.
//
// KVKK — Personnel'dan YALNIZ adSoyad + sicilNo seçiliyor. Bu select'i
// genişletmeden önce export.ts'teki PERSONEL_ATAMA_LISTESI_HEADERS'ın
// üstündeki notu oku — telefon/adres/bölüm gibi alanlar BİLEREK dışarıda.
export async function GET() {
  const { error } = await requirePermission('servis.export')
  if (error) return error

  const atamalar = await prisma.servisPersonelAtama.findMany({
    orderBy: [{ aktif: 'desc' }, { baslangicTarihi: 'desc' }],
    select: {
      baslangicTarihi: true,
      bitisTarihi: true,
      aktif: true,
      personnel: { select: { adSoyad: true, sicilNo: true } },
      guzergah: { select: { kod: true, ad: true } },
      durak: { select: { kod: true, ad: true } },
      dilimler: { select: { dilim: { select: { kod: true, yon: true } } } },
    },
  })

  const rows = personelAtamaListesiSatirlariOlustur(atamalar)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = PERSONEL_ATAMA_LISTESI_HEADERS.map((h) => ({ wch: Math.max(12, Math.min(40, h.length + 4)) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Personel Atamaları')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer
  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Personel-Atama-Listesi-${stamp}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
