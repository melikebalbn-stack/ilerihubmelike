import { prisma } from '@/lib/prisma'

export interface YctOnaylayanZinciriAdimi {
  adimSira: number
  userId: string
}

interface OrgKoltuk {
  id: string
  reportsToId: string | null
}

/**
 * Ana sorumlunun OrgEmployee raporlama hattını izleyerek N seviye amiri çözer.
 * Zincir eksikse yalnız o ana kadar güvenle çözülen adımları döndürür.
 * Global onay kademesi fallback'i bu servisin sorumluluğunda değildir.
 */
export async function ycktOnaylayanZinciriCoz(
  anaSorumluUserId: string,
  kademeSayisi: number,
): Promise<YctOnaylayanZinciriAdimi[]> {
  if (!Number.isInteger(kademeSayisi) || kademeSayisi <= 0) return []

  const anaSorumlu = await prisma.user.findUnique({
    where: { id: anaSorumluUserId },
    select: { personnelId: true },
  })
  if (!anaSorumlu?.personnelId) return []

  const baslangicKoltugu = await prisma.orgEmployee.findFirst({
    where: { personnelId: anaSorumlu.personnelId, isActive: true },
    orderBy: { id: 'asc' },
    select: { id: true, reportsToId: true },
  })
  if (!baslangicKoltugu) return []

  const sonuc: YctOnaylayanZinciriAdimi[] = []
  let mevcutKoltuk: OrgKoltuk = baslangicKoltugu
  for (let adimSira = 1; adimSira <= kademeSayisi; adimSira++) {
    if (!mevcutKoltuk.reportsToId) break

    const amirKoltugu: (OrgKoltuk & { personnelId: string | null }) | null = await prisma.orgEmployee.findUnique({
      where: { id: mevcutKoltuk.reportsToId },
      select: { id: true, personnelId: true, reportsToId: true },
    })
    if (!amirKoltugu?.personnelId) break

    const amirPersonel = await prisma.personnel.findUnique({
      where: { id: amirKoltugu.personnelId },
      select: {
        user: { select: { id: true } },
      },
    })
    if (!amirPersonel?.user) break

    sonuc.push({ adimSira, userId: amirPersonel.user.id })
    mevcutKoltuk = amirKoltugu
  }

  return sonuc
}
