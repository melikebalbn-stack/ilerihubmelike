// PR-PERSONNEL-LEAVERS-LIST: Ayrılan personel raporlama.
// Aktif=false + exitDate IS NOT NULL (reactivate edilenler exit'i null'lar,
// bu liste'de görünmezler).
//
// Filtreler: from/to (exitDate aralığı), bolum, taraf (exitParty), tip
// (exitTurnoverType), q (ad/sicil contains insensitive).
// Çalışma süresi runtime hesaplanır — drift önler (PR-PERSONEL-CIKIS-FORMU
// helper'ı ile tutarlı manuel ay hesabı).

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

function hasAccess(role: string, department?: string | null): boolean {
  return EDIT_ROLES.includes(role) || isHRDepartment(department)
}

function workingPeriodMonths(start: Date, end: Date): { years: number; months: number; totalMonths: number } | null {
  let total = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) total -= 1
  if (total < 0) return null
  return { years: Math.floor(total / 12), months: total % 12, totalMonths: total }
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasAccess(user.role, user.department)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const sp = request.nextUrl.searchParams
    const from = sp.get('from')
    const to = sp.get('to')
    const bolum = sp.get('bolum')
    const taraf = sp.get('taraf')
    const tip = sp.get('tip')
    const q = sp.get('q')?.trim()

    const exitDateFilter: Prisma.DateTimeNullableFilter = { not: null }
    if (from) exitDateFilter.gte = new Date(from)
    if (to) exitDateFilter.lte = new Date(to)

    const where: Prisma.PersonnelWhereInput = {
      aktif: false,
      exitDate: exitDateFilter,
    }
    if (bolum) where.bolum = bolum
    if (taraf) where.exitParty = taraf
    if (tip) where.exitTurnoverType = tip
    if (q) {
      where.OR = [
        { adSoyad: { contains: q, mode: 'insensitive' } },
        { sicilNo: { contains: q, mode: 'insensitive' } },
      ]
    }

    const leavers = await prisma.personnel.findMany({
      where,
      select: {
        id: true,
        sicilNo: true,
        adSoyad: true,
        bolum: true,
        gorev: true,
        iseGirisTarihi: true,
        exitDate: true,
        exitParty: true,
        exitCode: true,
        exitReason: true,
        exitRootCause: true,
        exitTurnoverType: true,
        exitGeneralNote: true,
        exitRecordedAt: true,
        exitRecordedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { exitDate: 'desc' },
    })

    const enriched = leavers.map((l) => ({
      ...l,
      workingPeriod:
        l.iseGirisTarihi && l.exitDate
          ? workingPeriodMonths(new Date(l.iseGirisTarihi), new Date(l.exitDate))
          : null,
    }))

    return NextResponse.json(enriched)
  } catch (err) {
    console.error('Leavers GET hatası:', err)
    return NextResponse.json({ error: 'Liste yüklenemedi' }, { status: 500 })
  }
}
