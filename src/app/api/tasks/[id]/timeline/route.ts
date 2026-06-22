import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { RecurrenceType } from '@/generated/prisma'
import { requireSession } from '@/lib/auth/require-session'

// GET - Görevin zaman çizelgesini getir (ana görev + tüm child görevler + gelecek periyotlar)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-TASKS-SECURITY: requireSession ZORUNLU — önceki kod auth check yoktu
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    // Önce görevi al
    const task = await prisma.plannedTask.findUnique({
      where: { id },
      include: {
        category: true,
      },
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Görev bulunamadı' },
        { status: 404 }
      )
    }

    // Eğer bu görevin bir parent'ı varsa, parent'ı ana görev olarak kullan
    const rootTaskId = task.parentTaskId || task.id

    // Ana görevi ve tüm child görevleri al
    const rootTask = await prisma.plannedTask.findUnique({
      where: { id: rootTaskId },
      include: {
        category: true,
        childTasks: {
          include: {
            category: true,
          },
          orderBy: { dueDate: 'asc' },
        },
      },
    })

    if (!rootTask) {
      return NextResponse.json(
        { error: 'Ana görev bulunamadı' },
        { status: 404 }
      )
    }

    // Tüm periyotları birleştir (ana görev + child'lar)
    const allPeriods = [
      {
        id: rootTask.id,
        dueDate: rootTask.dueDate,
        status: rootTask.status,
        completedDate: rootTask.completedDate,
        notes: rootTask.notes,
        isRoot: true,
      },
      ...rootTask.childTasks.map(child => ({
        id: child.id,
        dueDate: child.dueDate,
        status: child.status,
        completedDate: child.completedDate,
        notes: child.notes,
        isRoot: false,
      })),
    ].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

    // Gelecek periyotları hesapla (eğer tekrarlayan görevse)
    const futurePeriods: Array<{
      dueDate: Date
      status: 'FUTURE'
      isProjected: true
    }> = []

    if (rootTask.isRecurring && rootTask.recurrenceType) {
      // En son periyodun tarihini bul
      const lastPeriodDate = allPeriods.length > 0
        ? new Date(allPeriods[allPeriods.length - 1].dueDate)
        : new Date(rootTask.dueDate)

      // Önümüzdeki 5 periyodu hesapla
      let nextDate = new Date(lastPeriodDate)
      for (let i = 0; i < 5; i++) {
        nextDate = calculateNextDueDate(
          nextDate,
          rootTask.recurrenceType,
          rootTask.recurrenceInterval || 1
        )
        futurePeriods.push({
          dueDate: new Date(nextDate),
          status: 'FUTURE',
          isProjected: true,
        })
      }
    }

    return NextResponse.json({
      rootTask: {
        id: rootTask.id,
        title: rootTask.title,
        description: rootTask.description,
        category: rootTask.category,
        isRecurring: rootTask.isRecurring,
        recurrenceType: rootTask.recurrenceType,
        recurrenceInterval: rootTask.recurrenceInterval,
        responsiblePerson: rootTask.responsiblePerson,
        responsibleDepartment: rootTask.responsibleDepartment,
        priority: rootTask.priority,
      },
      periods: allPeriods,
      futurePeriods,
    })
  } catch (error) {
    console.error('Görev zaman çizelgesi alınırken hata:', error)
    return NextResponse.json(
      { error: 'Görev zaman çizelgesi alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni periyot oluştur
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-TASKS-SECURITY: requireSession ZORUNLU — önceki kod auth check yoktu
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params
    const body = await request.json()
    const { dueDate } = body

    // Ana görevi al
    const rootTask = await prisma.plannedTask.findUnique({
      where: { id },
    })

    if (!rootTask) {
      return NextResponse.json(
        { error: 'Görev bulunamadı' },
        { status: 404 }
      )
    }

    // Eğer bu görev bir child ise, parent'ı bul
    const actualRootId = rootTask.parentTaskId || rootTask.id
    const actualRoot = rootTask.parentTaskId
      ? await prisma.plannedTask.findUnique({ where: { id: actualRootId } })
      : rootTask

    if (!actualRoot) {
      return NextResponse.json(
        { error: 'Ana görev bulunamadı' },
        { status: 404 }
      )
    }

    // Yeni periyot oluştur
    const newPeriod = await prisma.plannedTask.create({
      data: {
        title: actualRoot.title,
        description: actualRoot.description,
        categoryId: actualRoot.categoryId,
        dueDate: dueDate ? new Date(dueDate) : calculateNextDueDateFromRoot(actualRoot),
        startDate: actualRoot.startDate,
        isRecurring: true,
        recurrenceType: actualRoot.recurrenceType,
        recurrenceInterval: actualRoot.recurrenceInterval,
        reminderDays: actualRoot.reminderDays,
        responsiblePerson: actualRoot.responsiblePerson,
        responsiblePersonEmail: actualRoot.responsiblePersonEmail,
        responsibleDepartment: actualRoot.responsibleDepartment,
        notificationEmails: actualRoot.notificationEmails,
        priority: actualRoot.priority,
        status: 'PENDING',
        parentTaskId: actualRootId,
      },
      include: {
        category: true,
      },
    })

    return NextResponse.json(newPeriod, { status: 201 })
  } catch (error) {
    console.error('Yeni periyot oluşturulurken hata:', error)
    return NextResponse.json(
      { error: 'Yeni periyot oluşturulurken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// Root görevden sonraki tarihi hesapla
function calculateNextDueDateFromRoot(rootTask: any): Date {
  // En son child'ın tarihini bul veya root'un tarihini kullan
  return calculateNextDueDate(
    new Date(rootTask.dueDate),
    rootTask.recurrenceType,
    rootTask.recurrenceInterval || 1
  )
}

// Sonraki tarih hesaplama fonksiyonu
function calculateNextDueDate(
  currentDate: Date,
  recurrenceType: RecurrenceType,
  interval: number
): Date {
  const nextDate = new Date(currentDate)

  switch (recurrenceType) {
    case RecurrenceType.DAILY:
      nextDate.setDate(nextDate.getDate() + interval)
      break
    case RecurrenceType.WEEKLY:
      nextDate.setDate(nextDate.getDate() + 7 * interval)
      break
    case RecurrenceType.MONTHLY:
      nextDate.setMonth(nextDate.getMonth() + interval)
      break
    case RecurrenceType.QUARTERLY:
      nextDate.setMonth(nextDate.getMonth() + 3 * interval)
      break
    case RecurrenceType.SEMI_ANNUAL:
      nextDate.setMonth(nextDate.getMonth() + 6 * interval)
      break
    case RecurrenceType.YEARLY:
      nextDate.setFullYear(nextDate.getFullYear() + interval)
      break
  }

  return nextDate
}
