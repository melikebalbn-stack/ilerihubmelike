import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CalibrationResult, CalibrationStatus } from '@/generated/prisma'
import { requireUser } from '@/lib/auth/require-user'

// PUT - Kalibrasyon kaydını düzenle (kalibrasyon.admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-calibration: requireUser → user.role/department + session.user.ou
    const { session, user, error } = await requireUser()
    if (error) return error

    // Yetki kontrolü
    if (!session.user.permissions?.includes("kalibrasyon.admin")) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const {
      calibrationDate,
      certificateNumber,
      calibratedBy,
      cost,
      result,
      notes,
      certificatePath,
      newProductionSection,
    } = body

    // Kaydın var olup olmadığını ve cihazını al
    const existing = await prisma.calibrationHistory.findUnique({
      where: { id },
      include: { device: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Kalibrasyon kaydı bulunamadı' },
        { status: 404 }
      )
    }

    // calibrationDate değiştiyse nextDueDate'i yeniden hesapla
    const calDate = calibrationDate ? new Date(calibrationDate) : existing.calibrationDate
    const interval = existing.device.calibrationInterval || 365
    const nextDueDate = new Date(calDate.getTime() + interval * 24 * 60 * 60 * 1000)

    // result bu istekte gönderildiyse PASS/CONDITIONAL/HURDA dışında olamaz (ör. eski "FAIL"
    // değeri) — aksi halde cihaz senkronu (deviceCondition/tarih) hiç tetiklenmez. Alan hiç
    // gönderilmediyse (başka bir şey düzenleniyorsa) mevcut değer dokunulmadan korunur.
    if (result !== undefined && !['PASS', 'CONDITIONAL', 'HURDA'].includes(result)) {
      return NextResponse.json(
        { error: 'Geçersiz Sonuç/Karar. Başarılı, Şartlı Kabul veya Hurda seçilmeli.' },
        { status: 400 }
      )
    }

    const finalResult: CalibrationResult = (result as CalibrationResult) ?? existing.result

    // Karar: Hurda için hedef bölüm Ayarlar > Kalibrasyon > Bölümler'den (isHurdaTarget)
    // gelir; koda departman/bölüm adı gömülmez. Tanımlı değilse kayıt güncellenmeden durur.
    let hurdaTarget: { name: string; department: { name: string } | null } | null = null
    if (finalResult === 'HURDA') {
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

    // Kaydı güncelle
    const updated = await prisma.calibrationHistory.update({
      where: { id },
      data: {
        calibrationDate: calDate,
        nextDueDate,
        certificateNumber: certificateNumber ?? null,
        calibratedBy: calibratedBy ?? existing.calibratedBy,
        cost: cost === undefined ? existing.cost : cost,
        result: finalResult,
        notes: notes ?? null,
        certificatePath: certificatePath ?? existing.certificatePath,
      },
    })

    // Cihazı en güncel kayda göre senkronla (tarih değişmiş olabilir)
    const latest = await prisma.calibrationHistory.findFirst({
      where: { deviceId: existing.deviceId },
      orderBy: { calibrationDate: 'desc' },
    })

    if (latest) {
      const now = new Date()
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      // Tarih/durum/Cihaz Durumu senkronu EN GÜNCEL kayda göre yapılır (tarih ilerlemesi
      // SADECE Başarılı ise; Cihaz Durumu her zaman en güncel kararı yansıtır — böylece
      // bir kaydı Hurda'dan Başarılı'ya düzenlemek Cihaz Durumu'nu da Şirkette'ye döndürür).
      const deviceData: Record<string, unknown> = {}
      if (latest.result === 'PASS') {
        deviceData.lastCalibrationDate = latest.calibrationDate
        deviceData.nextCalibrationDate = latest.nextDueDate
        deviceData.deviceCondition = 'Şirkette'

        // Manuel override (IN_PROCESS / OUT_OF_ORDER) varsa otomatik statüyü ezme
        if (!existing.device.statusManualOverride) {
          if (latest.nextDueDate < now) {
            deviceData.status = CalibrationStatus.EXPIRED
          } else if (latest.nextDueDate <= thirtyDaysFromNow) {
            deviceData.status = CalibrationStatus.EXPIRING
          } else {
            deviceData.status = CalibrationStatus.VALID
          }
        }
      } else if (latest.result === 'CONDITIONAL') {
        deviceData.deviceCondition = 'Şirkette'
      } else if (latest.result === 'HURDA') {
        deviceData.deviceCondition = 'Hurda'
      }

      // Bölüm/Departman taşıma: bu düzenlemenin Karar'ına (finalResult) göre uygulanır —
      // seçilen yeni bölüm sadece bu istekte var, kayıtta saklanmaz.
      // Karar: Hurda → cihaz, Ayarlar'da işaretli hedef bölüme (ve o bölümün departmanına)
      // taşınır ve Hurda olarak işaretlenir.
      // Karar: Şartlı Kabul → cihaz, seçilen yeni bölüme ve o bölümün departmanına taşınır.
      if (finalResult === 'HURDA' && hurdaTarget) {
        deviceData.productionSection = hurdaTarget.name
        if (hurdaTarget.department?.name) {
          deviceData.department = hurdaTarget.department.name
        }
        deviceData.deviceCondition = 'Hurda'
        deviceData.scrapDate = calDate
        deviceData.scrapDescription = notes || existing.device.scrapDescription || null
      } else if (finalResult === 'CONDITIONAL' && newProductionSection) {
        deviceData.productionSection = newProductionSection
        const section = await prisma.calibrationProductionSection.findUnique({
          where: { name: newProductionSection },
          select: { department: { select: { name: true } } },
        })
        if (section?.department?.name) {
          deviceData.department = section.department.name
        }
      }

      if (Object.keys(deviceData).length > 0) {
        await prisma.calibrationDevice.update({
          where: { id: existing.deviceId },
          data: deviceData,
        })
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Kalibrasyon kaydı güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Kalibrasyon kaydı güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
