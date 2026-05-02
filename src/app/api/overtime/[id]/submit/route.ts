import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiBadRequest } from '@/lib/api-response'
import { sendPushToUser } from '@/lib/push-notifications'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST: Mesai formunu onaya gönder (DRAFT -> PENDING)
 * Onay pozisyonlarını DB'den çeker, kayıtlarını oluşturur ve ilk onaylayıcıya bildirim gönderir
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return apiUnauthorized()
    }

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return apiUnauthorized()
    }

    // Formu kontrol et
    const form = await prisma.overtimeForm.findUnique({
      where: { id },
      include: {
        personnel: true,
        approvals: true,
      },
    })

    if (!form) {
      return apiNotFound('Mesai formu bulunamadı')
    }

    // Sadece form sahibi veya admin gönderebilir
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role)
    if (form.createdById !== user.id && !isAdmin) {
      return apiError('Bu formu onaya gönderme yetkiniz yok', 403)
    }

    // Sadece taslak formlar onaya gönderilebilir
    if (form.status !== 'DRAFT') {
      return apiBadRequest('Sadece taslak durumundaki formlar onaya gönderilebilir')
    }

    // Personel kontrolü
    if (form.personnel.length === 0) {
      return apiBadRequest('Form onaya gönderilebilmesi için en az bir personel eklenmelidir')
    }

    // Formdaki personel departmanlarını topla (Personnel tablosundan)
    const personnelIds = form.personnel.map((p) => p.personnelId).filter(Boolean) as string[]
    const personnelRecords = personnelIds.length > 0
      ? await prisma.personnel.findMany({
          where: { id: { in: personnelIds } },
          select: { bolum: true },
        })
      : []
    const formDepartments = new Set(personnelRecords.map((p) => p.bolum))

    // Onay pozisyonlarını veritabanından çek
    const positions = await prisma.approvalPosition.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { user: true },
    })

    // Departman bazlı filtreleme:
    // - departments boş → ortak pozisyon, her zaman dahil
    // - departments dolu → sadece formda o departmandan personel varsa dahil
    const maxStep = form.sendToGM ? 7 : 6
    const assignedPositions = positions.filter((p) => {
      if (!p.userId) return false
      if (p.sortOrder > maxStep) return false

      // Ortak pozisyon (departments boş)
      if (!p.departments || p.departments.length === 0) return true

      // Koşullu pozisyon: formda eşleşen departman var mı?
      return p.departments.some((dept) => formDepartments.has(dept))
    })

    // En az 1 atanmış pozisyon olmalı
    if (assignedPositions.length === 0) {
      return apiBadRequest(
        'Hiçbir onay pozisyonuna kullanıcı atanmamış. Ayarlar > Onay Pozisyonları sayfasından en az bir atama yapın.'
      )
    }

    // Mevcut onay kayıtlarını temizle (varsa)
    if (form.approvals.length > 0) {
      await prisma.overtimeApproval.deleteMany({
        where: { overtimeFormId: id },
      })
    }

    // Transaction ile onay kayıtlarını oluştur ve formu güncelle
    const updatedForm = await prisma.$transaction(async (tx) => {
      // Onay kayıtlarını oluştur
      await tx.overtimeApproval.createMany({
        data: assignedPositions.map((pos) => ({
          overtimeFormId: id,
          step: pos.sortOrder,
          role: pos.title,
          approverId: pos.userId,
          decision: null,
          comment: null,
          decidedAt: null,
          forwardToGM: false,
        })),
      })

      // Form durumunu güncelle
      const updated = await tx.overtimeForm.update({
        where: { id },
        data: {
          status: 'PENDING',
          currentStep: 0,
        },
        include: {
          personnel: {
            include: {
              personnel: {
                select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true },
              },
            },
          },
          approvals: {
            orderBy: { step: 'asc' },
          },
          createdBy: {
            select: { id: true, name: true, email: true, department: true },
          },
        },
      })

      // İlk onaylayıcıya bildirim gönder
      const firstStep = assignedPositions[0]
      if (firstStep?.userId) {
        try {
          await tx.notification.create({
            data: {
              userId: firstStep.userId,
              title: 'Yeni Mesai Formu Onayı',
              message: `${updated.formNo} numaralı mesai formu onayınızı bekliyor.`,
              type: 'REMINDER',
              link: `/forms/overtime/${id}`,
            },
          })
        } catch {
          // Bildirim oluşturulamazsa devam et
        }
      }

      return { updated, pushUserId: firstStep?.userId || null }
    })

    // Transaction sonrası push bildirim gönder
    if (updatedForm.pushUserId) {
      sendPushToUser(prisma, updatedForm.pushUserId, {
        title: 'Yeni Mesai Formu Onayı',
        body: `${updatedForm.updated.formNo} numaralı mesai formu onayınızı bekliyor.`,
        url: `/forms/overtime/${id}`,
        tag: `overtime-submit-${id}`,
      }).catch(() => {})
    }

    return apiSuccess(updatedForm.updated)
  } catch (error) {
    return apiError('Mesai formu onaya gönderilirken bir hata oluştu', 500, {
      endpoint: 'POST /api/overtime/[id]/submit',
      error,
    })
  }
}
