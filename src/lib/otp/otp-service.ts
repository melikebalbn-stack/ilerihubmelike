import { createHash, randomInt } from 'crypto'
import { prisma } from '@/lib/prisma'

/**
 * Mavi yaka OTP — kod üretme / doğrulama (Faz 1: SMS YOK).
 *
 * GÜVENLİK KURALLARI (hepsi burada, tek yerde):
 *   - Düz kod DB'de ASLA durmaz; yalnız SHA-256 hash saklanır.
 *   - Süre: 5 dakika (`expiresAt`).
 *   - TEK KULLANIM: doğrulanınca `usedAt` dolar, ikinci kez geçmez.
 *   - Deneme limiti: 3 yanlış denemeden sonra challenge ölür (brute force).
 *     6 haneli kodda 3 deneme = 3/1.000.000 şans.
 *   - Yeni kod istenince aynı sicilin ESKİ kullanılmamış kodları geçersiz kılınır
 *     (aksi halde 5 dakika içinde birden çok geçerli kod dolaşır).
 *
 * Faz 2 (NetGSM): `createChallenge` düz kodu DÖNER; gönderim çağıranın işi.
 * Faz 1'de kimseye gönderilmiyor.
 */

const KOD_UZUNLUK = 6
const GECERLILIK_DK = 5
const MAX_DENEME = 3

/** Sabit-zaman karşılaştırma gerekmiyor: hash'ler eşit uzunlukta ve gizli değil,
 *  ama yine de erken çıkışlı `===` yerine hash karşılaştırması yapılıyor. */
function hashla(kod: string): string {
  return createHash('sha256').update(kod).digest('hex')
}

/** 6 haneli, baştaki sıfırlar korunur ("000123" geçerli bir koddur). */
export function generateOtp(): string {
  return randomInt(0, 10 ** KOD_UZUNLUK).toString().padStart(KOD_UZUNLUK, '0')
}

export interface OlusturulanChallenge {
  challengeId: string
  /** DÜZ kod — SMS gönderimi için (Faz 2). DB'ye yazılmaz, loglanmaz. */
  kod: string
  expiresAt: Date
}

/**
 * Yeni OTP üretir, hash'ini kaydeder, düz kodu döner.
 * Aynı sicilin bekleyen kodlarını geçersiz kılar.
 */
export async function createChallenge(
  employeeId: string,
  phone: string,
): Promise<OlusturulanChallenge> {
  const kod = generateOtp()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + GECERLILIK_DK * 60 * 1000)

  // Eski bekleyenleri "kullanılmış" say → tek geçerli kod kalır.
  await prisma.otpChallenge.updateMany({
    where: { employeeId, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  })

  const kayit = await prisma.otpChallenge.create({
    data: { employeeId, phone, codeHash: hashla(kod), expiresAt },
    select: { id: true },
  })

  return { challengeId: kayit.id, kod, expiresAt }
}

export type DogrulamaSonucu =
  | { ok: true }
  | { ok: false; sebep: 'yok' | 'suresi_gecti' | 'kullanildi' | 'deneme_asildi' | 'kod_hatali' }

/** Kullanıcıya gösterilecek metin — sebep ayrımı LOGLANIR, kullanıcıya sadeleşir. */
export function dogrulamaMesaji(sebep: Exclude<DogrulamaSonucu, { ok: true }>['sebep']): string {
  switch (sebep) {
    case 'suresi_gecti':
      return 'Kodun süresi doldu. Yeni kod isteyin.'
    case 'deneme_asildi':
      return 'Çok fazla hatalı deneme. Yeni kod isteyin.'
    case 'kullanildi':
    case 'yok':
    case 'kod_hatali':
    default:
      // "kod yok" ile "kod yanlış" AYNI mesaj: sicil no taramasını zorlaştırır.
      return 'Kod hatalı veya geçersiz.'
  }
}

/**
 * Kodu doğrular. Başarılıysa challenge TÜKETİLİR (usedAt dolar).
 * Yanlışsa `attempts` artar; 3'e ulaşınca challenge kullanılamaz hale gelir.
 */
export async function verifyOtp(employeeId: string, kod: string): Promise<DogrulamaSonucu> {
  const now = new Date()

  // En SON üretilen challenge — eskiler createChallenge'da zaten geçersizlenmişti.
  const challenge = await prisma.otpChallenge.findFirst({
    where: { employeeId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, codeHash: true, expiresAt: true, usedAt: true, attempts: true },
  })

  if (!challenge) return { ok: false, sebep: 'yok' }
  if (challenge.usedAt) return { ok: false, sebep: 'kullanildi' }
  if (challenge.expiresAt <= now) return { ok: false, sebep: 'suresi_gecti' }
  if (challenge.attempts >= MAX_DENEME) return { ok: false, sebep: 'deneme_asildi' }

  if (challenge.codeHash !== hashla(kod)) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    })
    // Bu denemeyle limit dolduysa kullanıcıya doğru mesaj gitsin.
    const kalan = MAX_DENEME - (challenge.attempts + 1)
    return { ok: false, sebep: kalan <= 0 ? 'deneme_asildi' : 'kod_hatali' }
  }

  // Başarılı → TEK KULLANIM tüketilir. Koşullu update: iki eşzamanlı istek
  // aynı kodu iki kez kullanamasın (usedAt hâlâ null olan satırı günceller).
  const tuketildi = await prisma.otpChallenge.updateMany({
    where: { id: challenge.id, usedAt: null },
    data: { usedAt: now },
  })
  if (tuketildi.count === 0) return { ok: false, sebep: 'kullanildi' }

  return { ok: true }
}
