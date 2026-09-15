import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// KPI modülünün kapsadığı departmanların ortak üst birimi (Genel Müdür'e
// bağlı Müdürlükler) — bkz. sohbette bulunan OrgUnit ağacı.
const UST_BIRIM_ID = 'cmrzg1kqr00027jpe7y4egyt9'

export async function GET() {
  const departmanlar = await prisma.orgUnit.findMany({
    where: { parentId: UST_BIRIM_ID, unitType: 'DEPARTMENT', isActive: true },
    select: { id: true, name: true },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json({ departmanlar })
}
