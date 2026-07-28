import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { resolveTransitionRoles } from '@/lib/recruitment/resolve-roles'
import { oturumOzetiGetir } from '@/lib/recruitment/assessment-session'

// PR-RECRUIT-RBAC: PublicJobApplication — İK (recruitment.admin/hr.admin) tam erişim;
// atanan müdür (assignedManagerId) yalnız değerlendirme için gereken NON-hassas alanlar.

// Saf müdür (İK yetkisi yok) görünürlük WHITELIST'i. Alan seçimi SUNUCUDA yapılır —
// hassas alanlar (TC, doğum, adli sicil, sağlık, medeni/askerlik, beden, KVKK imza, ev adresi,
// İK notu, iletişim) client'a HİÇ gönderilmez. (org modülü hasFullAccess deseni.)
const MANAGER_SELECT = {
  id: true,
  applicationNumber: true,
  fullName: true,
  requestedPosition: true,
  educationLevel: true,
  educationHistory: true,
  workExperience: true,
  foreignLanguages: true,
  computerSkills: true,
  coursesAndSeminars: true,
  photoUrl: true,
  status: true,
  assignedManagerId: true,
  assignedAt: true,
  createdAt: true,
} satisfies Prisma.PublicJobApplicationSelect

// GET - Başvuru detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession()
    if (error) return error

    const { id } = await params

    // Rol belirleme için önce yalnız atama bilgisini oku (hassas veri çekmeden).
    const base = await prisma.publicJobApplication.findUnique({
      where: { id },
      select: { id: true, assignedManagerId: true },
    })
    if (!base) {
      return NextResponse.json({ error: 'Basvuru bulunamadi' }, { status: 404 })
    }

    // Yetki: İK (recruitment.admin/hr.admin) VEYA atanan müdür. TEK KAYNAK (resolve-roles).
    const roles = resolveTransitionRoles({
      permissions: session.user.permissions,
      userId: session.user.id,
      assignedManagerId: base.assignedManagerId,
    })
    if (roles.length === 0) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
    }

    // İK → tam kayıt (mevcut davranış birebir korunur) + sınav oturum özeti (İK: aktif linkli).
    // Onaylar kartı için KVKK onayı + sağlık beyanı varlığı/tarihi (mevcut ilişkilerden, yeni uç yok).
    if (roles.includes('IK')) {
      const application = await prisma.publicJobApplication.findUnique({
        where: { id },
        include: {
          consent: { select: { signedAt: true, createdAt: true, documentCode: true, documentRev: true } },
          health: { select: { createdAt: true } },
        },
      })
      const sinavlar = await oturumOzetiGetir(prisma, id, { ik: true })
      const onaylar = {
        kvkkAlindi: !!application?.consent,
        kvkkTarih: application?.consent?.signedAt ?? null,
        saglikBeyaniAlindi: !!application?.health,
        saglikTarih: application?.health?.createdAt ?? null,
        beyanKabul: !!application?.declarationAccepted,
        beyanTarih: application?.declarationDate ?? null,
      }
      return NextResponse.json({ ...application, onaylar, sinavlar })
    }

    // Saf müdür → whitelist alanlar + kısıtlı işaret + sınav özeti (müdür: puan/durum/tarih VAR,
    // sinavLink/token YOK — alan kapısı SUNUCUDA oturumOzetiGetir({ik:false})).
    const application = await prisma.publicJobApplication.findUnique({
      where: { id },
      select: MANAGER_SELECT,
    })
    const sinavlar = await oturumOzetiGetir(prisma, id, { ik: false })
    // Müdür: yalnız "alındı/alınmadı" — sağlık İÇERİĞİ ve tarihleri GÖNDERİLMEZ (hassas alan kuralı).
    const [consentSayi, healthSayi, beyan] = await Promise.all([
      prisma.jobApplicationConsent.count({ where: { applicationId: id } }),
      prisma.jobApplicationHealth.count({ where: { applicationId: id } }),
      prisma.publicJobApplication.findUnique({ where: { id }, select: { declarationAccepted: true } }),
    ])
    const onaylar = {
      kvkkAlindi: consentSayi > 0,
      saglikBeyaniAlindi: healthSayi > 0,
      beyanKabul: !!beyan?.declarationAccepted,
    }
    return NextResponse.json({ ...application, _restrictedView: true, onaylar, sinavlar })
  } catch (error) {
    console.error('Basvuru detayi alinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - Başvuru İK notlarını güncelle (yalnız notes)
//
// STATÜ DEĞİŞİMİ ARTIK BURADA YAPILMAZ. Tüm durum geçişleri tek geçit olan
// POST /api/recruitment/applications/[id]/transition üzerinden yapılır (izin matrisi +
// StageLog + bildirim + ret nedeni orada atomik). Bu uç yalnız İK notunu günceller.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession()
    if (error) return error

    if (!session.user.permissions?.includes('recruitment.admin')) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { notes } = body

    const updateData: Prisma.PublicJobApplicationUpdateInput = {}
    if (notes !== undefined) updateData.notes = notes

    const application = await prisma.publicJobApplication.update({ where: { id }, data: updateData })

    return NextResponse.json(application)
  } catch (error) {
    console.error('Basvuru guncellenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Başvuru sil (sadece admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession()
    if (error) return error

    if (!session.user.permissions?.includes('recruitment.admin')) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
    }

    const { id } = await params

    await prisma.publicJobApplication.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Basvuru silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
