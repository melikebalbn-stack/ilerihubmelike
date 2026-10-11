/**
 * Eskalasyonun 2. basamağı için bölüm müdürü — AD zinciri bittiğinde devreye girer.
 *
 * NEDEN: AD'de `manager` alanı genelde YALNIZ bir basamak dolu (çalışan → amiri);
 * müdürlerin kendi `manager` kaydı boş. Bu yüzden AD zinciri 1. basamakta bitiyor
 * ve eskalasyon üst yönetime düşüyordu (11.10.2026, GÖKÇE EKŞİOĞLU / İCRA KLASÖRÜ
 * maili). Hub kendi verisinde bölüm müdürünü zaten tutuyor —
 * DepartmentDefinition.mudurId / mudurYardimcisiId — AD yerine oradan okunur.
 */

import { prisma } from '@/lib/prisma'
import type { ZincirBasamak } from './eskalasyon-zinciri'

type PersonelMail = { adSoyad: string; mailAdresi: string | null; azureAdEmail: string | null }

function mailAl(p: PersonelMail | null | undefined): string | null {
  return p?.mailAdresi?.trim() || p?.azureAdEmail?.trim() || null
}

/**
 * `email` sahibinin bölüm müdürünü (yoksa müdür yardımcısını) döner.
 * `haricTut` içindeki adresler atlanır — kişinin kendisi ya da 1. basamakta
 * zaten bilgilendirilen yönetici tekrar mail almasın.
 */
export async function bolumMuduruBasamagi(
  email: string | null | undefined,
  haricTut: (string | null | undefined)[] = []
): Promise<ZincirBasamak | null> {
  if (!email) return null

  const eposta = email.trim().toLowerCase()
  const personel = await prisma.personnel.findFirst({
    where: {
      OR: [
        { mailAdresi: { equals: eposta, mode: 'insensitive' } },
        { azureAdEmail: { equals: eposta, mode: 'insensitive' } },
      ],
    },
    select: {
      department: {
        select: {
          name: true,
          mudur: { select: { adSoyad: true, mailAdresi: true, azureAdEmail: true } },
          mudurYardimcisi: { select: { adSoyad: true, mailAdresi: true, azureAdEmail: true } },
        },
      },
    },
  })

  const bolum = personel?.department
  if (!bolum) return null

  const yasak = new Set(
    [eposta, ...haricTut].filter(Boolean).map((e) => (e as string).trim().toLowerCase())
  )

  for (const aday of [bolum.mudur, bolum.mudurYardimcisi]) {
    const adres = mailAl(aday)
    if (!adres || yasak.has(adres.toLowerCase())) continue
    return {
      email: adres,
      displayName: aday?.adSoyad ?? adres,
      title: bolum.name ? `${bolum.name} Müdürü` : null,
      distinguishedName: '', // Hub verisinden geldi, AD DN'i yok
    }
  }

  return null
}
