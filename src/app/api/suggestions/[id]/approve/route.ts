import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SuggestionStatus } from '@/generated/prisma'
import { getAllLDAPUsers } from '@/lib/ldap'

// POST - Öneriyi onayla/reddet
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { decision, comments, assignTo, assignToName, assignDept } = body

    // decision: APPROVE, REJECT, MANAGER_APPROVE, MANAGER_REJECT
    if (!decision) {
      return NextResponse.json({ error: 'Karar belirtilmelidir' }, { status: 400 })
    }

    const suggestion = await prisma.suggestion.findUnique({
      where: { id }
    })

    if (!suggestion) {
      return NextResponse.json({ error: 'Öneri bulunamadı' }, { status: 404 })
    }

    const userEmail = session.user.email.toLowerCase()

    // Öneri Kurulu üyelerini al
    const boardMembers = await prisma.suggestionBoardMember.findMany({
      where: { isActive: true },
      select: { email: true },
    })
    const boardMemberEmails = boardMembers.map(m => m.email.toLowerCase())
    const isBoardMember = boardMemberEmails.includes(userEmail)

    // Öneriyi gönderenin manager'ını bul
    let isSubmitterManager = false
    try {
      const ldapUsers = await getAllLDAPUsers()
      const submitter = ldapUsers.find(u => u.email?.toLowerCase() === suggestion.submittedBy.toLowerCase())
      if (submitter?.managerDN) {
        const manager = ldapUsers.find(u => u.distinguishedName.toLowerCase() === submitter.managerDN!.toLowerCase())
        if (manager?.email?.toLowerCase() === userEmail) {
          isSubmitterManager = true
        }
      }
    } catch (error) {
      console.error('LDAP sorgusu hatası:', error)
    }

    // Yetki kontrolü
    let canAct = false
    let approvalLevel = suggestion.currentApprovalLevel

    // Durum bazlı yetki kontrolü
    if (suggestion.status === 'SUBMITTED' || suggestion.status === 'UNDER_REVIEW') {
      // İlk aşama - Sadece manager onaylayabilir
      if (isSubmitterManager && (decision === 'MANAGER_APPROVE' || decision === 'MANAGER_REJECT')) {
        canAct = true
        approvalLevel = 1
      }
    } else if (suggestion.status === 'PENDING_APPROVAL') {
      // İkinci aşama - Sadece kurul üyeleri onaylayabilir
      if (isBoardMember && (decision === 'APPROVE' || decision === 'REJECT')) {
        canAct = true
        approvalLevel = 2
      }
    }

    // Kurul üyelerinin tüm önerileri görme yetkisi (reddetme dahil)
    if (isBoardMember && (decision === 'START_REVIEW' || decision === 'START_IMPLEMENTATION' ||
        decision === 'COMPLETE' || decision === 'CLOSE' || decision === 'RETURN' || decision === 'FORWARD')) {
      canAct = true
    }

    if (!canAct) {
      return NextResponse.json(
        { error: 'Bu işlemi gerçekleştirme yetkiniz yok' },
        { status: 403 }
      )
    }

    // Durum geçişlerini belirle
    let newStatus: SuggestionStatus = suggestion.status
    let timelineAction = ''
    let timelineDescription = ''

    switch (decision) {
      case 'MANAGER_APPROVE':
        newStatus = 'PENDING_APPROVAL'
        timelineAction = 'Yönetici Onayladı'
        timelineDescription = 'Öneri departman yöneticisi tarafından onaylandı ve Öneri Kuruluna iletildi'
        break

      case 'MANAGER_REJECT':
        newStatus = 'REJECTED'
        timelineAction = 'Yönetici Reddetti'
        timelineDescription = comments ? `Yönetici tarafından reddedildi: ${comments}` : 'Yönetici tarafından reddedildi'
        break

      case 'APPROVE':
        newStatus = 'APPROVED'
        timelineAction = 'Kurul Onayladı'
        timelineDescription = 'Öneri, Öneri Kurulu tarafından onaylandı'
        break

      case 'REJECT':
        newStatus = 'REJECTED'
        timelineAction = 'Kurul Reddetti'
        timelineDescription = comments ? `Kurul tarafından reddedildi: ${comments}` : 'Kurul tarafından reddedildi'
        break

      case 'RETURN':
        newStatus = 'SUBMITTED'
        timelineAction = 'İade Edildi'
        timelineDescription = comments ? `Düzeltme için iade edildi: ${comments}` : 'Düzeltme için iade edildi'
        break

      case 'FORWARD':
        newStatus = 'UNDER_REVIEW'
        timelineAction = 'İletildi'
        timelineDescription = assignToName
          ? `${assignToName} kişisine iletildi`
          : 'Değerlendirmeye iletildi'
        break

      case 'START_REVIEW':
        newStatus = 'UNDER_REVIEW'
        timelineAction = 'İncelemeye Alındı'
        timelineDescription = 'İncelemeye alındı'
        break

      case 'START_IMPLEMENTATION':
        newStatus = 'IN_PROGRESS'
        timelineAction = 'Uygulamaya Alındı'
        timelineDescription = 'Uygulamaya alındı'
        break

      case 'COMPLETE':
        newStatus = 'IMPLEMENTED'
        timelineAction = 'Tamamlandı'
        timelineDescription = 'Uygulama tamamlandı'
        break

      case 'CLOSE':
        newStatus = 'CLOSED'
        timelineAction = 'Kapatıldı'
        timelineDescription = 'Öneri kapatıldı'
        break

      default:
        return NextResponse.json({ error: 'Geçersiz karar' }, { status: 400 })
    }

    // FIX #23: Tüm işlemleri transaction içinde yap
    const updatedSuggestion = await prisma.$transaction(async (tx) => {
      // 1. Öneriyi güncelle
      const updated = await tx.suggestion.update({
        where: { id },
        data: {
          status: newStatus,
          currentApprovalLevel: approvalLevel,
          assignedTo: assignTo || suggestion.assignedTo,
          assignedToName: assignToName || suggestion.assignedToName,
          assignedDept: assignDept || suggestion.assignedDept,
          evaluationNotes: (decision === 'APPROVE' || decision === 'MANAGER_APPROVE' || decision === 'FORWARD')
            ? comments
            : suggestion.evaluationNotes,
          rejectionReason: (decision === 'REJECT' || decision === 'MANAGER_REJECT') ? comments : suggestion.rejectionReason,
          implementedDate: decision === 'COMPLETE' ? new Date() : suggestion.implementedDate,
          implementedBy: decision === 'COMPLETE' ? session.user.email : suggestion.implementedBy,
          implementedByName: decision === 'COMPLETE' ? session.user.name : suggestion.implementedByName
        },
        include: {
          category: true
        }
      })

      // 2. Onay geçmişine ekle
      if (['APPROVE', 'REJECT', 'RETURN', 'FORWARD', 'MANAGER_APPROVE', 'MANAGER_REJECT'].includes(decision)) {
        let approvalDecision: 'APPROVED' | 'REJECTED' | 'RETURNED' | 'FORWARDED' = 'APPROVED'
        if (decision === 'REJECT' || decision === 'MANAGER_REJECT') approvalDecision = 'REJECTED'
        else if (decision === 'RETURN') approvalDecision = 'RETURNED'
        else if (decision === 'FORWARD') approvalDecision = 'FORWARDED'

        await tx.suggestionApproval.create({
          data: {
            suggestionId: id,
            approvalLevel,
            approverEmail: session.user.email,
            approverName: session.user.name || 'Bilinmiyor',
            approverRole: approvalLevel === 1 ? 'Departman Yöneticisi' : 'Öneri Kurulu Üyesi',
            decision: approvalDecision,
            comments
          }
        })
      }

      // 3. Timeline'a ekle
      await tx.suggestionTimeline.create({
        data: {
          suggestionId: id,
          action: timelineAction,
          description: timelineDescription,
          performedBy: session.user.email,
          performedByName: session.user.name || 'Bilinmiyor',
          oldStatus: suggestion.status,
          newStatus
        }
      })

      return updated
    })

    return NextResponse.json(updatedSuggestion)
  } catch (error) {
    console.error('Öneri onaylanırken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
