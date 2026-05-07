import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAllLDAPUsers } from '@/lib/ldap'
import { requireUser } from '@/lib/auth/require-user'

// GET - Kullanıcının bu öneri üzerindeki yetkilerini döndür
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-suggestions: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const suggestion = await prisma.suggestion.findUnique({
      where: { id },
    })

    if (!suggestion) {
      return NextResponse.json({ error: 'Öneri bulunamadı' }, { status: 404 })
    }

    const userEmail = user.email

    // Öneri Kurulu üyelerini al
    const boardMembers = await prisma.suggestionBoardMember.findMany({
      where: { isActive: true },
      select: { email: true },
    })
    const boardMemberEmails = boardMembers.map(m => m.email.toLowerCase())
    const isBoardMember = boardMemberEmails.includes(userEmail)

    // Öneriyi gönderenin manager'ı mı kontrol et
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

    // Yetkileri hesapla
    const permissions = {
      isOwner: suggestion.submittedBy.toLowerCase() === userEmail,
      isSubmitterManager,
      isBoardMember,
      canManagerApprove: isSubmitterManager &&
        (suggestion.status === 'SUBMITTED' || suggestion.status === 'UNDER_REVIEW'),
      canBoardApprove: isBoardMember && suggestion.status === 'PENDING_APPROVAL',
      canViewAllDetails: isBoardMember || isSubmitterManager,
      currentStatus: suggestion.status,
      currentApprovalLevel: suggestion.currentApprovalLevel,
    }

    return NextResponse.json(permissions)
  } catch (error) {
    console.error('Yetki kontrolü hatası:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
