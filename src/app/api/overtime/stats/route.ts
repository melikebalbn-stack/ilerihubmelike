import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireSession } from '@/lib/auth/require-session'

/**
 * Mesai saatini hesapla
 * Tam gün: 8 saat, saat aralığı: endTime - startTime
 */
function calculateHours(isFullDay: boolean, startTime: string | null, endTime: string | null): number {
  if (isFullDay) return 8

  if (!startTime || !endTime) return 0

  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)

  const startMinutes = sh * 60 + sm
  const endMinutes = eh * 60 + em

  if (endMinutes <= startMinutes) return 0

  return (endMinutes - startMinutes) / 60
}

/**
 * GET: Mesai istatistiklerini döndür
 * - Haftalık toplam mesai saatleri (onaylanmış formlar)
 * - Aylık toplam mesai saatleri (onaylanmış formlar)
 * - En çok mesai yapan bölüm (aylık)
 */
export async function GET(request: Request) {
  try {
    // PR-Y2.5-overtime: requireSession (read-only stats)
    const { error } = await requireSession()
    if (error) return error

    // Vardiya Faz 2: formTipi ayrımı (default MESAI → mesai KPI vardiyayı saymaz).
    const formTipiParam = new URL(request.url).searchParams.get('formTipi')
    const formTipi: 'MESAI' | 'VARDIYA' = formTipiParam === 'VARDIYA' ? 'VARDIYA' : 'MESAI'

    const now = new Date()

    // Bu haftanın başlangıcı (Pazartesi)
    const weekStart = new Date(now)
    const dayOfWeek = now.getDay()
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    weekStart.setDate(now.getDate() - diffToMonday)
    weekStart.setHours(0, 0, 0, 0)

    // Bu ayın başlangıcı
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    monthStart.setHours(0, 0, 0, 0)

    // Onaylanmış formları çek (bu ay içindeki)
    const approvedForms = await prisma.overtimeForm.findMany({
      where: {
        status: 'APPROVED',
        date: { gte: monthStart },
        formTipi,
      },
      include: {
        personnel: {
          select: { workDepartment: true },
        },
      },
    })

    let weeklyHours = 0
    let monthlyHours = 0
    const departmentHours: Record<string, number> = {}

    for (const form of approvedForms) {
      const hoursPerPerson = calculateHours(form.isFullDay, form.startTime, form.endTime)
      const personnelCount = form.personnel.length
      const totalHours = hoursPerPerson * personnelCount

      // Aylık toplam
      monthlyHours += totalHours

      // Haftalık toplam
      const formDate = new Date(form.date)
      if (formDate >= weekStart) {
        weeklyHours += totalHours
      }

      // Bölüm bazlı toplam
      for (const p of form.personnel) {
        const dept = p.workDepartment
        departmentHours[dept] = (departmentHours[dept] || 0) + hoursPerPerson
      }
    }

    // En çok mesai yapan bölüm
    let topDepartment = { name: '-', hours: 0 }
    for (const [dept, hours] of Object.entries(departmentHours)) {
      if (hours > topDepartment.hours) {
        topDepartment = { name: dept, hours }
      }
    }

    return apiSuccess({
      weeklyHours: Math.round(weeklyHours * 10) / 10,
      monthlyHours: Math.round(monthlyHours * 10) / 10,
      topDepartment,
    })
  } catch (error) {
    return apiError('Mesai istatistikleri alınırken bir hata oluştu', 500, {
      endpoint: 'GET /api/overtime/stats',
      error,
    })
  }
}
