import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAllLDAPUsers, getDirectReports, LDAPUser } from '@/lib/ldap'

// Çalışan detay formatı
interface EmployeeDetail {
  id: string
  name: string
  email: string | null
  department: string | null
  title: string | null
  location: string | null
  phone: string | null
  avatar: string | null
  managerDN: string | null
  manager: {
    id: string
    name: string
    title: string | null
    email: string | null
  } | null
  teamMembers: {
    id: string
    name: string
    title: string | null
    email: string | null
  }[]
}

// GET /api/employees/[id] - Tek çalışan detay
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // LDAP'tan tüm kullanıcıları al
    const allUsers = await getAllLDAPUsers()

    // Kullanıcıyı bul
    const user = allUsers.find(u => u.username.toLowerCase() === id.toLowerCase())

    if (!user) {
      return NextResponse.json(
        { error: 'Çalışan bulunamadı' },
        { status: 404 }
      )
    }

    // Yöneticiyi bul
    let manager: EmployeeDetail['manager'] = null
    if (user.managerDN) {
      const managerUser = allUsers.find(u =>
        u.distinguishedName.toLowerCase() === user.managerDN?.toLowerCase()
      )
      if (managerUser) {
        manager = {
          id: managerUser.username,
          name: managerUser.displayName,
          title: managerUser.title,
          email: managerUser.email,
        }
      }
    }

    // Ekip üyelerini bul (bu kişinin yönettiği kişiler)
    const directReports = await getDirectReports(user.distinguishedName)
    const teamMembers = directReports.map(member => ({
      id: member.username,
      name: member.displayName,
      title: member.title,
      email: member.email,
    }))

    const employee: EmployeeDetail = {
      id: user.username,
      name: user.displayName,
      email: user.email,
      department: user.department,
      title: user.title,
      location: user.ou,
      phone: null,
      avatar: null,
      managerDN: user.managerDN,
      manager,
      teamMembers,
    }

    return NextResponse.json(employee)

  } catch (error) {
    console.error('Employee detail API error:', error)
    return NextResponse.json(
      { error: 'Çalışan detayı alınamadı' },
      { status: 500 }
    )
  }
}
