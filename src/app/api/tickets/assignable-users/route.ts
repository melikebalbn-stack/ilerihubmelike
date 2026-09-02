import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

/**
 * GET /api/tickets/assignable-users
 * Ticket atanabilecek IT ekibi = `it-admin` / `helpdesk-agent` rolündeki aktif
 * kullanıcılar + ÇAĞIRANIN KENDİSİ (guard'dan geçtiği için ticket'ı yönetiyor;
 * rolü olmasa da kendine atayabilmeli). Çağıran listenin başında döner.
 * Yalnız IT ekibi (helpdesk.admin) çağırabilir. { id, name, email }.
 */
export async function GET() {
  const { session, user, error } = await requireUser()
  if (error) return error

  const isITStaff = session.user.permissions?.includes('helpdesk.admin') ?? false
  if (!isITStaff) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }

  // IT ekibi = 'it-admin' VEYA 'helpdesk-agent' ROLÜ. helpdesk.admin izni super-admin'de
  // de var ama üst yönetimi listeye sokar → super-admin BİLİNÇLİ hariç.
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      userRoles: { some: { role: { slug: { in: ['it-admin', 'helpdesk-agent'] } } } },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  // ÇAĞIRAN DA LİSTEDE: helpdesk.admin guard'ından geçmiş biri ticket'ı yönetir
  // ama it-admin/helpdesk-agent rolü olmayabilir (super-admin rol filtresinden
  // bilinçli hariç) — kendine atayamıyordu. Başa konuyor; işaretsiz, normal bir
  // satır olarak görünür (frontend değişmedi).
  const sirali = [user, ...users]

  // email zorunlu (atama email ile yapılıyor) + id bazlı tekilleştirme
  // (çağıran zaten rol filtresine takılmışsa iki kez görünmesin).
  const gorulen = new Set<string>()
  const assignable: Array<{ id: string; name: string; email: string }> = []
  for (const u of sirali) {
    if (!u.email || gorulen.has(u.id)) continue
    gorulen.add(u.id)
    assignable.push({ id: u.id, name: u.name ?? u.email, email: u.email })
  }

  return NextResponse.json(assignable)
}
