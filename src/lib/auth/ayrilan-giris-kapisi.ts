// Ayrılan personel giriş kapısı — LDAP doğrulaması geçen ama İK'da işten
// çıkışı yapılmış (Personnel.aktif=false) kişiyi oturum açmadan reddeder.
//
// NEDEN: AD hesabı kapatılmayan ayrılanlar girmeye devam ediyordu (15.09.2026
// ölçümü: Cihan Temel çıkış 24.08, sonrasında 15 giriş). Giriş yolu her
// başarılı bind'de User.isActive=true yazdığı için User bayrağı tek başına
// güvenilir değil; doğruluk kaynağı İK'nın Personnel.aktif alanı.
//
// EŞLEŞME SIRASI:
//   1. User.personnelId FK (varsa kesin).
//   2. FK yoksa ad: displayName'in "|" öncesi normalize edilip Personnel.adSoyad
//      ile karşılaştırılır; TAM 1 eşleşme şart, 0 veya >1 → kapı AÇIK.
// Personnel bulunamazsa giriş serbest: servis/terminal hesapları FK'sız ve
// Personnel'siz, onlar kesilmez. Sistem hesapları hiç sorgulanmaz.
//
// Yardımcı yalnız kararı döner; log/throw çağıran (auth.ts) tarafında.
import { prisma } from '@/lib/prisma'
import { normalizeAd } from '@/lib/org/normalize-ad'
import { isSystemAccount } from '@/lib/auth/sistem-hesaplari'

/** Kullanıcıya gösterilen metin — login sayfası bu parçayı arar. */
export const AYRILAN_GIRIS_MESAJI = 'Hesabınız pasif durumda, IT ile iletişime geçin.'

/** auth.ts catch bloğu bu tipi genel hataya ÇEVİRMEZ, mesajı olduğu gibi geçirir. */
export class AyrilanPersonelError extends Error {
  constructor() {
    super(AYRILAN_GIRIS_MESAJI)
    this.name = 'AyrilanPersonelError'
  }
}

export type AyrilanKarar =
  | { engelle: false; yol: 'fk' | 'ad' | 'yok' | 'sistem'; sicilNo?: string }
  | { engelle: true; yol: 'fk' | 'ad'; sicilNo: string | null; adSoyad: string }

type PersonelSatir = { id: string; sicilNo: string | null; adSoyad: string; aktif: boolean }

/** Ad anahtarı: normalizeAd (büyük ASCII, tek boşluk) → küçük harf; SQL tarafı aynı kuralı uygular. */
function adAnahtari(displayName: string | null | undefined): string {
  const ham = (displayName ?? '').split('|')[0]
  return normalizeAd(ham).toLowerCase()
}

export async function ayrilanGirisKontrol(
  email: string,
  displayName: string | null | undefined,
): Promise<AyrilanKarar> {
  if (isSystemAccount(email)) return { engelle: false, yol: 'sistem' }

  // 1) FK
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { personnelId: true },
  })
  if (user?.personnelId) {
    const p = await prisma.personnel.findUnique({
      where: { id: user.personnelId },
      select: { sicilNo: true, adSoyad: true, aktif: true },
    })
    if (p && !p.aktif) return { engelle: true, yol: 'fk', sicilNo: p.sicilNo, adSoyad: p.adSoyad }
    return { engelle: false, yol: 'fk', sicilNo: p?.sicilNo ?? undefined }
  }

  // 2) Ad eşleşmesi — tam 1 kayıt şartı
  const anahtar = adAnahtari(displayName)
  if (!anahtar) return { engelle: false, yol: 'yok' }
  const adaylar = await prisma.$queryRaw<PersonelSatir[]>`
    SELECT id, "sicilNo", "adSoyad", aktif
      FROM "Personnel"
     WHERE btrim(regexp_replace(
             lower(translate("adSoyad", 'ÇĞIİÖŞÜçğıöşü', 'CGIIOSUcgiosu')),
             '[^a-z0-9]+', ' ', 'g')) = ${anahtar}`
  if (adaylar.length !== 1) return { engelle: false, yol: 'yok' }
  const p = adaylar[0]
  if (!p.aktif) return { engelle: true, yol: 'ad', sicilNo: p.sicilNo, adSoyad: p.adSoyad }
  return { engelle: false, yol: 'ad', sicilNo: p.sicilNo ?? undefined }
}
