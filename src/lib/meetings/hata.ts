// Toplantı modülü — Prisma hatalarını KULLANICIYA ANLAŞILIR yanıta çevirir.
//
// NEDEN: uçların tamamı `catch` içinde 500 "Internal Server Error" döndürüyordu.
// Kullanıcı sebebi göremiyor, destek tarafı da her seferinde pm2 logu okumak
// zorunda kalıyordu (28.09 FK olayında hata yalnız logdan bulunabildi).
//
// KURAL: bilinen ve KULLANICI GİRDİSİNDEN kaynaklanan hatalar 400 döner;
// geri kalan her şey 500 kalır ve `console.error` ile loglanır — yani bu
// dosya hata YUTMAZ, yalnız sınıflandırır.

import { NextResponse } from 'next/server'
import { Prisma } from '@/generated/prisma'

/** Prisma hata kodu → Türkçe mesaj. Yalnız kullanıcı girdisiyle düzelebilecekler. */
const KULLANICI_HATALARI: Record<string, string> = {
  // Bağlı kayıt yok (ör. seçilen kişi veritabanında bulunmuyor)
  P2003: 'Seçilen kayıtlardan biri sistemde bulunamadı. Listeden yeniden seçip tekrar deneyin.',
  // Benzersizlik ihlali
  P2002: 'Bu kayıt zaten mevcut.',
  // İlişkili kayıt bulunamadı
  P2025: 'İşlem yapılacak kayıt bulunamadı.',
}

/**
 * Hatayı yanıta çevirir. `baglam` log satırında görünür (hangi uç patladı).
 * Dönen yanıtta teknik ayrıntı YOKTUR — yalnız hangi alanın sorunlu olduğu.
 */
export function toplantiHataYaniti(baglam: string, error: unknown): NextResponse {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mesaj = KULLANICI_HATALARI[error.code]
    if (mesaj) {
      // Hangi alan olduğunu söyleyebiliyorsak söyle — P2003'te `field_name` gelir.
      const alan = typeof error.meta?.field_name === 'string' ? error.meta.field_name : null
      console.warn(`[${baglam}] ${error.code}${alan ? ` (${alan})` : ''}: ${error.message.split('\n')[0]}`)
      return NextResponse.json({ error: mesaj, ...(alan ? { alan } : {}) }, { status: 400 })
    }
  }

  // Geçersiz enum / eksik alan gibi şema doğrulama hataları
  if (error instanceof Prisma.PrismaClientValidationError) {
    console.warn(`[${baglam}] şema doğrulama hatası: ${error.message.split('\n').slice(0, 3).join(' ')}`)
    return NextResponse.json(
      { error: 'Gönderilen veri geçersiz. Alanları kontrol edip tekrar deneyin.' },
      { status: 400 },
    )
  }

  console.error(`[${baglam}]`, error)
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
}

/**
 * Enum doğrulaması — geçersiz değer Prisma'ya GİTMEDEN 400 döner.
 * Prisma'ya bırakılırsa `PrismaClientValidationError` oluyor ve hangi alanın
 * sorunlu olduğu kullanıcıya söylenemiyordu (03.09.2026: meetingType "SUPPLIER").
 */
export function enumDogrula<T extends string>(
  alanAdi: string,
  deger: unknown,
  gecerliler: readonly T[],
): { ok: true; deger: T | undefined } | { ok: false; yanit: NextResponse } {
  if (deger === undefined || deger === null) return { ok: true, deger: undefined }
  if (typeof deger === 'string' && (gecerliler as readonly string[]).includes(deger)) {
    return { ok: true, deger: deger as T }
  }
  return {
    ok: false,
    yanit: NextResponse.json(
      {
        error: `"${alanAdi}" alanı geçersiz: "${String(deger)}". Geçerli değerler: ${gecerliler.join(', ')}`,
        alan: alanAdi,
      },
      { status: 400 },
    ),
  }
}

/** Şemadaki MeetingType değerleri — tek kaynak, uçlar liste gömmesin. */
export const TOPLANTI_TURLERI = [
  'BOARD', 'MANAGEMENT', 'DEPARTMENT', 'PROJECT', 'WEEKLY', 'MONTHLY',
  'ONE_ON_ONE', 'BRAINSTORM', 'TRAINING', 'REVIEW', 'EMERGENCY', 'OTHER',
] as const

/** Şemadaki MeetingStatus değerleri. */
export const TOPLANTI_DURUMLARI = [
  'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED',
] as const
