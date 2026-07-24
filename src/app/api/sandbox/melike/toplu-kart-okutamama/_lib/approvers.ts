import { prisma } from '@/lib/prisma'

export interface ResolvedApprovers {
  approverId: string | null
  approverId2: string | null
}

async function resolveApproverUserId(name: string | null): Promise<string | null> {
  if (!name || !name.trim()) return null

  const personnel = await prisma.personnel.findFirst({
    where: { adSoyad: { equals: name.trim(), mode: 'insensitive' }, aktif: true },
    select: { user: { select: { id: true } } },
  })

  return personnel?.user?.id ?? null
}

/**
 * Beyaz Yaka'nın kendi adına girdiği kayıt için onaylayıcı adaylarını çözer —
 * Personnel Yönetimi'ndeki "1. Sorumlu" (birimSorumlusu) ve "2. Sorumlu"
 * (sorumlu2) isim alanlarından. Bu alanlar serbest metin (ID değil), bu yüzden
 * eşleşme aktif Personel adı üzerinden yapılır; o Personel'e bağlı kullanıcı
 * hesabı yoksa o aday devre dışı kalır. İkisi de çözülemezse çağıran taraf
 * onay adımını atlayıp kaydı direkt onaylı sayar.
 */
export async function resolveApprovers(personnelId: string): Promise<ResolvedApprovers> {
  const personnel = await prisma.personnel.findUnique({
    where: { id: personnelId },
    select: { birimSorumlusu: true, sorumlu2: true },
  })

  if (!personnel) return { approverId: null, approverId2: null }

  const approverId = await resolveApproverUserId(personnel.birimSorumlusu)
  const approverId2Raw = await resolveApproverUserId(personnel.sorumlu2)
  // Aynı kişi hem 1. hem 2. Sorumlu olarak çözülürse ikinci alanı boş bırak.
  const approverId2 = approverId2Raw && approverId2Raw !== approverId ? approverId2Raw : null

  return { approverId, approverId2 }
}
