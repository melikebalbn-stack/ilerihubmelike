// Toplantı modülü — kullanıcı anahtarını `User.id`'ye çeviren TEK KAYNAK.
//
// NEDEN: kullanıcı seçicileri LDAP kaynaklı sonuçlarda `User.id` DÖNDÜRMEZ —
// `/api/users` `distinguishedName`, `/api/users/search` ise `ldap_<username>`
// döndürür. Bu değerler doğrudan FK kolonlarına yazılınca
// `MeetingAgendaItem_presenterId_fkey` ihlali oluşuyor ve tüm istek 500'e
// düşüyordu (28.09.2026'da 8 kez yaşandı; `MeetingAgendaItem` tablosundaki
// 3 satırın 3'ünde de `presenterId` NULL kalmıştı).
//
// Başkan/raportör alanları bu sorunu e-posta → `User.id` çevrimiyle çözmüştü;
// gündem sunucusu o düzeltmenin dışında kalmıştı. Kural artık tek yerde.
//
// FAIL-SOFT: çözülemeyen anahtar `null` döner, istek PATLAMAZ. Toplantı
// kaydının kendisi sunucu bilgisinden daha önemli; ad zaten `presenterName`
// alanında saklanıyor.

import type { Prisma, PrismaClient } from '@/generated/prisma'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * Sırayla dener:
 *   1. e-posta (`@` içeriyorsa) → `User.email` (benzersiz, küçük harfe indirilir)
 *   2. doğrudan `User.id` → kayıt gerçekten VAR MI diye bakılır
 *   3. hiçbiri → `null`
 *
 * 2. adım geriye dönük uyum içindir: eski istemciler gerçek `User.id`
 * gönderiyorsa çalışmaya devam eder. Varlık kontrolü olmadan geçirmek, bu
 * fonksiyonun kapatmak için var olduğu FK ihlalini geri getirirdi.
 */
export async function toplantiKullaniciIdCoz(
  db: Db,
  anahtar: string | null | undefined,
): Promise<string | null> {
  if (typeof anahtar !== 'string') return null
  const deger = anahtar.trim()
  if (!deger) return null

  if (deger.includes('@')) {
    const u = await db.user.findUnique({
      where: { email: deger.toLowerCase() },
      select: { id: true },
    })
    return u?.id ?? null
  }

  const u = await db.user.findUnique({ where: { id: deger }, select: { id: true } })
  return u?.id ?? null
}
