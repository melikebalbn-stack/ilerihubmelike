# Ürün ve kapsam

**ILERIHub** — İleri Group kurumsal portalı. Tek Next.js uygulaması içinde
birbirinden büyük ölçüde bağımsız modüller barındırır.

## Kullanıcılar

Azure AD ile giriş yapan şirket çalışanları. Yetki **rol tabanlı**
(`role` → `role_permission` → `permission`), oturumda JWT içinde taşınır ve
5 dakikada bir DB'den tazelenir (`src/lib/auth.ts`).

Mavi yaka için ayrı bir terminal/kiosk yüzeyi var (`src/app/(terminal)`).

## Modül sınırları

`src/app/(dashboard)/` altındaki her dizin bir modüldür. Bugün 45'in üzerinde
modül var: akademi, arşiv, envanter, ipro (üretim izleme), iso27001, kalite,
maliyet analizi, pdks, personnel, qdms, raporlar, servis-yönetimi,
strategic-hr, zimmet ve diğerleri.

🔴 **Modüller birbirine karışmaz.** Bir modülde çalışırken:

- Başka modülün `src/app/(dashboard)/<modül>/`, `src/app/api/<modül>/`,
  `src/lib/<modül>/` dosyalarına dokunulmaz.
- `prisma/schema.prisma` içinde **yalnız kendi modelin** düzenlenir; başkasının
  modeline dokunmak için önce sorulur.
- `src/lib/` kökündeki paylaşımlı yardımcılar (auth, prisma, email,
  push-notifications, audit-log) **ortak alandır** — değiştirmeden önce sorulur.

## Bu context'in kapsamı

Aktif geliştirme alanı bugün **servis yönetimi**dir (`SERVICE_MODULE.md`).
Diğer modüller çalışır durumdadır ve bu paketin kapsamı dışındadır.
