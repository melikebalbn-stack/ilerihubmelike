// PR-PERSONNEL-DEPARTMENT-TRANSFER: Tek personelin bölüm değişiklik akışı.
//
// POST: yeni transfer kaydı. Transaction'da:
//   1. PersonnelDepartmentTransfer create
//   2. Personnel.bolum yeni bölümle güncelle
//   3. permission_audit_log PERSONNEL_DEPARTMENT_TRANSFER kaydı
//
// GET: bu personelin tüm geçmiş transferleri (desc).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'

const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  return isInsanVarliklari(dept)
}

function hasEditAccess(role: string, department?: string | null): boolean {
  return EDIT_ROLES.includes(role) || isHRDepartment(department)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasEditAccess(user.role, user.department)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const personnel = await prisma.personnel.findUnique({ where: { id } })
    if (!personnel) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }
    if (!personnel.aktif) {
      return NextResponse.json(
        { error: 'Pasif personelin bölümü değiştirilemez' },
        { status: 400 }
      )
    }

    // Validation
    const required = ['talepTarihi', 'talepEden', 'isgOnayi', 'doktorOnayi', 'transferEdilenBolum', 'transferTarihi']
    const missing = required.filter((k) => !body[k] || String(body[k]).trim() === '')
    if (missing.length > 0) {
      return NextResponse.json({ error: 'Zorunlu alan eksik', missing }, { status: 400 })
    }
    if (!Array.isArray(body.gerekceler) || body.gerekceler.length === 0) {
      return NextResponse.json({ error: 'En az bir gerekçe seçilmeli' }, { status: 400 })
    }
    if (String(body.transferEdilenBolum).trim() === (personnel.bolum ?? '').trim()) {
      return NextResponse.json(
        { error: 'Yeni bölüm mevcut bölümle aynı olamaz' },
        { status: 400 }
      )
    }

    const oldDepartment = personnel.bolum ?? '(belirtilmemiş)'
    const newDepartment = String(body.transferEdilenBolum).trim()

    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.personnelDepartmentTransfer.create({
        data: {
          personnelId: personnel.id,
          talepTarihi: new Date(body.talepTarihi),
          talepEden: body.talepEden,
          isgOnayi: body.isgOnayi,
          doktorOnayi: body.doktorOnayi,
          gerekceler: body.gerekceler,
          gerekceAciklamasi: body.gerekceAciklamasi || null,
          gerekceDigerKisi: body.gerekceDigerKisi || null,
          gerekceDigerIs: body.gerekceDigerIs || null,
          transferEdenBolum: oldDepartment,
          transferEdilenBolum: newDepartment,
          transferTarihi: new Date(body.transferTarihi),
          kayitEdenId: user.id,
        },
      })

      await tx.personnel.update({
        where: { id: personnel.id },
        data: { bolum: newDepartment, updatedAt: new Date() },
      })

      await tx.permissionAuditLog.create({
        data: {
          action: 'PERSONNEL_DEPARTMENT_TRANSFER',
          actorId: user.id,
          targetType: 'PERSONNEL',
          targetId: personnel.id,
          details: {
            actorEmail: user.email,
            personnelSicilNo: personnel.sicilNo,
            personnelName: personnel.adSoyad,
            oldDepartment,
            newDepartment,
            transferDate: transfer.transferTarihi?.toISOString() ?? null,
            talepEden: transfer.talepEden,
            isgOnayi: transfer.isgOnayi,
            doktorOnayi: transfer.doktorOnayi,
            gerekceler: transfer.gerekceler,
            transferId: transfer.id,
          },
        },
      })

      return transfer
    })

    return NextResponse.json({ ok: true, transfer: result })
  } catch (err) {
    console.error('Department transfer POST hatası:', err)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasEditAccess(user.role, user.department)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const { id } = await params

    const transfers = await prisma.personnelDepartmentTransfer.findMany({
      where: { personnelId: id },
      include: { kayitEden: { select: { id: true, name: true, email: true } } },
      orderBy: { transferTarihi: 'desc' },
    })

    return NextResponse.json(transfers)
  } catch (err) {
    console.error('Department transfer GET hatası:', err)
    return NextResponse.json({ error: 'Geçmiş yüklenemedi' }, { status: 500 })
  }
}
