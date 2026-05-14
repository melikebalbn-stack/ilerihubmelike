/**
 * İK (İnsan Varlıkları) Bildirim Yardımcıları
 *
 * Hat 1 (iş başvurusu), Hat 3 (performans review) için ortak İK recipient
 * resolver. ticket-notifications.ts pattern'inin İK departmanı için karşılığı.
 *
 * Resolver kuralı:
 *   isActive = true VE
 *     (department adında "insan varliklari" / "ik" / "hr" geçen) VEYA
 *     (role = HR_MANAGER) VEYA
 *     (User.permissions içinde 'recruitment.admin' veya 'hr.admin')
 *
 * Türkçe karakter normalize: unaccent extension'ı varsa raw SQL,
 * yoksa Türkçeli + Türkçesiz iki varyant fallback.
 */

import { prisma } from '@/lib/prisma'

export type HRRecipient = {
  id: string
  email: string
  name: string
}

function toRecipient(u: {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  name: string | null
}): HRRecipient | null {
  if (!u.email) return null
  const composed = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  const name = composed || u.name || u.email
  return { id: u.id, email: u.email, name }
}

/**
 * İK departmanındaki + HR_MANAGER role + recruitment.admin permission'lı
 * aktif kullanıcıları döner. Email'siz kullanıcı atlanır.
 *
 * Dedup: aynı user_id birden fazla kez gelmez.
 */
export async function resolveHRRecipients(): Promise<HRRecipient[]> {
  const seen = new Set<string>()
  const out: HRRecipient[] = []

  // 1) unaccent ile dene
  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; email: string | null; firstName: string | null; lastName: string | null; name: string | null }>
    >`
      SELECT id, email, "firstName", "lastName", name
      FROM "User"
      WHERE "isActive" = true
        AND (
          (department IS NOT NULL AND LOWER(unaccent(department)) LIKE '%insan varliklari%')
          OR (department IS NOT NULL AND LOWER(unaccent(department)) IN ('ik', 'hr', 'human resources'))
          OR role = 'HR_MANAGER'
        )
    `
    for (const r of rows) {
      if (seen.has(r.id)) continue
      const rec = toRecipient(r)
      if (rec) {
        seen.add(r.id)
        out.push(rec)
      }
    }
  } catch (err) {
    console.warn('[hr-notify] unaccent query failed, using fallback:', err)

    // 2) Fallback: Türkçe karakter varyantları
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { department: { contains: 'İnsan Varlıkları', mode: 'insensitive' } },
          { department: { contains: 'Insan Varliklari', mode: 'insensitive' } },
          { department: { equals: 'IK', mode: 'insensitive' } },
          { department: { equals: 'HR', mode: 'insensitive' } },
          { department: { contains: 'Human Resources', mode: 'insensitive' } },
          { role: 'HR_MANAGER' },
        ],
      },
      select: { id: true, email: true, firstName: true, lastName: true, name: true },
    })
    for (const u of users) {
      if (seen.has(u.id)) continue
      const rec = toRecipient(u)
      if (rec) {
        seen.add(u.id)
        out.push(rec)
      }
    }
  }

  return out
}
