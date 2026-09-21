import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { kpiExcelOlustur } from '../excel-sablon'

export async function GET() {
  const wb = kpiExcelOlustur([])
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="kpi-sablon.xlsx"',
    },
  })
}
