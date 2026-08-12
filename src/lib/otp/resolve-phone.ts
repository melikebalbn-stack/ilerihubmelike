import { prisma } from '@/lib/prisma'

/**
 * Mavi yaka OTP — sicil no'dan telefon çözümleme.
 *
 * ÖLÇÜM (prod, 2026-08-12, 179 aktif mavi yaka kullanıcısı):
 *   düz join  (User.employeeId = Personnel.sicilNo) →  59/179  ❌
 *   normalize join                                  → 178/179  ✅
 *   telefonu hiç olmayan                            →   1
 *   cep görünümlü (5XXXXXXXXX)                      → 178/178
 *
 * NEDEN NORMALIZE ŞART: `User.employeeId` TUTARSIZ — 121 kayıt salt rakam
 * ("00740"), 58 kayıt "ILR-01071". `Personnel.sicilNo` ise tutarlı "ILR-XXXXX".
 * Normalize edilmezse kullanıcıların üçte ikisine OTP gönderilemez.
 *
 * NEDEN İKİ TELEFON KAYNAĞI: 106 kişide `User.mobilePhone` dolu, 72 kişide
 * YALNIZ `Personnel.telefon` dolu. Tek kaynak kullanılırsa 72 kişi dışarıda kalır.
 */

export interface CozulenTelefon {
  /** Gönderime hazır numara (DB'deki ham hali) */
  phone: string
  /** Kullanıcıya gösterilecek maskeli hali: "*** *** ** 12" */
  maskeli: string
  userId: string
  personnelId: string | null
}

/**
 * "00740" → "ILR-00740" · "ILR-01071" → "ILR-01071" · "740" → "ILR-00740"
 * Rakam dışı her şey atılır, 5 haneye sıfırla doldurulur.
 */
export function normalizeSicilNo(employeeId: string): string {
  const ham = employeeId.trim()
  if (/^ILR-/i.test(ham)) return ham.toUpperCase()
  const rakam = ham.replace(/\D/g, '')
  if (rakam === '') return ham.toUpperCase()
  return `ILR-${rakam.padStart(5, '0')}`
}

/** Son 2 hane açık, gerisi maskeli: "05321234512" → "*** *** ** 12" */
export function maskeleTelefon(phone: string): string {
  const rakam = phone.replace(/\D/g, '')
  if (rakam.length < 2) return '***'
  return `*** *** ** ${rakam.slice(-2)}`
}

/**
 * Sicil no ile OTP gönderilecek telefonu bulur.
 * Kullanıcı yoksa, pasifse veya hiçbir kaynakta telefon yoksa `null` döner —
 * çağıran taraf bunu "kod gönderilemedi" olarak ele almalı, AMA kullanıcıya
 * "bu sicil kayıtlı değil" dememeli (sicil no numaralandırması taranabilir).
 */
export async function resolvePhoneForEmployee(employeeId: string): Promise<CozulenTelefon | null> {
  const ham = employeeId.trim()
  if (ham === '') return null

  const user = await prisma.user.findUnique({
    where: { employeeId: ham },
    select: { id: true, mobilePhone: true, isActive: true },
  })
  if (!user || !user.isActive) return null

  // Personnel eşleşmesi NORMALIZE sicil ile (yukarıdaki ölçüme bak)
  const normalize = normalizeSicilNo(ham)
  const personnel = await prisma.personnel.findUnique({
    where: { sicilNo: normalize },
    select: { id: true, telefon: true },
  })

  const phone = (user.mobilePhone ?? personnel?.telefon ?? '').trim()
  if (phone === '') return null

  return {
    phone,
    maskeli: maskeleTelefon(phone),
    userId: user.id,
    personnelId: personnel?.id ?? null,
  }
}
