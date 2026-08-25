import { Prisma } from '@/generated/prisma'

// Envanter uçlarında ortak hata mesajı üretici.
//
// SORUN: uçlar `err instanceof Error ? err.message : 'varsayılan'` yazıyordu.
// Servis katmanının attığı Türkçe mesajlar için bu DOĞRU davranış; ama Prisma'nın
// kendi hataları da `Error` olduğu için ham metin kullanıcıya gidiyordu:
//   "Invalid `prisma.envanterUrun.create()` invocation ... Expected EnvanterBedenTipi"
// Bu hem anlaşılmaz hem model/alan yapısını sızdırır.
//
// KURAL: Prisma kaynaklı hatalarda kullanıcı SABİT mesaj görür, ham metin yalnız
// sunucu loguna yazılır. Diğer Error'lar (servis doğrulamaları) aynen geçer.
// Desen personnel/[id]/route.ts'teki PrismaClientValidationError dalıyla aynı.

const PRISMA_MESAJI = 'Kaydedilemeyen alan var, sistem yöneticisine bildirin'

function prismaHatasiMi(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    // Bazı ortamlarda instanceof tutmaz (birden fazla client kopyası): ada da bak.
    (typeof (err as { name?: unknown })?.name === 'string' &&
      String((err as { name: string }).name).startsWith('PrismaClient'))
  )
}

/**
 * Kullanıcıya gösterilecek mesajı üretir.
 * @param err   yakalanan hata
 * @param varsayilan Prisma dışı, mesajsız hatalarda gösterilecek metin
 * @param baglam sunucu logunda görünecek etiket
 */
export function envanterHataMesaji(err: unknown, varsayilan: string, baglam = 'Envanter'): string {
  if (prismaHatasiMi(err)) {
    // Ham metin YALNIZ sunucu loguna.
    console.error(`[${baglam}] Prisma hatası (kullanıcıya gösterilmedi):`, err)
    return PRISMA_MESAJI
  }
  return err instanceof Error && err.message ? err.message : varsayilan
}
