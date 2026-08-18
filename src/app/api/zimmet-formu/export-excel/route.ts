import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { requireUser } from '@/lib/auth/require-user'
import { requirePermission } from '@/lib/auth/require-permission'

export const dynamic = 'force-dynamic'

const TUR_LABELS: Record<string, string> = {
  NOTEBOOK_BILGISAYAR: 'Notebook Bilgisayar',
  DESKTOP_BILGISAYAR: 'Desktop Bilgisayar',
  CEP_TELEFONU: 'Cep Telefonu',
  EL_TERMINALI: 'El Terminali',
  OFFICE_365: 'Office 365',
  YAZICI: 'Yazıcı',
  MONITOR: 'Monitör',
  MIKROFON: 'Mikrofon',
  DIGER: 'Diğer',
}


const fmtDate = (d: Date | null | undefined): string =>
  d
    ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '-'

export async function GET() {
  try {
    const { error } = await requirePermission('zimmet-formu.view')
    if (error) return error

    const zimmetler = await prisma.zimmetFormu.findMany({
      where: { silindiMi: false },
      orderBy: { createdAt: 'desc' },
      include: {
        zimmetSahibi: { select: { name: true, email: true } },
        createdBy: { select: { name: true, email: true } },
      },
    })

    const sheetData = zimmetler.map((z) => ({
      'Zimmet No': z.id.slice(0, 8),
      'Zimmet Sahibi': z.zimmetSahibi?.name ?? '-',
      'Departman': z.departman ?? '-',
      'Tür': TUR_LABELS[z.tur] ?? z.tur,
      'Marka/Açıklama': z.aciklama ?? '-',
      'Seri Numarası': z.seriNumarasi ?? '-',
      'MAC Adresi': z.macAdresi ?? '-',
      'PC Adı': z.pcAdi ?? '-',
      'Veriliş Tarihi': fmtDate(z.verilisTarihi),
      'Oluşturan': z.createdBy.name ?? '-',
      'Oluşturma Tarihi': fmtDate(z.createdAt),
    }))

    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.json_to_sheet(sheetData)
    sheet['!cols'] = [
      { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 25 },
      { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 15 },
      { wch: 20 }, { wch: 15 },
    ]
    XLSX.utils.book_append_sheet(wb, sheet, 'Zimmet Listesi')

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
    const today = new Date().toISOString().slice(0, 10)
    const fileName = `zimmet-raporu-${today}.xlsx`

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': excelBuffer.length.toString(),
      },
    })
  } catch (err) {
    console.error('[GET /api/zimmet-formu/export-excel]', err)
    return NextResponse.json({ error: 'Excel oluşturulamadı' }, { status: 500 })
  }
}
