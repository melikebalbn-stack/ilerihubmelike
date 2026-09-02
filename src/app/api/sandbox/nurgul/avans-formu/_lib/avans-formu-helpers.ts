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
 * Sorumluluk alanlarında (birimSorumlusu/sorumlu2/sorumlu3/bolumMuduru) vekil/
 * yedek atamalar serbest metinde "(V)" soneki veya "V." / "V.<baş harf>." öneki
 * ile işaretleniyor (örn. "AHMET FARUK POLAT (V)", "V.BEDRİ GÜLER",
 * "V.R.ORKUN KIRÇUVALOĞLU" → gerçek kişi "RAHMİ ORKUN KIRÇUVALOĞLU"). Bu
 * işaretleri ayıklar; ayıklama olduysa vekilMi:true döner.
 */
function vekilIsaretiniAyikla(ham: string): { temizIsim: string; vekilMi: boolean } {
  let isim = ham.trim()
  let vekilMi = false

  const sonekEsleme = isim.match(/^(.*?)\s*\(\s*v\s*\)\s*$/i)
  if (sonekEsleme) {
    isim = sonekEsleme[1].trim()
    vekilMi = true
  }

  const onekEsleme = isim.match(/^V\.(?:[A-ZÇĞİÖŞÜ]\.)*\s*/i)
  if (onekEsleme) {
    isim = isim.slice(onekEsleme[0].length).trim()
    vekilMi = true
  }

  return { temizIsim: isim, vekilMi }
}

/**
 * Sorumluluk alanındaki ham değerin, hedef ad-soyad'a ait olup olmadığını
 * kontrol eder. Vekil işareti YOKSA tam eşleşme (mevcut davranış, sıkı) —
 * varsa işaret ayıklanıp geri kalan parça hedef ad-soyad'ın İÇİNDE mi diye
 * bakılır (örn. "V.R." ayıklanınca kalan "ORKUN KIRÇUVALOĞLU", hedef
 * "RAHMİ ORKUN KIRÇUVALOĞLU" içinde geçtiği için eşleşir). Vekil-dışı
 * girişlerde davranış değişmiyor — yanlış-pozitif riski büyümüyor.
 */
function sorumluAlaniEslesiyorMu(ham: string | null, hedefAdSoyad: string): boolean {
  if (!ham) return false
  const { temizIsim, vekilMi } = vekilIsaretiniAyikla(ham)
  const hedef = hedefAdSoyad.trim().toLowerCase()
  const temiz = temizIsim.toLowerCase()
  if (!temiz) return false
  return vekilMi ? hedef.includes(temiz) : hedef === temiz
}

/**
 * Verilen ad-soyad'ın (vekil işaretleri ayıklanarak) sorumlu/sorumlu2/
 * sorumlu3/bolumMuduru olarak geçtiği bölümlerin (dedup'lanmış) listesini
 * döner. Ekip büyüklüğüne bakmaz — sadece "sorumlu olarak geçiyor mu" sorusu.
 */
export async function bulSorumluBolumleri(adSoyad: string): Promise<string[]> {
  const adaylar = await prisma.personnel.findMany({
    where: {
      OR: [
        { birimSorumlusu: { not: null } },
        { sorumlu2: { not: null } },
        { sorumlu3: { not: null } },
        { bolumMuduru: { not: null } },
      ],
    },
    select: { bolum: true, birimSorumlusu: true, sorumlu2: true, sorumlu3: true, bolumMuduru: true },
  })

  const eslesenler = adaylar.filter(
    (p) =>
      sorumluAlaniEslesiyorMu(p.birimSorumlusu, adSoyad) ||
      sorumluAlaniEslesiyorMu(p.sorumlu2, adSoyad) ||
      sorumluAlaniEslesiyorMu(p.sorumlu3, adSoyad) ||
      sorumluAlaniEslesiyorMu(p.bolumMuduru, adSoyad)
  )

  return [...new Set(eslesenler.map((k) => k.bolum).filter((b): b is string => Boolean(b)))]
}

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

  const bolumler = await bulSorumluBolumleri(adSoyad)

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
