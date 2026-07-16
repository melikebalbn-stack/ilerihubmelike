import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

/**
 * GET /api/tickets/assignable-users
 * Ticket atanabilecek IT ekibi = `helpdesk.admin` iznine sahip aktif kullanıcılar.
 * Yalnız IT ekibi (helpdesk.admin) çağırabilir. { id, name, email }.
 */
export async function GET() {
  const { session, error } = await requireUser()
  if (error) return error

  const isITStaff = session.user.permissions?.includes('helpdesk.admin') ?? false
  if (!isITStaff) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }

  // IT ekibi = 'it-admin' ROLÜ (izin değil): helpdesk.admin izni super-admin'de de var
  // ve yönetimi listeye sokar. Gerçek IT ekibi it-admin rolüyle tanımlı.
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      userRoles: { some: { role: { slug: 'it-admin' } } },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  // email zorunlu (atama email ile yapılıyor)
  const assignable = users
    .filter((u) => u.email)
    .map((u) => ({ id: u.id, name: u.name ?? u.email, email: u.email }))

  return NextResponse.json(assignable)
}
