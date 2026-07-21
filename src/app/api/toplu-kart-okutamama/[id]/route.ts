import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from '../_lib/access'
import { VALID_NEDEN } from '../_lib/neden'

export const dynamic = 'force-dynamic'

async function loadRecordWithAccessCheck(id: string, userId: string) {
  const access = await getBulkCardScanAccess(userId)
  if (access.level === 'NONE') {
    return { error: NextResponse.json({ error: 'Bu forma erişim yetkiniz yok' }, { status: 403 }) }
  }

  const record = await prisma.bulkCardScanFailure.findUnique({
    where: { id },
    include: { personnel: { select: { bolum: true } } },
  })
  if (!record) {
    return { error: NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 }) }
  }

  if (access.level === 'GRI' && record.personnel?.bolum !== access.bolum) {
    return { error: NextResponse.json({ error: 'Bu kaydı düzenleme yetkiniz yok' }, { status: 403 }) }
  }

  return { record }
}

/**
 * PUT /api/toplu-kart-okutamama/[id]
 * Body: { personnelId?, tarih?, girisSaati?, cikisSaati? }
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user, error } = await requireUser()
    if (error) return error

    const { record, error: accessError } = await loadRecordWithAccessCheck(id, user.id)
    if (accessError) return accessError

    const body = await request.json()
    const { personnelId, tarih, girisSaati, cikisSaati, neden } = body

    if (neden && !(VALID_NEDEN as readonly string[]).includes(neden)) {
      return NextResponse.json({ error: 'Geçersiz neden' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}

    if (personnelId && personnelId !== record!.personnelId) {
      const personnel = await prisma.personnel.findUnique({
        where: { id: personnelId },
        select: { id: true, sicilNo: true, adSoyad: true, aktif: true },
      })
      if (!personnel || !personnel.aktif) {
        return NextResponse.json({ error: 'Seçilen personel bulunamadı veya pasif' }, { status: 400 })
      }
      data.personnelId = personnel.id
      data.sicilNo = personnel.sicilNo
      data.adSoyad = personnel.adSoyad
    }

    if (tarih) data.tarih = new Date(tarih)
    if (girisSaati !== undefined) data.girisSaati = girisSaati || null
    if (cikisSaati !== undefined) data.cikisSaati = cikisSaati || null
    if (neden !== undefined) data.neden = neden || null

    const updated = await prisma.bulkCardScanFailure.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        personnel: { select: { id: true, bolum: true, gorev: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Toplu kart okutamama güncelleme hatası:', error)
    return NextResponse.json({ error: 'Kayıt güncellenemedi' }, { status: 500 })
  }
}

/**
 * DELETE /api/toplu-kart-okutamama/[id]
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user, error } = await requireUser()
    if (error) return error

    const { error: accessError } = await loadRecordWithAccessCheck(id, user.id)
    if (accessError) return accessError

    await prisma.bulkCardScanFailure.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Toplu kart okutamama silme hatası:', error)
    return NextResponse.json({ error: 'Kayıt silinemedi' }, { status: 500 })
  }
}
