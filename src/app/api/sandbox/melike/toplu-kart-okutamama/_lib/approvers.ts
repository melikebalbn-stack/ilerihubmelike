import { prisma } from '@/lib/prisma'

export interface ResolvedApprovers {
  approverId: string | null
  approverId2: string | null
  approverId3: string | null
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
 * Kişinin KENDİ ADINA girdiği kayıt için onaylayıcı adaylarını çözer —
 * Personnel Yönetimi'ndeki "1. Sorumlu" (birimSorumlusu), "2. Sorumlu"
 * (sorumlu2) ve "3. Sorumlu" (sorumlu3) isim alanlarından. Bu alanlar serbest
 * metin (ID değil), bu yüzden eşleşme aktif Personel adı üzerinden yapılır;
 * o Personel'e bağlı kullanıcı hesabı yoksa o aday devre dışı kalır. Hiçbiri
 * çözülemezse çağıran taraf kaydı BEKLIYOR durumunda (kimseye atanmadan) bırakır
 * — otomatik onaylamaz.
 */
export async function resolveApprovers(personnelId: string): Promise<ResolvedApprovers> {
  const personnel = await prisma.personnel.findUnique({
    where: { id: personnelId },
    select: { birimSorumlusu: true, sorumlu2: true, sorumlu3: true },
  })

  if (!personnel) return { approverId: null, approverId2: null, approverId3: null }

  const resolved = await Promise.all([
    resolveApproverUserId(personnel.birimSorumlusu),
    resolveApproverUserId(personnel.sorumlu2),
    resolveApproverUserId(personnel.sorumlu3),
  ])

  // Aynı kişi birden fazla Sorumlu alanına çözülürse, tekrarları boş bırak
  // (bildirim/onay yetkisi tek kayıtta zaten geçerli olur).
  const seen = new Set<string>()
  const deduped = resolved.map((id) => {
    if (!id || seen.has(id)) return null
    seen.add(id)
    return id
  })

  return { approverId: deduped[0], approverId2: deduped[1], approverId3: deduped[2] }
}

/**
 * Ters yön: bu Personnel'in adı, başka kaç Personel'in 1./2./3. Sorumlu
 * alanında geçiyor — yani "ekibi" (yönettiği kişiler, yaka rengi fark etmez).
 * Kişi Personel Yönetimi'nde birinin sorumlusu olarak tanımlıysa, o kişi(ler)
 * için de kayıt girebilir — bu girişlerde onay akışı YOKTUR.
 */
export async function getManagedPersonnelIds(ownPersonnelId: string): Promise<string[]> {
  const own = await prisma.personnel.findUnique({
    where: { id: ownPersonnelId },
    select: { adSoyad: true },
  })
  if (!own) return []

  const matches = await prisma.personnel.findMany({
    where: {
      aktif: true,
      id: { not: ownPersonnelId },
      OR: [
        { birimSorumlusu: { equals: own.adSoyad, mode: 'insensitive' } },
        { sorumlu2: { equals: own.adSoyad, mode: 'insensitive' } },
        { sorumlu3: { equals: own.adSoyad, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  })

  return matches.map((m) => m.id)
}
