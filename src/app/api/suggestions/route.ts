import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mapAdOuToDepartment } from '@/lib/department-utils'
import { requireUser } from '@/lib/auth/require-user'
import { oneriGorunurlugu, gorunurlukFiltresi } from '@/lib/suggestions/gorunurluk'
import { bildirYeniOneri } from '@/lib/suggestions/bildirim'

// Öneri numarası oluştur: ONR-2025-0001
async function generateSuggestionNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ONR-${year}-`

  // Bu yılın son önerisini bul
  const lastSuggestion = await prisma.suggestion.findFirst({
    where: {
      suggestionNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      suggestionNumber: 'desc'
    }
  })

  let nextNumber = 1
  if (lastSuggestion) {
    const lastNumber = parseInt(lastSuggestion.suggestionNumber.split('-')[2])
    nextNumber = lastNumber + 1
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

// GET - Önerileri listele
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-suggestions: requireUser + session (distinguishedName LDAP-only)
    const { session, user, error } = await requireUser()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const viewMode = searchParams.get('viewMode') || 'all' // all, my, pending, approved, awaiting_my_approval
    const status = searchParams.get('status')
    const categoryId = searchParams.get('categoryId')
    // Pagination limiti - max 100 ile sınırla
    const requestedLimit = parseInt(searchParams.get('limit') || '50')
    const limit = Math.min(Math.max(1, requestedLimit), 100) // 1-100 arası
    const userEmail = user.email

    // eslint-disable-next-line
    const where: Record<string, unknown> = { isActive: true }

    // Kullanıcının rolü (kurul üyesi / yönetici) TEK KAYNAK'tan gelir; sayaç ucu
    // (stats/route.ts) aynı helper'ı çağırır — kural iki yerde kopyalanmaz.
    const gorunurluk = await oneriGorunurlugu({
      userEmail,
      distinguishedName: (session.user as { distinguishedName?: string }).distinguishedName,
    })
    const { isBoardMember, isManager, subordinateEmails } = gorunurluk

    // Görünüm modu filtresi
    if (viewMode === 'my') {
      // Kendi önerilerim (case-insensitive)
      where.submittedBy = { equals: userEmail, mode: 'insensitive' as const }
    } else if (viewMode === 'pending') {
      // Bekleyenler - sadece görebildiklerimi göster
      if (isBoardMember) {
        where.status = { in: ['SUBMITTED', 'UNDER_REVIEW', 'PENDING_APPROVAL'] }
      } else if (isManager) {
        // Manager: kendi önerileri + astlarının önerileri
        const visibleEmails = [userEmail, ...subordinateEmails]
        where.OR = visibleEmails.map(email => ({
          submittedBy: { equals: email, mode: 'insensitive' as const }
        }))
        where.status = { in: ['SUBMITTED', 'UNDER_REVIEW', 'PENDING_APPROVAL'] }
      } else {
        // Normal kullanıcı: sadece kendi önerileri
        where.submittedBy = { equals: userEmail, mode: 'insensitive' as const }
        where.status = { in: ['SUBMITTED', 'UNDER_REVIEW', 'PENDING_APPROVAL'] }
      }
    } else if (viewMode === 'approved') {
      // Onaylananlar - sadece görebildiklerimi göster
      if (isBoardMember) {
        where.status = { in: ['APPROVED', 'IN_PROGRESS', 'IMPLEMENTED'] }
      } else if (isManager) {
        const visibleEmails = [userEmail, ...subordinateEmails]
        where.OR = visibleEmails.map(email => ({
          submittedBy: { equals: email, mode: 'insensitive' as const }
        }))
        where.status = { in: ['APPROVED', 'IN_PROGRESS', 'IMPLEMENTED'] }
      } else {
        where.submittedBy = { equals: userEmail, mode: 'insensitive' as const }
        where.status = { in: ['APPROVED', 'IN_PROGRESS', 'IMPLEMENTED'] }
      }
    } else if (viewMode === 'awaiting_my_approval') {
      // Benim onayımı bekleyenler - Manager VE/VEYA Kurul üyesi olarak
      // OR koşulları oluştur
      const orConditions: Record<string, unknown>[] = []

      // 1. Manager olarak: astlarımın SUBMITTED/UNDER_REVIEW durumundaki önerileri
      if (subordinateEmails.length > 0) {
        subordinateEmails.forEach(email => {
          orConditions.push({
            AND: [
              { submittedBy: { equals: email, mode: 'insensitive' as const } },
              { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } }
            ]
          })
        })
      }

      // 2. Kurul üyesi olarak: PENDING_APPROVAL durumundaki tüm öneriler
      if (isBoardMember) {
        orConditions.push({ status: 'PENDING_APPROVAL' })
      }

      if (orConditions.length > 0) {
        where.OR = orConditions
      } else {
        // Ne manager ne de kurul üyesi değilse boş döndür
        where.id = 'no-match'
      }
    } else if (viewMode === 'all') {
      // Tümü — rol bazlı görünürlük, TEK KAYNAK (gorunurluk.ts). Davranış birebir aynı:
      // kurul üyesinde filtre yok, yöneticide kendi+astları, diğerinde yalnız kendisi.
      Object.assign(where, gorunurlukFiltresi(gorunurluk))
    }

    // Durum filtresi
    if (status) {
      where.status = status
    }

    // Kategori filtresi
    if (categoryId) {
      where.categoryId = categoryId
    }

    const suggestions = await prisma.suggestion.findMany({
      where,
      include: {
        category: true,
        _count: {
          select: {
            comments: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { submittedAt: 'desc' }
      ],
      take: limit
    })

    // Anonim önerilerde gönderen bilgisini gizle (kendi önerileri hariç)
    const processedSuggestions = suggestions.map(s => {
      if (s.isAnonymous && s.submittedBy !== userEmail) {
        return {
          ...s,
          submittedBy: 'anonim@ilerigroup.com',
          submittedByName: 'Anonim',
          submittedByDept: null
        }
      }
      return s
    })

    return NextResponse.json(processedSuggestions)
  } catch (error) {
    console.error('Öneriler yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Yeni öneri oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-suggestions: requireUser + session (ou LDAP-only)
    const { session, user, error } = await requireUser()
    if (error) return error

    const userEmail = user.email

    const body = await request.json()
    const {
      title,
      description,
      currentSituation,
      proposedSolution,
      expectedBenefit,
      estimatedSavings,
      categoryId,
      priority,
      suggestionType,
      isAnonymous,
      attachments
    } = body

    // Validasyon
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Başlık ve açıklama zorunludur' },
        { status: 400 }
      )
    }

    // Öneri numarası oluştur
    const suggestionNumber = await generateSuggestionNumber()

    // AD OU ismini Türkçe departman ismine çevir
    const adOuName = (session.user as { ou?: string }).ou
    const departmentName = await mapAdOuToDepartment(adOuName)

    // Öneriyi oluştur
    const suggestion = await prisma.suggestion.create({
      data: {
        suggestionNumber,
        title,
        description,
        currentSituation,
        proposedSolution,
        expectedBenefit,
        estimatedSavings: estimatedSavings ? parseFloat(estimatedSavings) : null,
        categoryId: categoryId || null,
        priority: priority || 'NORMAL',
        suggestionType: suggestionType || 'IMPROVEMENT',
        submittedBy: userEmail,
        submittedByName: user.name ?? userEmail,
        submittedByDept: departmentName,
        isAnonymous: isAnonymous || false,
        attachments: attachments ? JSON.stringify(attachments) : null,
        status: 'SUBMITTED'
      },
      include: {
        category: true
      }
    })

    // Timeline'a ekle
    await prisma.suggestionTimeline.create({
      data: {
        suggestionId: suggestion.id,
        action: 'Öneri Oluşturuldu',
        description: 'Yeni öneri sisteme gönderildi',
        performedBy: userEmail,
        performedByName: isAnonymous ? 'Anonim' : (user.name ?? userEmail),
        newStatus: 'SUBMITTED'
      }
    })

    // (a) Yöneticiye bildirim — YAZMA TAMAMLANDIKTAN SONRA, best-effort.
    // Helper kendi içinde try/catch'li: bildirim patlasa da öneri kaydı geri ALINMAZ.
    await bildirYeniOneri({
      id: suggestion.id,
      suggestionNumber: suggestion.suggestionNumber,
      title: suggestion.title,
      submittedBy: suggestion.submittedBy,
      submittedByName: suggestion.submittedByName,
      submittedByDept: suggestion.submittedByDept,
      isAnonymous: suggestion.isAnonymous,
      kategoriAdi: suggestion.category?.name ?? null,
    })

    return NextResponse.json(suggestion, { status: 201 })
  } catch (error) {
    console.error('Öneri oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
