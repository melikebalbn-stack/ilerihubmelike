# Mimari

## Stack

Next.js 15 (App Router) · TypeScript · Prisma v7 · PostgreSQL · NextAuth v4
(Azure AD) · shadcn/ui + Tailwind · vitest · Playwright · pm2.

Ölçek (2026-09-27): 2332 ts/tsx dosya (generated hariç), 444 prisma modeli,
308 enum, 232 migration, 151 test dosyası, 108 permission anahtarı.

## Katmanlar

```
src/app/(dashboard)/<modül>/page.tsx   ekran (client component)
src/app/api/<modül>/**/route.ts        HTTP kabuğu: yetki + parametre + durum kodu
src/lib/<modül>/*.ts                   iş mantığı (saf ya da prisma'lı)
prisma/schema.prisma                   tek şema dosyası
```

🔴 **API ucu iş mantığı taşımaz.** Uç yalnız: yetki kontrolü → parametre
ayrıştırma → lib fonksiyonu → durum kodu. Filtreleme, hesaplama, doğrulama
`src/lib/` altındadır ve oradan test edilir.

## Zorunlu desenler

- **Prisma:** `import { prisma } from '@/lib/prisma'`. `@prisma/client`'tan
  doğrudan import **edilmez**; üretilen client `@/generated/prisma`'dadır.
- **Auth:** `requireUser` / `requirePermission` / `requireAllPermissions`
  (`@/lib/auth/require-permission`). `session.user.id` = `User.id`.
  🔴 `requirePermission`'a dizi vermek **OR**'dur. İki yetkinin **birlikte**
  istendiği yerde `requireAllPermissions` kullanılır.
- **Bildirim:** `src/lib/ticket-notifications.ts` deseni — e-posta
  (`@/lib/email`), push (`@/lib/push-notifications`), in-app
  (`prisma.notification.create`), `Promise.allSettled` + fire-and-forget.
  `createNotificationWithPush` **kullanılmaz** (bug'lı).
- **Çok adımlı form:** `SurveyRenderer` desenini taklit et — multi-step,
  lacivert `#1B4F72`, ikon kartları, shadcn. Elle özel UI yazılmaz.
- **Enum kapsayıcılığı:** etiket/geçiş sözlükleri `Record<Enum, T>` olarak
  anote edilir; enum'a değer eklenince derleme kırılsın diye.
- **İstemciye giden prisma tipi:** yalnız `import type`.

## Bilinen tuzaklar

- `src/components/ui/button.tsx` `asChild` prop'unu **tipte tanır ama
  uygulamaz** (Radix Slot yok). Bağlantı butonu için `buttonVariants()` ile
  düz `<a>` kullan.
- `prisma/seed-*.ts` dosyaları **modül seviyesinde `main()` çağırır** —
  bir testten import etmek seed'i çalıştırır. Sabitleri okumak gerekiyorsa
  kaynak metin okunur (`src/lib/auth/servis-permission-sabitleri.test.ts`).
- `tsconfig.json` `prisma/seed-*.ts`'i **exclude** eder; genel `tsc` onları
  görmez. Seed değiştiren iş, o dosyayı ayrıca typecheck etmelidir.
- `prisma format` paylaşımlı şemada dokunulmamış satırları yeniden biçimler —
  **çalıştırılmaz**.

## Test

`vitest.config.ts` iki proje tanımlar: **unit** (`src/**/*.test.*`, paralel)
ve **integration** (DB isteyen testler, seri). Ayrıntı: `CLAUDE.md` → test
politikası.
