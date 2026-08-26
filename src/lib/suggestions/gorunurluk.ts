// Öneri görünürlüğü — TEK KAYNAK.
//
// Liste ucu (GET /api/suggestions) ve sayaç ucu (GET /api/suggestions/stats) AYNI kuralı
// buradan okur; kural iki route'ta KOPYALANMAZ. Eskiden sayaçlar hiç süzülmüyordu:
// herkes "Toplam Öneri 4" görüyor ama listede yalnız kendi önerisi çıkıyordu.
//
// Kural (mevcut davranış birebir korunur):
//   Kurul üyesi (SuggestionBoardMember) → TÜM öneriler
//   Yönetici (LDAP'ta astı olan)        → kendi + astlarının önerileri
//   Diğer herkes                        → yalnız kendi önerileri

import { getAllLDAPUsers } from '@/lib/ldap'
import { prisma } from '@/lib/prisma'

export type OneriGorunurluk = {
  userEmail: string
  isBoardMember: boolean
  isManager: boolean
  /** Kendi e-postası HARİÇ, LDAP'ta bu kullanıcıyı yönetici gösteren kişiler. */
  subordinateEmails: string[]
}

/**
 * Kullanıcının öneri modülündeki rolünü çözer. LDAP hatası görünürlüğü kırmaz:
 * ast listesi boş kalır, kullanıcı "normal kullanıcı" gibi davranır (fail-closed).
 */
export async function oneriGorunurlugu(args: {
  userEmail: string
  distinguishedName?: string | null
}): Promise<OneriGorunurluk> {
  const userEmail = args.userEmail.toLowerCase()

  const boardMembers = await prisma.suggestionBoardMember.findMany({
    where: { isActive: true },
    select: { email: true },
  })
  const isBoardMember = boardMembers.some((m) => m.email.toLowerCase() === userEmail)

  let subordinateEmails: string[] = []
  try {
    const myDN = args.distinguishedName?.toLowerCase()
    if (myDN) {
      const ldapUsers = await getAllLDAPUsers()
      subordinateEmails = ldapUsers
        .filter((u) => u.managerDN?.toLowerCase() === myDN)
        .map((u) => u.email?.toLowerCase())
        .filter((e): e is string => !!e)
    }
  } catch (err) {
    console.error('[oneri-gorunurluk] LDAP sorgusu basarisiz — ast listesi bos kabul edildi:', err)
  }

  return { userEmail, isBoardMember, isManager: subordinateEmails.length > 0, subordinateEmails }
}

/**
 * "Tümü" görünümünün Prisma `where` parçası. Kurul üyesinde `{}` döner (ek filtre yok).
 * Çağıran bunu kendi where nesnesine yayar (spread) — status/kategori filtreleri korunur.
 */
export function gorunurlukFiltresi(g: OneriGorunurluk): Record<string, unknown> {
  if (g.isBoardMember) return {}
  if (g.isManager) {
    const visibleEmails = [g.userEmail, ...g.subordinateEmails]
    return {
      OR: visibleEmails.map((email) => ({
        submittedBy: { equals: email, mode: 'insensitive' as const },
      })),
    }
  }
  return { submittedBy: { equals: g.userEmail, mode: 'insensitive' as const } }
}
