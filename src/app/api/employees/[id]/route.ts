import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAllLDAPUsers, getDirectReports } from '@/lib/ldap'
import { publicCorporateEmail } from '@/lib/email-visibility'

interface EmployeeDetail {
  id: string
  name: string
  email: string | null
  department: string | null
  title: string | null
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

const NOT_FOUND = NextResponse.json(
  { error: 'Çalışan bulunamadı' },
  { status: 404 }
)

/**
 * GET /api/employees/[id]
 *
 * ID iki formatta gelebilir (list endpoint'inden):
 *   - LDAP username (ör. "melih.dilben") → User'a bağlı, AD entegre kayıt
 *   - "personnel-{cuid}" → User link'i olmayan Personnel-only kayıt (mavi yaka)
 *
 * Her durumda Personnel.aktif=true zorunlu.
 */
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

    // Aktif whitelist'ler (Ayarlar → İV Tanımları)
    const [activeBolumRows, activeGorevRows] = await Promise.all([
      prisma.departmentDefinition.findMany({ where: { isActive: true }, select: { name: true } }),
      prisma.jobTitle.findMany({ where: { isActive: true }, select: { name: true } }),
    ])
    const activeBolumSet = new Set(activeBolumRows.map(d => d.name))
    const activeGorevSet = new Set(activeGorevRows.map(j => j.name))

    // Personnel-only kayıt (User link'i yok) — mavi yaka çoğunlukla
    if (id.startsWith('personnel-')) {
      const personnelId = id.slice('personnel-'.length)
      const p = await prisma.personnel.findFirst({
        where: { id: personnelId, aktif: true },
        include: { user: { select: { extension3cx: true } } },
      })
      if (!p) return NOT_FOUND
      if (!activeBolumSet.has(p.bolum)) return NOT_FOUND
      if (!activeGorevSet.has(p.gorev)) return NOT_FOUND

      const employee: EmployeeDetail = {
        id,
        name: p.adSoyad,
        // KVKK (PR-DIRECTORY-KVKK-A): Personnel-only kayıt (mavi yaka, User
        // yok) için kurumsal email kaynağı YOK. Personnel.mailAdresi kişisel
        // email olabilir, response'a dahil edilmez.
        email: null,
        department: p.bolum,
        title: p.gorev,
        // SADECE şirket dahili (extension3cx). Personnel.telefon (cep) ASLA paylaşılmaz — KVKK.
        phone: p.user?.extension3cx || null,
        avatar: null,
        managerDN: null,
        manager: null,
        teamMembers: [],
      }
      return NextResponse.json(employee)
    }

    // LDAP-tabanlı kayıt — User var, AD entegre. Personnel.aktif zorunlu.
    const allUsers = await getAllLDAPUsers()
    const user = allUsers.find(u => u.username.toLowerCase() === id.toLowerCase())
    if (!user) return NOT_FOUND

    if (!user.email) return NOT_FOUND

    const linked = await prisma.user.findFirst({
      where: {
        email: { equals: user.email, mode: 'insensitive' },
        isActive: true,
        personnel: { aktif: true },
      },
      select: { id: true, extension3cx: true, personnel: { select: { bolum: true, gorev: true } } },
    })
    if (!linked) return NOT_FOUND
    if (linked.personnel) {
      if (!activeBolumSet.has(linked.personnel.bolum)) return NOT_FOUND
      if (!activeGorevSet.has(linked.personnel.gorev)) return NOT_FOUND
    }

    // Yönetici (LDAP'tan)
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
          // KVKK (PR-DIRECTORY-KVKK-A): sadece kurumsal email
          email: publicCorporateEmail(managerUser.email),
        }
      }
    }

    // Ekip üyeleri (LDAP'tan, sadece bu kişinin direkt raporları)
    const directReports = await getDirectReports(user.distinguishedName)
    const teamMembers = directReports.map(member => ({
      id: member.username,
      name: member.displayName,
      title: member.title,
      // KVKK (PR-DIRECTORY-KVKK-A): sadece kurumsal email
      email: publicCorporateEmail(member.email),
    }))

    const employee: EmployeeDetail = {
      id: user.username,
      name: user.displayName,
      // KVKK (PR-DIRECTORY-KVKK-A): sadece kurumsal email
      email: publicCorporateEmail(user.email),
      department: user.department,
      title: user.title,
      phone: linked.extension3cx || null,
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
