import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { kpiExcelOlustur } from '../excel-sablon'

export const dynamic = 'force-dynamic'

// GET: boş KPI Excel şablonu indir. Salt okuma → kpi.view∨manage.
export async function GET() {
  const { error } = await requirePermission([PERMISSION_KEYS.KPI_VIEW, PERMISSION_KEYS.KPI_MANAGE])
  if (error) return error

  const wb = kpiExcelOlustur([])
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="kpi-sablon.xlsx"',
    },
  })
}
