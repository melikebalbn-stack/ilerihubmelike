/**
 * IFS Raporlar (eğitim modülü /ifs/raporlar) DİNAMİK erişim kuralı — TEK KAYNAK.
 *
 * Erişim (OR):
 *   a) ifs.rapor.view izni (mevcut RBAC — 8 kişiden Gökçe'ye daraltılacak, ayrı SQL)
 *   b) Personnel.gorev "MÜDÜR" içeriyor (Genel Müdür, GM Yrd., bölüm müdürü,
 *      müdür yardımcısı hepsi kapsanır)
 *   c) Personnel.bolum = "Sistem Geliştirme Müdürlüğü"
 *
 * super-admin bypass YOK. PostgreSQL `lower('İ')` combining-dot tuzağı yüzünden
 * karşılaştırma JS'te toLocaleUpperCase('tr-TR') ile yapılır (SQL'de değil).
 */
import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/lib/auth/get-user-permissions'

/** DB'de teyit edilen tek değer (DISTINCT: bolum ILIKE '%sistem%'). */
export const IFS_RAPOR_BOLUM = 'Sistem Geliştirme Müdürlüğü'

const trUpper = (s: string) => s.toLocaleUpperCase('tr-TR')

export async function canIfsRaporView(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false

  // (a) izin
  const perms = await getUserPermissions(userId)
  if (perms.has('ifs.rapor.view')) return true

  // (b)(c) Personnel görev/bölüm — JS'te tr-TR karşılaştırma (lower('İ') tuzağı yok)
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { personnel: { select: { gorev: true, bolum: true, aktif: true } } },
  })
  const p = u?.personnel
  if (!p) return false

  if (trUpper(p.gorev ?? '').includes('MÜDÜR')) return true
  if (trUpper(p.bolum ?? '') === trUpper(IFS_RAPOR_BOLUM)) return true

  return false
}
