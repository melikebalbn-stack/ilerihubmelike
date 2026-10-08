/**
 * Planlı görev sorumlularının adresini KURUMSAL kaynaktan çözer (08.10.2026).
 *
 * NEDEN SUNUCUDA: formda elle yazılabilir adres alanı yok, adres yalnız personel
 * seçicisinden geliyor — ama uçlar gövdedeki `email` değerine GÜVENİYORDU. Bir
 * istemci (ya da eski bir ekran) gövdeye istediği adresi yazabilir. Sicili olan
 * her sorumlunun adresi burada yeniden çözülür; gövdeden gelen değer yoksayılır.
 *
 * Sicili OLMAYAN sorumluda gövdedeki adres korunur: o kişiyi kurumsal kaynakta
 * arayacak anahtar yok, kaydı düşürmek yerine olduğu gibi bırakılır.
 *
 * Kurumsal adresi olmayan personelde `email: null` yazılır — kişi YİNE sorumlu
 * olur (Melih kararı): görev sicille bağlanır, Hub'da takip edilir, hatırlatma
 * maili gitmez ve görev özet raporunda "adres çözülemedi" olarak çıkar.
 * Aktif 188 personelin 131'i bu durumda (116 mavi, 12 gri, 3 beyaz yaka).
 */

import { prisma } from '@/lib/prisma'

export const KURUMSAL_ALAN = '@ilerigroup.com'

export type SorumluGirdisi = { name: string; email?: string | null; sicilNo?: string | null }

function kurumsalMi(e: string | null | undefined): string | null {
  const v = e?.trim().toLowerCase()
  return v && v.endsWith(KURUMSAL_ALAN) ? v : null
}

/**
 * Sorumlu listesindeki adresleri kurumsal kaynakla değiştirir.
 * Sıra: User.email (employeeId = sicilNo) → Personnel.azureAdEmail.
 * `Personnel.mailAdresi` KULLANILMAZ — kişisel adres taşıyor.
 */
export async function sorumlulariKurumsallastir(
  sorumlular: SorumluGirdisi[],
): Promise<SorumluGirdisi[]> {
  const siciller = [...new Set(sorumlular.map((s) => s.sicilNo?.trim()).filter((s): s is string => !!s))]
  if (siciller.length === 0) return sorumlular

  const [kullanicilar, personeller] = await Promise.all([
    prisma.user.findMany({
      where: { employeeId: { in: siciller }, isActive: true },
      select: { employeeId: true, email: true },
    }),
    prisma.personnel.findMany({
      where: { sicilNo: { in: siciller } },
      select: { sicilNo: true, azureAdEmail: true },
    }),
  ])
  const userIle = new Map(kullanicilar.map((u) => [u.employeeId!, u.email]))
  const azureIle = new Map(personeller.map((p) => [p.sicilNo!, p.azureAdEmail]))

  return sorumlular.map((s) => {
    const sicil = s.sicilNo?.trim()
    if (!sicil) return s
    const kurumsal = kurumsalMi(userIle.get(sicil)) ?? kurumsalMi(azureIle.get(sicil))
    return { ...s, email: kurumsal }
  })
}

/** Tek alanın (responsiblePersonEmail) kurumsal karşılığı — ilk sorumludan. */
export function ilkSorumluAdresi(sorumlular: SorumluGirdisi[]): string | null {
  return sorumlular[0]?.email?.trim().toLowerCase() || null
}
