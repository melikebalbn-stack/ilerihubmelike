/**
 * TicketTeam.members — JSON şekli için TEK KAYNAK (parse / serialize / doğrula).
 *
 * DB'de `members String @db.Text` olarak duruyor; şekil yalnız şema yorumunda
 * tanımlıydı ve hiçbir yerde zorlanmıyordu. Bozuk JSON'ın sessizce girmesini
 * engellemek için tüm okuma/yazma bu dosyadan geçer.
 *
 * Şekil: [{ email: string (lowercase), name: string }]
 *
 * NOT (Faz 1 sınırı): `members` Text içinde JSON olduğu için "bu e-posta hangi
 * takımlarda" sorgusu SQL'de indekslenemez — üyelikle filtreleme gerektiğinde
 * (Faz 3 "Bana Atanan") aktif takımlar çekilip uygulamada filtrelenecek.
 * Takım sayısı düşük kaldığı sürece kabul edilebilir; büyürse ilişkisel bir
 * `TicketTeamMember` tablosuna taşınmalı.
 */

export interface TeamMember {
  email: string
  name: string
}

export type MembersParseResult =
  | { ok: true; members: TeamMember[] }
  | { ok: false; error: string }

/** DB'deki Text alanını güvenli parse eder. Bozuksa boş liste döner (patlamaz). */
export function parseMembers(raw: string | null | undefined): TeamMember[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((m): m is { email: unknown; name: unknown } => typeof m === 'object' && m !== null)
      .map((m) => ({
        email: typeof m.email === 'string' ? m.email.toLowerCase().trim() : '',
        name: typeof m.name === 'string' ? m.name.trim() : '',
      }))
      .filter((m) => m.email !== '')
  } catch {
    return []
  }
}

/** Kaydetmeden önce normalize eder: trim + lowercase e-posta + mükerrer temizliği. */
export function serializeMembers(members: TeamMember[]): string {
  const seen = new Set<string>()
  const clean: TeamMember[] = []
  for (const m of members) {
    const email = m.email.toLowerCase().trim()
    if (email === '' || seen.has(email)) continue
    seen.add(email)
    clean.push({ email, name: m.name.trim() })
  }
  return JSON.stringify(clean)
}

/**
 * API girdisini doğrular. Şekil hatalarını yakalar; e-postaların User tablosunda
 * gerçekten var olup olmadığını KONTROL ETMEZ — o DB erişimi gerektirdiği için
 * route katmanında (resolveMembers) yapılır.
 */
export function validateMembersInput(input: unknown): MembersParseResult {
  if (input === undefined || input === null) return { ok: true, members: [] }
  if (!Array.isArray(input)) return { ok: false, error: 'members bir dizi olmalıdır' }

  const members: TeamMember[] = []
  for (const [i, raw] of input.entries()) {
    if (typeof raw !== 'object' || raw === null) {
      return { ok: false, error: `members[${i}] nesne olmalıdır` }
    }
    const m = raw as { email?: unknown; name?: unknown }
    if (typeof m.email !== 'string' || m.email.trim() === '') {
      return { ok: false, error: `members[${i}].email zorunludur` }
    }
    members.push({
      email: m.email.toLowerCase().trim(),
      name: typeof m.name === 'string' ? m.name.trim() : '',
    })
  }
  return { ok: true, members }
}

/** Bir e-posta bu üye listesinde mi (Faz 3 yetki/görünürlük kontrolleri için). */
export function isTeamMember(members: TeamMember[], email: string | null | undefined): boolean {
  if (!email) return false
  const needle = email.toLowerCase().trim()
  return members.some((m) => m.email === needle)
}
