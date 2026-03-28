import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAllLDAPUsers, searchLDAPUsers } from '@/lib/ldap'
import { prisma } from '@/lib/prisma'

// GET - Kullanıcı listesi (On-Premise AD LDAP)
export async function GET(request: NextRequest) {
  try {
    // Kimlik doğrulama kontrolü - hassas kullanıcı bilgileri
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') || 'all' // 'ad', 'db', 'all'
    const search = searchParams.get('search')
    const department = searchParams.get('department')

    // Sadece veritabanından
    if (source === 'db') {
      const dbUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          ...(search && {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }),
          ...(department && { department: { contains: department, mode: 'insensitive' } }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          jobTitle: true,
          azureAdId: true,
          serviceRoute: true,
          mobilePhone: true,
          employeeId: true,
        },
        orderBy: { name: 'asc' },
      })

      return NextResponse.json(dbUsers)
    }

    // On-Premise AD (LDAP) den çek
    try {
      let ldapUsers
      if (search && search.length >= 2) {
        ldapUsers = await searchLDAPUsers(search)
      } else {
        ldapUsers = await getAllLDAPUsers()
      }

      // Departman filtresi
      if (department) {
        ldapUsers = ldapUsers.filter(user =>
          user.department?.toLowerCase().includes(department.toLowerCase())
        )
      }

      // LDAP kullanıcılarını formatla - sadece mail adresi olanlar
      const formattedUsers = ldapUsers
        .filter(user => {
          // Gerekli alanlar var mı?
          if (!user.displayName || !user.username) return false;
          // Email gerçek bir string mi? (null, undefined, boş array veya boş string değil)
          if (!user.email || typeof user.email !== 'string' || user.email.trim().length === 0) return false;
          return true;
        })
        .map(user => ({
          id: user.distinguishedName,
          name: user.displayName,
          email: user.email!,
          department: user.department,
          jobTitle: user.title,
          username: user.username,
          source: 'ldap' as const,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'))

      // Mavi yaka kullanıcıları DB'den ekle (LDAP'ta olmayan)
      const ldapEmails = new Set(formattedUsers.map(u => u.email.toLowerCase()))
      const blueCollarUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          employeeId: { not: null },
          name: { not: null },
          ...(search && {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { employeeId: { contains: search, mode: 'insensitive' } },
            ],
          }),
          ...(department && { department: { contains: department, mode: 'insensitive' } }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          jobTitle: true,
          employeeId: true,
        },
        orderBy: { name: 'asc' },
      })

      // LDAP'ta zaten olan mavi yaka kullanıcıları hariç tut
      const uniqueBlueCollar = blueCollarUsers
        .filter(u => u.email && !ldapEmails.has(u.email.toLowerCase()))
        .map(u => ({
          id: u.id,
          name: u.name || '',
          email: u.email,
          department: u.department,
          jobTitle: u.jobTitle,
          employeeId: u.employeeId,
          source: 'bluecollar' as const,
        }))

      const allUsers = [...formattedUsers, ...uniqueBlueCollar]
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'))

      return NextResponse.json(allUsers)
    } catch (ldapError) {
      console.warn('LDAP erişilemedi, veritabanından çekiliyor:', ldapError)

      // LDAP erişilemezse veritabanından çek
      const dbUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          ...(search && {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }),
          ...(department && { department: { contains: department, mode: 'insensitive' } }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          jobTitle: true,
          azureAdId: true,
        },
        orderBy: { name: 'asc' },
      })

      return NextResponse.json(dbUsers.map(u => ({ ...u, source: 'db' as const })))
    }
  } catch (error) {
    console.error('Kullanıcılar alınırken hata:', error)
    return NextResponse.json({ error: 'Kullanıcılar alınamadı' }, { status: 500 })
  }
}
