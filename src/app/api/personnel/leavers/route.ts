// PR-PERSONNEL-LEAVERS-LIST + PR-EXIT-READ-FROM-PERIODS:
// Ayrılan personel raporlaması artık EmploymentPeriod (dönem) bazlı.
// Kapalı dönemi (cikisTarihi != null) olan HER dönem bir satırdır — bir kişinin
// birden çok çıkışı varsa hepsi ayrı satır (İK çıkış-giriş geçmişini görür).
//
// DURUM: bir kapalı dönemin cikisTarihi'nden sonra aynı personelin başka bir
// dönemi (yeni giriş) varsa → REENTRY (Çıkış-Giriş, kişi geri dönmüş).
// Yoksa → LEFT (gerçek ayrılma).
//
// Filtreler: from/to (cikisTarihi aralığı), bolum (personnel.bolum), taraf
// (dönem exitParty), tip (dönem exitTurnoverType), q (personnel ad/sicil).
// Çalışma süresi runtime hesaplanır — dönem girisTarihi→cikisTarihi.
// Personnel.exit* / aktif filtresi TAMAMEN kalktı (PR-4'te alanlar da düşecek).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'
import type { Prisma } from '@/generated/prisma'

const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  return isInsanVarliklari(dept)
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

    // Kapalı dönem = çıkış yapılmış dönem
    const cikisFilter: Prisma.DateTimeNullableFilter = { not: null }
    if (from) cikisFilter.gte = new Date(from)
    if (to) cikisFilter.lte = new Date(to)

    const where: Prisma.EmploymentPeriodWhereInput = {
      cikisTarihi: cikisFilter,
    }
    if (taraf) where.exitParty = taraf
    if (tip) where.exitTurnoverType = tip

    const personnelFilter: Prisma.PersonnelWhereInput = {}
    if (bolum) personnelFilter.bolum = bolum
    if (q) {
      personnelFilter.OR = [
        { adSoyad: { contains: q, mode: 'insensitive' } },
        { sicilNo: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (Object.keys(personnelFilter).length > 0) {
      where.personnel = personnelFilter
    }

    const closedPeriods = await prisma.employmentPeriod.findMany({
      where,
      select: {
        id: true,
        girisTarihi: true,
        cikisTarihi: true,
        exitParty: true,
        exitCode: true,
        exitReason: true,
        exitRootCause: true,
        exitTurnoverType: true,
        exitGeneralNote: true,
        exitRecordedAt: true,
        exitRecordedById: true,
        personnelId: true,
        personnel: {
          select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true, aktif: true },
        },
      },
      orderBy: { cikisTarihi: 'desc' },
    })

    // DURUM için: satırdaki personellerin TÜM dönemlerini çek (filtreden bağımsız),
    // kişi başına grupla → N+1 yok.
    const personnelIds = [...new Set(closedPeriods.map((p) => p.personnelId))]
    const allPeriods = personnelIds.length
      ? await prisma.employmentPeriod.findMany({
          where: { personnelId: { in: personnelIds } },
          select: { personnelId: true, girisTarihi: true, cikisTarihi: true },
        })
      : []
    const periodsByPerson = new Map<string, { giris: Date; cikis: Date | null }[]>()
    for (const p of allPeriods) {
      const arr = periodsByPerson.get(p.personnelId) ?? []
      arr.push({ giris: p.girisTarihi, cikis: p.cikisTarihi })
      periodsByPerson.set(p.personnelId, arr)
    }

    // Bu kapalı dönemin çıkışından SONRA yeni giriş (girisTarihi >= cikisTarihi) var mı?
    // Kişinin kendi dönemi P: P.giris < P.cikis olduğundan self-match imkânsız.
    function statusOf(personnelId: string, cikis: Date): 'LEFT' | 'REENTRY' {
      const periods = periodsByPerson.get(personnelId) ?? []
      const cikisTs = new Date(cikis).getTime()
      const hasLater = periods.some((row) => new Date(row.giris).getTime() >= cikisTs)
      return hasLater ? 'REENTRY' : 'LEFT'
    }

    // Kayıt-eden ismini tek sorguda çöz (exitRecordedById düz string, relation yok).
    const recorderIds = [
      ...new Set(closedPeriods.map((p) => p.exitRecordedById).filter((x): x is string => !!x)),
    ]
    const recorders = recorderIds.length
      ? await prisma.user.findMany({
          where: { id: { in: recorderIds } },
          select: { id: true, name: true, email: true },
        })
      : []
    const recorderMap = new Map(recorders.map((u) => [u.id, u]))

    const rows = closedPeriods.map((p) => {
      const rec = p.exitRecordedById ? recorderMap.get(p.exitRecordedById) : null
      const cikis = p.cikisTarihi as Date // where garantiler: not null
      return {
        periodId: p.id,
        personnelId: p.personnelId,
        sicilNo: p.personnel.sicilNo,
        adSoyad: p.personnel.adSoyad,
        bolum: p.personnel.bolum,
        gorev: p.personnel.gorev,
        aktif: p.personnel.aktif,
        girisTarihi: p.girisTarihi,
        cikisTarihi: p.cikisTarihi,
        exitParty: p.exitParty,
        exitCode: p.exitCode,
        exitReason: p.exitReason,
        exitRootCause: p.exitRootCause,
        exitTurnoverType: p.exitTurnoverType,
        exitGeneralNote: p.exitGeneralNote,
        exitRecordedAt: p.exitRecordedAt,
        exitRecordedBy: rec ? { name: rec.name, email: rec.email } : null,
        workingPeriod: workingPeriodMonths(new Date(p.girisTarihi), new Date(cikis)),
        status: statusOf(p.personnelId, cikis),
      }
    })

    return NextResponse.json(rows)
  } catch (err) {
    console.error('Leavers GET hatası:', err)
    return NextResponse.json({ error: 'Liste yüklenemedi' }, { status: 500 })
  }
}
