// PR-PERSONNEL-DEPARTMENT-TRANSFER: Tüm bölüm transferlerinin filtreli listesi.
// Query params: from, to (tarih aralığı), bolum (eski VEYA yeni bölümde eşleşir)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import type { Prisma } from '@/generated/prisma'

const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  if (!dept) return false
  const d = dept.toLowerCase()
  return d.includes('insan') || d.includes('human') || d.includes('hr') || d.includes('ik')
}

function hasEditAccess(role: string, department?: string | null): boolean {
  return EDIT_ROLES.includes(role) || isHRDepartment(department)
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasEditAccess(user.role, user.department)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const sp = request.nextUrl.searchParams
    const from = sp.get('from')
    const to = sp.get('to')
    const bolum = sp.get('bolum')

    const where: Prisma.PersonnelDepartmentTransferWhereInput = {}
    if (from || to) {
      where.transferTarihi = {}
      if (from) where.transferTarihi.gte = new Date(from)
      if (to) where.transferTarihi.lte = new Date(to)
    }
    if (bolum) {
      where.OR = [
        { transferEdenBolum: bolum },
        { transferEdilenBolum: bolum },
      ]
    }

    // PR-PERSONNEL-DEPARTMENT-HISTORY: historical filtresi (yeni form only / all / historical only)
    const isHistorical = sp.get('isHistorical')
    if (isHistorical === 'true') where.isHistorical = true
    else if (isHistorical === 'false') where.isHistorical = false

    const transfers = await prisma.personnelDepartmentTransfer.findMany({
      where,
      include: {
        personnel: { select: { id: true, sicilNo: true, adSoyad: true, bolum: true } },
        kayitEden: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ transferTarihi: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 500,
    })

    return NextResponse.json(transfers)
  } catch (err) {
    console.error('Department transfers liste hatası:', err)
    return NextResponse.json({ error: 'Liste yüklenemedi' }, { status: 500 })
  }
}
