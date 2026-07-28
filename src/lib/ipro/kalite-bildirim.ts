// Kalite duruşu bildirimi (Melike #8) — paylaşılan helper.
//
// NEDEN LIB (route DEĞİL): Next.js App Router prod build'i route dosyalarından yalnız
// HTTP metodlarının export edilmesine izin verir (23.07.2026 commit 41bc0dc7 dersi).
// İçerik üretimi + gönderim burada; durus-basla/route.ts buradan çağırır.
import { sendEmail } from '@/lib/email'

/** Alıcı env'den; yoksa güvenli fallback (ldap-sync deseni: env > fallback). */
const KALITE_MAIL_FALLBACK = 'melih.dilben@ilerigroup.com'
export function kaliteAliciAdresi(): string {
  return process.env.IPRO_KALITE_MAIL?.trim() || KALITE_MAIL_FALLBACK
}

export interface KaliteBildirimGirdi {
  tezgahKod: string
  tezgahAd: string
  sebepAd: string
  /** Operatör sicil (personnelId — çıplak string, FK yok). */
  sicil: string
  baslangic: Date
  /** Kiosktan yazılan opsiyonel not; boşsa içerikte satır düşmez. */
  yorum: string | null
}

export interface KaliteBildirimIcerik {
  subject: string
  body: string
}

/**
 * Mail içeriğini üretir — SAF (yan etkisiz, test edilir). Yorum boşsa o satır DÜŞMEZ.
 */
export function kaliteBildirimIcerik(g: KaliteBildirimGirdi): KaliteBildirimIcerik {
  const saat = g.baslangic.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
  const satirlar = [
    `Tezgah: ${g.tezgahKod} — ${g.tezgahAd}`,
    `Duruş sebebi: ${g.sebepAd}`,
    `Operatör (sicil): ${g.sicil}`,
    `Başlangıç: ${saat}`,
  ]
  const yorum = g.yorum?.trim()
  if (yorum) satirlar.push(`Not: ${yorum}`)
  return {
    subject: `Kalite Duruşu — ${g.tezgahKod} (${g.sebepAd})`,
    body: `Kalite bildirimi gerektiren bir duruş başladı.\n\n${satirlar.join('\n')}`,
  }
}

/**
 * Kalite bildirimini gönderir. Çağıran BLOKLAMAMALI (fire-and-forget + .catch) —
 * mail başarısız olsa da duruş akışı sürer. Bu fonksiyon awaitable; testte mock'lanır.
 */
export async function gonderKaliteBildirimi(g: KaliteBildirimGirdi): Promise<{ success: boolean; error?: string }> {
  const { subject, body } = kaliteBildirimIcerik(g)
  return sendEmail([{ email: kaliteAliciAdresi(), name: 'Kalite' }], subject, body)
}
