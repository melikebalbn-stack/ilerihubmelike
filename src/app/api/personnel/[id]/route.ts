import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']
const DELETE_ROLES = ['ADMIN', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  if (!dept) return false
  const d = dept.toLowerCase()
  return d.includes('insan') || d.includes('human') || d.includes('hr') || d.includes('ik')
}

function hasEditAccess(role: string, department?: string | null): boolean {
  return EDIT_ROLES.includes(role) || isHRDepartment(department)
}

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
        sorumlu2: true,
        sorumlu3: true,
        bolumMuduru: true,
        masrafMerkezi: true,
        interKepMail: true,
        mailAdresi: true,
        ikametAdresi: true,
        denemeDegerlendirme: true,
        altiAyDegerlendirme: true,
        telefon: true,
        kanGrubu: true,
        serviceRoute: true,
        serviceStop: true,
        egitimYeri: true,
        egitimTipi: true,
        egitimAlani: true,
        mezuniyetYili: true,
        ilkYardimciBelgesi: true,
        kalfalikBelgesi: true,
        ustalikBelgesi: true,
        forkliftEhliyeti: true,
        vincEhliyeti: true,
        mykBelgesiTarihi: true,
        yanginSertifikasi: true,
        eTrans: true,
        ustaOgreticiBelgesi: true,
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
    const userDept = (session.user as any).department
    if (!hasEditAccess(userRole, userDept)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const existing = await prisma.personnel.findUnique({ where: { id: personnelId } })
    if (!existing) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }

    const body = await request.json()

    // Remove fields that should not be updated directly
    delete body.id
    delete body.createdAt
    delete body.updatedAt
    delete body.sensitive

    // Boş stringleri null'a çevir (Prisma enum/date/int hataları için)
    for (const key of Object.keys(body)) {
      if (body[key] === '') body[key] = null
    }

    // Parse date fields (null değerler atlanır)
    const dateFields = [
      'iseGirisTarihi', 'denemeDegerlendirme', 'altiAyDegerlendirme',
      'ilkYardimciBelgesi', 'kalfalikBelgesi', 'ustalikBelgesi', 'yanginSertifikasi', 'mykBelgesiTarihi',
    ]
    for (const field of dateFields) {
      if (body[field]) {
        body[field] = new Date(body[field])
      }
    }

    // Parse int fields
    if (body.mezuniyetYili) {
      body.mezuniyetYili = parseInt(body.mezuniyetYili) || null
    }

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
