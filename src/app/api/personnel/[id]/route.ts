import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']
const DELETE_ROLES = ['ADMIN', 'SUPER_ADMIN']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const personnel = await prisma.personnel.findUnique({
      where: { id },
      select: {
        id: true,
        sicilNo: true,
        sinif: true,
        cinsiyet: true,
        adSoyad: true,
        yakaRengi: true,
        direktEndirekt: true,
        asansorMekanik: true,
        iseGirisTarihi: true,
        gorev: true,
        bolumDetay: true,
        bolum: true,
        birimSorumlusu: true,
        bolumMuduru: true,
        masrafMerkezi: true,
        interKepMail: true,
        denemeDegerlendirme: true,
        altiAyDegerlendirme: true,
        telefon: true,
        kanGrubu: true,
        egitimYeri: true,
        egitimTipi: true,
        egitimAlani: true,
        mezuniyetYili: true,
        mykUstalikKalfalik: true,
        ilkYardimci: true,
        emekli: true,
        engelli: true,
        aktif: true,
        azureAdId: true,
        azureAdEmail: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
      },
    })

    if (!personnel) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }

    return NextResponse.json(personnel)
  } catch (error) {
    console.error('Personel detayı alınırken hata:', error)
    return NextResponse.json({ error: 'Personel detayı alınırken bir hata oluştu' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: personnelId } = await params
    const userRole = (session.user as any).role
    if (!EDIT_ROLES.includes(userRole)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const existing = await prisma.personnel.findUnique({ where: { id: personnelId } })
    if (!existing) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }

    const body = await request.json()

    // Parse date fields
    if (body.iseGirisTarihi) {
      body.iseGirisTarihi = new Date(body.iseGirisTarihi)
    }

    // Remove fields that should not be updated directly
    delete body.id
    delete body.createdAt
    delete body.updatedAt
    delete body.sensitive

    const personnel = await prisma.personnel.update({
      where: { id: personnelId },
      data: body,
    })

    return NextResponse.json(personnel)
  } catch (error: any) {
    console.error('Personel güncellenirken hata:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Bu sicil numarası zaten kayıtlı' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Personel güncellenirken bir hata oluştu' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: delId } = await params
    const userRole = (session.user as any).role
    if (!DELETE_ROLES.includes(userRole)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const existing = await prisma.personnel.findUnique({ where: { id: delId } })
    if (!existing) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }

    // Soft delete: aktif = false
    const personnel = await prisma.personnel.update({
      where: { id: delId },
      data: { aktif: false },
    })

    return NextResponse.json({ message: 'Personel pasif duruma alındı', personnel })
  } catch (error) {
    console.error('Personel silinirken hata:', error)
    return NextResponse.json({ error: 'Personel silinirken bir hata oluştu' }, { status: 500 })
  }
}
