import { prisma } from '@/lib/prisma'
import { amirCozumle } from '@/lib/is-analizi/amir-cozumle'

export interface YctOnaylayanZinciriAdimi {
  adimSira: number
  userId: string
}

/**
 * Ana sorumlunun amir zincirini ortak İş Analizi çözümleyicisiyle izler.
 * Birincil koltuk seçimi, boş koltukların atlanması ve kişinin kendisini amir
 * seçmeme kuralları amir-cozumle.ts / birincil-koltuk.ts içinde tek kaynaktır.
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

  const sonuc: YctOnaylayanZinciriAdimi[] = []
  let mevcutPersonnelId = anaSorumlu.personnelId
  const ziyaretEdilenPersonnelIdleri = new Set([mevcutPersonnelId])

  for (let adimSira = 1; adimSira <= kademeSayisi; adimSira++) {
    const amir = await amirCozumle(mevcutPersonnelId)
    const amirPersonnelId = amir.amirPersonnelId
    if (amir.kaynak !== 'ORG' || !amir.guvenilir || !amirPersonnelId || ziyaretEdilenPersonnelIdleri.has(amirPersonnelId)) break

    const amirPersonel = await prisma.personnel.findUnique({
      where: { id: amirPersonnelId },
      select: {
        user: { select: { id: true } },
      },
    })
    if (!amirPersonel?.user) break

    sonuc.push({ adimSira, userId: amirPersonel.user.id })
    ziyaretEdilenPersonnelIdleri.add(amirPersonnelId)
    mevcutPersonnelId = amirPersonnelId
  }

  return sonuc
}
