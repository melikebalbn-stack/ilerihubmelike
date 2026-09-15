// Fatura Takip erişim kontrolü — sadece Sistem Geliştirme departmanı + admin rolleri.
//
// NOT: substring eşleşmesi (dept.includes('sistem gelistirme')) KULLANMA — proje
// genelinde "İnsan Varlıkları" kontrolünde substring heuristiği "Mühendislik"
// gibi departmanları yanlış pozitif yakalamıştı (src/lib/auth/personnel-access.ts).
// Aynı hatayı tekrarlamamak için normalize + startsWith (tam-önek) kullanıyoruz.

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const

function normalizeDept(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/[İIı]/g, 'i')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Çç]/g, 'c')
    .replace(/[Öö]/g, 'o')
    .replace(/[Üü]/g, 'u')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function isSistemGelistirme(department: string | null | undefined): boolean {
  return normalizeDept(department).startsWith('sistem gelistirme')
}

export function canAccessFaturaTakip(role: string | null | undefined, department: string | null | undefined): boolean {
  return ADMIN_ROLES.includes((role ?? '') as (typeof ADMIN_ROLES)[number]) || isSistemGelistirme(department)
}
