import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAllLDAPUsers } from '@/lib/ldap'

// GET - Debug approval info (SADECE ADMIN, SADECE DEVELOPMENT)
export async function GET(request: NextRequest) {
  try {
    // FIX #10: Production'da bu endpoint tamamen kapalı
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SADECE ADMIN erişebilir - hassas debug bilgileri
    const userRole = session.user.role || 'EMPLOYEE'
    if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const userEmail = String(session.user.email).toLowerCase()
    const myDN = (session.user as { distinguishedName?: string }).distinguishedName?.toLowerCase()

    // LDAP kullanıcılarını al
    const ldapUsers = await getAllLDAPUsers()

    // Benim astlarım
    const subordinates = ldapUsers
      .filter(u => u.managerDN?.toLowerCase() === myDN)
      .map(u => ({
        username: u.username,
        email: u.email,
        managerDN: u.managerDN
      }))

    // Pending öneriler
    const pendingSuggestions = await prisma.suggestion.findMany({
      where: {
        isActive: true,
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }
      },
      select: {
        id: true,
        submittedBy: true,
        submittedByName: true,
        status: true
      }
    })

    // Astlarımın önerileri
    const subordinateEmails = subordinates.map(s => s.email?.toLowerCase()).filter(Boolean)
    const matchingSuggestions = pendingSuggestions.filter(s =>
      subordinateEmails.includes(s.submittedBy.toLowerCase())
    )

    return NextResponse.json({
      currentUser: {
        email: userEmail,
        distinguishedName: myDN
      },
      subordinates,
      subordinateEmails,
      pendingSuggestions,
      matchingSuggestions
    })
  } catch (error) {
    console.error('Debug hatası:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
