import { prisma } from '@/lib/prisma'
import { parseMembers, isTeamMember } from './team-members'

/**
 * "Bu kullanıcı hangi takımlarda?" — havuz görünürlüğü ve yetki kontrollerinin
 * ortak kaynağı (liste, sayaç, kapatma yetkisi üçü de bunu kullanır).
 *
 * NEDEN UYGULAMADA FİLTRELEME: `TicketTeam.members` Text içinde JSON tutuyor,
 * bu yüzden "e-postası şu olan takımlar" sorgusu SQL'de indekslenemiyor.
 * Aktif takımlar çekilip bellekte süzülüyor. Takım sayısı düşük olduğu sürece
 * ucuz (tek sorgu, birkaç satır); büyürse `TicketTeamMember` ilişkisel tablosuna
 * taşınmalı — o zaman burası tek satırlık bir `findMany` ile değişir, çağıranlar
 * değişmez.
 */
export async function getMyTeamIds(email: string | null | undefined): Promise<string[]> {
  if (!email) return []
  const teams = await prisma.ticketTeam.findMany({
    where: { isActive: true },
    select: { id: true, members: true },
  })
  return teams.filter((t) => isTeamMember(parseMembers(t.members), email)).map((t) => t.id)
}

/**
 * "Bana atanan" filtresi — havuz dahil.
 * Kişiye atanmış VEYA üyesi olduğum bir takıma düşmüş ticket'lar.
 * Takımım yoksa yalnız kişisel atama kalır.
 */
export function assignedToMeFilter(email: string, myTeamIds: string[]): Record<string, unknown> {
  if (myTeamIds.length === 0) return { assignedTo: email }
  return { OR: [{ assignedTo: email }, { assignedTeamId: { in: myTeamIds } }] }
}
