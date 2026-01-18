import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAllLDAPUsers } from '@/lib/ldap'

// GET - Kullanıcının bu öneri üzerindeki yetkilerini döndür
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const suggestion = await prisma.suggestion.findUnique({
      where: { id },
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
