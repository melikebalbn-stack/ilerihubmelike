import { prisma } from '@/lib/prisma'
import { adNormalize } from '@/lib/org/normalize-ad'

export interface ResolvedApprovers {
  approverId: string | null
  approverId2: string | null
  approverId3: string | null
  /** Onaycı 1./2./3. Sorumlu'dan değil, bölüm müdüründen türetildiyse true. */
  fallbackKullanildi?: boolean
}

type Aday = { id: string; adSoyad: string; userId: string | null }

/**
 * Aktif personel havuzu — TEK sorgu (≈190 satır). Eskiden her sorumlu alanı için
 * ayrı findFirst atılıyordu; normalize karşılaştırma SQL'de yapılamadığı için
 * havuz belleğe alınıp burada eşleştiriliyor.
 */
async function aktifAdayHavuzu(): Promise<Aday[]> {
  const kayitlar = await prisma.personnel.findMany({
    where: { aktif: true },
    select: { id: true, adSoyad: true, user: { select: { id: true } } },
  })
  return kayitlar.map((k) => ({ id: k.id, adSoyad: k.adSoyad, userId: k.user?.id ?? null }))
}

/**
 * Serbest metin sorumlu adını User.id'ye çözer. Eşleşme adNormalize üzerinden:
 * Türkçe büyük harf + aksan sadeleştirme + vekâlet eki ("V." öneki, "(V)" soneki)
 * temizliği. Eski `equals` karşılaştırması bu yazımları ıskalıyordu.
 *
 * Tam 1 eşleşme → user.id (User yoksa null); 0 eşleşme → null;
 * >1 eşleşme → null + uyarı (yanlış kişiye onay düşürmektense boş bırak).
 */
export function resolveApproverByName(havuz: Aday[], name: string | null): string | null {
  const hedef = adNormalize(name ?? '')
  if (!hedef) return null

  const eslesenler = havuz.filter((a) => adNormalize(a.adSoyad) === hedef)
  if (eslesenler.length === 0) return null
  if (eslesenler.length > 1) {
    console.warn(`[onayci] belirsiz ad: ${name} -> ${eslesenler.length} eşleşme`)
    return null
  }
  return eslesenler[0].userId
}

/**
 * Son çare: gönderenin bölümünün DepartmentDefinition kaydından müdür (yoksa
 * müdür yardımcısı) User'ı. 1./2./3. Sorumlu'nun üçü de çözülemediğinde devreye
 * girer — kayıt kimseye düşmeden BEKLIYOR'da asılı kalmasın diye.
 */
async function bolumMudurundenOnayci(bolum: string | null): Promise<string | null> {
  if (!bolum || !bolum.trim()) return null

  const tanimlar = await prisma.departmentDefinition.findMany({
    select: { name: true, mudurId: true, mudurYardimcisiId: true },
  })
  const hedef = adNormalize(bolum)
  const tanim = tanimlar.find((d) => adNormalize(d.name) === hedef)
  if (!tanim) return null

  for (const personnelId of [tanim.mudurId, tanim.mudurYardimcisiId]) {
    if (!personnelId) continue
    const kisi = await prisma.personnel.findFirst({
      where: { id: personnelId, aktif: true },
      select: { user: { select: { id: true } } },
    })
    if (kisi?.user?.id) return kisi.user.id
  }
  return null
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
    select: { birimSorumlusu: true, sorumlu2: true, sorumlu3: true, bolum: true },
  })

  if (!personnel) return { approverId: null, approverId2: null, approverId3: null }

  const havuz = await aktifAdayHavuzu()
  const resolved = [
    resolveApproverByName(havuz, personnel.birimSorumlusu),
    resolveApproverByName(havuz, personnel.sorumlu2),
    resolveApproverByName(havuz, personnel.sorumlu3),
  ]

  // Kişi KENDİ Sorumlu'su olarak tanımlıysa (kendi adı 1./2./3. Sorumlu alanında)
  // kendi kaydını kendisi ONAYLAYAMAZ — gönderen User'ı aday havuzundan baştan çıkar.
  // Kalan aday yoksa kayıt orphan (üçü-null) olur ve İV listesine düşer.
  const ownUser = await prisma.user.findFirst({
    where: { personnelId },
    select: { id: true },
  })

  // Aynı kişi birden fazla Sorumlu alanına çözülürse, tekrarları boş bırak
  // (bildirim/onay yetkisi tek kayıtta zaten geçerli olur). seen'i gönderen User ile
  // tohumla → kendi adına çözülen slot(lar) otomatik elenir.
  const seen = new Set<string>()
  if (ownUser?.id) seen.add(ownUser.id)
  const deduped = resolved.map((id) => {
    if (!id || seen.has(id)) return null
    seen.add(id)
    return id
  })

  if (deduped.some((id) => id !== null)) {
    return { approverId: deduped[0], approverId2: deduped[1], approverId3: deduped[2] }
  }

  // FALLBACK: üç Sorumlu alanı da çözülemedi → bölüm müdürü / müdür yardımcısı.
  const mudurUserId = await bolumMudurundenOnayci(personnel.bolum)
  if (mudurUserId && !seen.has(mudurUserId)) {
    console.info(`[onayci] fallback: bölüm müdürü kullanıldı (bolum=${personnel.bolum})`)
    return { approverId: mudurUserId, approverId2: null, approverId3: null, fallbackKullanildi: true }
  }

  return { approverId: null, approverId2: null, approverId3: null }
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
