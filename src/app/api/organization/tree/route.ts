import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAllLDAPUsers, LDAPUser } from '@/lib/ldap'

// Organizasyon ağaç düğümü
interface OrgNode {
  id: string
  name: string
  title: string | null
  department: string | null
  email: string | null
  children: OrgNode[]
}

// GET /api/organization/tree - Organizasyon ağacı
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // LDAP'tan tüm kullanıcıları al
    const allUsers = await getAllLDAPUsers()

    // DN -> User haritası
    const userByDN = new Map<string, LDAPUser>()
    for (const user of allUsers) {
      userByDN.set(user.distinguishedName.toLowerCase(), user)
    }

    // Manager -> Direct Reports haritası
    const childrenByManagerDN = new Map<string, LDAPUser[]>()
    const rootUsers: LDAPUser[] = []

    for (const user of allUsers) {
      if (user.managerDN) {
        const managerDNLower = user.managerDN.toLowerCase()
        if (!childrenByManagerDN.has(managerDNLower)) {
          childrenByManagerDN.set(managerDNLower, [])
        }
        childrenByManagerDN.get(managerDNLower)!.push(user)
      } else {
        // Yöneticisi olmayan kişiler (üst yönetim)
        rootUsers.push(user)
      }
    }

    // Recursive olarak ağaç oluştur
    function buildTree(user: LDAPUser): OrgNode {
      const children = childrenByManagerDN.get(user.distinguishedName.toLowerCase()) || []

      // Çocukları isme göre sırala
      children.sort((a, b) =>
        (a.displayName || '').localeCompare(b.displayName || '', 'tr')
      )

      return {
        id: user.username,
        name: user.displayName,
        title: user.title,
        department: user.department,
        email: user.email,
        children: children.map(child => buildTree(child)),
      }
    }

    // Root kullanıcılardan ağaç oluştur
    // Eğer yöneticisi olmayan çok fazla kişi varsa, sadece manager olanları göster
    const rootsWithTeam = rootUsers.filter(user =>
      childrenByManagerDN.has(user.distinguishedName.toLowerCase())
    )

    // Eğer takımı olan root yoksa, tüm root'ları göster
    const roots = rootsWithTeam.length > 0 ? rootsWithTeam : rootUsers.slice(0, 10)

    // Root'ları unvana göre sırala (Genel Müdür, Müdür vb. önce gelsin)
    roots.sort((a, b) => {
      const titlePriority = (title: string | null): number => {
        if (!title) return 999
        const lower = title.toLowerCase()
        if (lower.includes('genel müdür') || lower.includes('ceo')) return 1
        if (lower.includes('direktör') || lower.includes('director')) return 2
        if (lower.includes('müdür') || lower.includes('manager')) return 3
        return 100
      }
      return titlePriority(a.title) - titlePriority(b.title)
    })

    const tree = roots.map(root => buildTree(root))

    // Departman listesi (filtre için)
    const departments = [...new Set(allUsers.map(u => u.department).filter(Boolean))]
      .sort((a, b) => (a || '').localeCompare(b || '', 'tr'))

    return NextResponse.json({
      tree,
      departments,
      totalEmployees: allUsers.length,
    })

  } catch (error) {
    console.error('Organization tree API error:', error)
    return NextResponse.json(
      { error: 'Organizasyon ağacı alınamadı' },
      { status: 500 }
    )
  }
}
