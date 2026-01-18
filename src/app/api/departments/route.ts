import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAllLDAPUsers } from '@/lib/ldap'

// GET - Departman listesi
export async function GET(request: Request) {
  try {
    // Kimlik doğrulama kontrolü
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeUsers = searchParams.get('includeUsers') === 'true'

    // Veritabanından departmanları çek
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        adOuName: true,
        adOuDn: true,
        sortOrder: true,
      },
    })

    // Eğer kullanıcılar da isteniyorsa AD'den çek
    if (includeUsers) {
      const ldapUsers = await getAllLDAPUsers()

      const departmentsWithUsers = departments.map(dept => {
        // AD OU'suna göre kullanıcıları filtrele
        const users = ldapUsers.filter(user => {
          // OU'yu DN'den çıkar
          if (!user.distinguishedName) return false
          const ouMatch = user.distinguishedName.match(/OU=([^,]+)/)
          return ouMatch && ouMatch[1] === dept.adOuName
        }).filter(user => user.email) // Email olmayanları çıkar
          .map(user => ({
            id: user.distinguishedName,
            name: user.displayName,
            email: user.email,
            username: user.username,
            title: user.title,
          }))

        return {
          ...dept,
          users,
          userCount: users.length,
        }
      })

      return NextResponse.json(departmentsWithUsers)
    }

    return NextResponse.json(departments)
  } catch (error) {
    console.error('Departman listesi hatası:', error)
    return NextResponse.json(
      { error: 'Departmanlar yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}
