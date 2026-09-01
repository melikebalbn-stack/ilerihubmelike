import { prisma } from '@/lib/prisma'
import { getSandboxBySlug } from '@/lib/sandbox-config'

/**
 * DEV-TEST-AS / generate-notifications guard: e-postanın sandbox sahibinin
 * (Nurgül) e-postasıyla TAM eşleşip eşleşmediğini kontrol eder. SUPER_ADMIN
 * rolü tek başına yeterli değildir — ör. Melih de SUPER_ADMIN ama owner
 * e-postası bu değil, bu yüzden etkilenmez.
 */
export function isSandboxOwner(email: string): boolean {
  const ownerEmail = getSandboxBySlug('nurgul')?.ownerEmail
  return !!ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase()
}

export type SorumluPersonel = {
  id: string
  adSoyad: string
  bolum: string | null
  isSelf: boolean
}

export type SorumluEkibiSonucu =
  | {
      ok: true
      sorumlu: { id: string; adSoyad: string }
      bolumler: string[]
      personel: SorumluPersonel[]
    }
  // PERSONEL_YOK: kullanıcıya bağlı bir Personnel kaydı hiç bulunamadı.
  // EKIP_BOS: kendi Personnel kaydı bulundu ama sorumlu/müdür olduğu
  // hiçbir bölümde aktif mavi yaka personel yok — farklı senaryolar,
  // kullanıcıya farklı mesaj gösterilmeli.
  | { ok: false; reason: 'PERSONEL_YOK' | 'EKIP_BOS' }

/**
 * Verilen Personnel id'sinden yola çıkarak sorumlu/müdür olduğu bölümlerdeki
 * aktif mavi yaka personeli bulur (kendisi dahil). GET ve POST ortak mantığı.
 */
export async function bulSorumluVeEkibiByPersonnelId(
  personnelId: string
): Promise<SorumluEkibiSonucu> {
  const selfPersonnel = await prisma.personnel.findUnique({
    where: { id: personnelId },
  })

  if (!selfPersonnel) return { ok: false, reason: 'PERSONEL_YOK' }

  const adSoyad = selfPersonnel.adSoyad.trim()

  const sorumluOlduguKayitlar = await prisma.personnel.findMany({
    where: {
      OR: [
        { birimSorumlusu: { equals: adSoyad, mode: 'insensitive' } },
        { sorumlu2: { equals: adSoyad, mode: 'insensitive' } },
        { sorumlu3: { equals: adSoyad, mode: 'insensitive' } },
        { bolumMuduru: { equals: adSoyad, mode: 'insensitive' } },
      ],
    },
    select: { bolum: true },
  })

  const bolumler = [
    ...new Set(
      sorumluOlduguKayitlar.map((k) => k.bolum).filter((b): b is string => Boolean(b))
    ),
  ]

  const maviYakaListesi = bolumler.length
    ? await prisma.personnel.findMany({
        where: { bolum: { in: bolumler }, yakaRengi: 'MAVI', aktif: true },
        orderBy: { adSoyad: 'asc' },
      })
    : []

  if (maviYakaListesi.length === 0) return { ok: false, reason: 'EKIP_BOS' }

  const personel: SorumluPersonel[] = [
    {
      id: selfPersonnel.id,
      adSoyad: selfPersonnel.adSoyad,
      bolum: selfPersonnel.bolum,
      isSelf: true,
    },
    ...maviYakaListesi.map((p) => ({
      id: p.id,
      adSoyad: p.adSoyad,
      bolum: p.bolum,
      isSelf: false,
    })),
  ]

  return {
    ok: true,
    sorumlu: { id: selfPersonnel.id, adSoyad: selfPersonnel.adSoyad },
    bolumler,
    personel,
  }
}

/**
 * Giriş yapan kullanıcının kendi Personnel kaydı üzerinden ekibini bulur.
 * User → personnelId ilişkisiyle çözüp çekirdek fonksiyona devreder.
 */
export async function bulSorumluVeEkibi(userId: string): Promise<SorumluEkibiSonucu> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { personnelId: true },
  })

  if (!dbUser?.personnelId) return { ok: false, reason: 'PERSONEL_YOK' }

  return bulSorumluVeEkibiByPersonnelId(dbUser.personnelId)
}

/** GET/POST route'larında ok:false durumunu kullanıcıya gösterilecek mesaja çevirir. */
export function sonucHataMesaji(reason: 'PERSONEL_YOK' | 'EKIP_BOS'): string {
  return reason === 'EKIP_BOS'
    ? 'Sorumlusu olduğunuz birimde kayıtlı mavi yaka personel bulunamadı.'
    : 'Bu kullanıcıya bağlı bir personel kaydı bulunamadı.'
}
