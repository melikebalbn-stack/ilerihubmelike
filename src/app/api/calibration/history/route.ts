import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CalibrationResult, CalibrationStatus } from '@/generated/prisma'
import { requireUser } from '@/lib/auth/require-user'

// POST - Yeni kalibrasyon kaydı ekle (ADMIN, Kalite departmanı veya QUALITY_MANAGER)
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-calibration: requireUser → user.role/department + session.user.ou
    const { session, user, error } = await requireUser()
    if (error) return error

    // Yetki kontrolü
    if (!session.user.permissions?.includes("kalibrasyon.admin")) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()

    const {
      deviceId,
      calibrationDate,
      certificateNumber,
      calibratedBy,
      cost,
      result,
      notes,
      certificatePath,
      newProductionSection,
    } = body

    // Cihazın var olup olmadığını kontrol et
    const device = await prisma.calibrationDevice.findUnique({
      where: { id: deviceId },
    })

    if (!device) {
      return NextResponse.json(
        { error: 'Cihaz bulunamadı' },
        { status: 404 }
      )
    }

    // Karar: Hurda için hedef bölüm Ayarlar > Kalibrasyon > Bölümler'den (isHurdaTarget)
    // gelir; koda departman/bölüm adı gömülmez. Tanımlı değilse kayıt oluşturulmadan durur.
    let hurdaTarget: { name: string; department: { name: string } | null } | null = null
    if (result === 'HURDA') {
      hurdaTarget = await prisma.calibrationProductionSection.findFirst({
        where: { isHurdaTarget: true },
        select: { name: true, department: { select: { name: true } } },
      })
      if (!hurdaTarget) {
        return NextResponse.json(
          { error: 'Hurda hedef bölümü tanımlı değil. Ayarlar > Kalibrasyon Ayarları > Bölümler\'den bir bölümü "Hurda hedef bölümü" olarak işaretleyin.' },
          { status: 400 }
        )
      }
    }

    const calDate = new Date(calibrationDate)
    const nextDueDate = new Date(calDate.getTime() + (device.calibrationInterval || 365) * 24 * 60 * 60 * 1000)

    // Cihazın kalibrasyon tarihlerini güncelle - SADECE Başarılı ise (Şartlı/Hurda'da
    // kalibrasyon fiilen yapılmadı/geçmedi, bir sonraki vade ileri atılmamalı).
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    let status: CalibrationStatus = CalibrationStatus.VALID
    if (nextDueDate < now) {
      status = CalibrationStatus.EXPIRED
    } else if (nextDueDate <= thirtyDaysFromNow) {
      status = CalibrationStatus.EXPIRING
    }

    // Geçmiş kaydı + cihaz güncellemesi tek transaction'da: yarıda kesilirse
    // (ör. Hurda taşıma) geçmiş yazılıp cihaz güncellenmeden kalmasın (atomik).
    // Hurda-hedef-yok 400 kontrolü transaction'dan ÖNCE yapıldı (yukarıda).
    // Cihaz Durumu sonuca göre otomatik: Başarılı/Şartlı Kabul → Şirkette, Hurda → Hurda.
    const history = await prisma.$transaction(async (tx) => {
      const created = await tx.calibrationHistory.create({
        data: {
          deviceId,
          calibrationDate: calDate,
          nextDueDate,
          certificateNumber,
          calibratedBy,
          cost,
          result: result as CalibrationResult,
          notes,
          certificatePath,
        },
      })

      const deviceUpdateData: Record<string, unknown> = {}
      // Son kalibrasyon sonucu her sonuçta (FAIL dahil) cihaza yazılır — liste
      // rozeti "Başarısız" gösterebilsin. FAIL ayrıca deviceCondition='Şirkette' yapar
      // (kalibrasyondan dönen cihaz şirkette; 'Kalibrasyonda'da kalıp rozeti gizlememesi
      // için) — status/tarihlere DOKUNMAZ. Hurda cihazda deviceCondition korunur.
      deviceUpdateData.sonKalibrasyonSonucu = result as CalibrationResult
      if (result === 'PASS') {
        deviceUpdateData.lastCalibrationDate = calDate
        deviceUpdateData.nextCalibrationDate = nextDueDate
        deviceUpdateData.status = status
        deviceUpdateData.statusManualOverride = false // Yeni kalibrasyon yapıldı, manuel override sıfırla
        deviceUpdateData.deviceCondition = 'Şirkette'
      }

      // Karar: Hurda → cihaz, Ayarlar'da işaretli hedef bölüme (ve o bölümün departmanına)
      // taşınır ve Hurda olarak işaretlenir.
      // Karar: Şartlı Kabul → cihaz, seçilen yeni bölüme taşınır, Cihaz Durumu Şirkette olur.
      if (result === 'HURDA' && hurdaTarget) {
        deviceUpdateData.productionSection = hurdaTarget.name
        if (hurdaTarget.department?.name) {
          deviceUpdateData.department = hurdaTarget.department.name
        }
        deviceUpdateData.deviceCondition = 'Hurda'
        deviceUpdateData.scrapDate = calDate
        deviceUpdateData.scrapDescription = notes || device.scrapDescription || null
      } else if (result === 'CONDITIONAL' && newProductionSection) {
        deviceUpdateData.deviceCondition = 'Şirkette'
        deviceUpdateData.productionSection = newProductionSection
        const section = await tx.calibrationProductionSection.findUnique({
          where: { name: newProductionSection },
          select: { department: { select: { name: true } } },
        })
        if (section?.department?.name) {
          deviceUpdateData.department = section.department.name
        }
      }

      // FAIL (saf başarısız): kalibrasyondan dönen cihaz fiilen şirkette — rozetin
      // görünmesi için 'Kalibrasyonda'da bırakılmaz. Hurda cihaza sonradan FAIL
      // girildiyse (nadir) Hurda ezilmez.
      if (result === 'FAIL' && device.deviceCondition !== 'Hurda') {
        deviceUpdateData.deviceCondition = 'Şirkette'
      }

      if (Object.keys(deviceUpdateData).length > 0) {
        await tx.calibrationDevice.update({
          where: { id: deviceId },
          data: deviceUpdateData,
        })
      }

      return created
    })

    return NextResponse.json(history, { status: 201 })
  } catch (error) {
    console.error('Kalibrasyon kaydı eklenirken hata:', error)
    return NextResponse.json(
      { error: 'Kalibrasyon kaydı eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
