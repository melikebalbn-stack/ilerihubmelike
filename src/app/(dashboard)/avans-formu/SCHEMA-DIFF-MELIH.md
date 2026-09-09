# Avans Formu — schema.prisma diff önerisi (Melih onayına)

Aşağıdaki iki model **yeni** — mevcut hiçbir modele dokunulmuyor.
`prisma/schema.prisma` dosyasının sonuna eklenmesi öneriliyor.

```prisma
model AvansTalebi {
  id             String   @id @default(cuid())
  sorumluId      String   // Personnel.id — formu gönderen birim sorumlusu
  bolum          String   // AvansTalebiHelpers.bulSorumluVeEkibi() ile aynı bölüm adı
  donemYil       Int
  donemAy        Int
  gonderimTarihi DateTime @default(now())
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  satirlar       AvansTalebiSatiri[]

  @@unique([sorumluId, bolum, donemYil, donemAy], map: "uq_avans_talebi_sorumlu_donem")
  @@index([donemYil, donemAy], map: "idx_avans_talebi_donem")
}

model AvansTalebiSatiri {
  id              String   @id @default(cuid())
  avansTalebiId   String
  avansTalebi     AvansTalebi @relation(fields: [avansTalebiId], references: [id], onDelete: Cascade)
  calisanId       String   // Personnel.id — bkz. not aşağıda
  avansIstiyorMu  Boolean

  @@unique([avansTalebiId, calisanId], map: "uq_avans_satiri_talep_calisan")
}
```

## Not: `calisanId` / `sorumluId` neden düz `String`, neden Prisma `@relation` (FK) değil

- Her ikisi de mantıken **Personnel.id**'ye karşılık geliyor (Personnel tablosundaki
  kaydın birincil anahtarı).
- Kasıtlı olarak Prisma ilişkisi (`@relation`) kurulmadı, çünkü bunun için
  `Personnel` modeline de bir ters-ilişki alanı (`avansTalebiSatirlari
  AvansTalebiSatiri[]` gibi) eklemek gerekirdi — bu ise "başkasının modeli"
  sınırını ihlal eder (CLAUDE.md: mevcut paylaşımlı modelleri değiştirme).
- Bu yüzden `calisanId` / `sorumluId` **düz string** olarak tutulup, uygulama
  katmanında (`avans-formu-helpers.ts` içindeki `bulSorumluVeEkibi*` fonksiyonları)
  `Personnel.id` ile eşleştiriliyor. Referans bütünlüğü DB seviyesinde FK ile değil,
  route içinde `izinliIdSeti` kontrolüyle (bkz. `avans-formu/route.ts` POST) sağlanıyor.
- Migration sırasında Melih isterse bunu gerçek FK'ya çevirebilir — o zaman
  `Personnel` modeline dokunması gerekeceğinden bu karar ona bırakıldı.

## Diğer notlar
- `AvansTalebi` başına bir sorumlu + dönem + bölüm kombinasyonu tekil
  (`@@unique([sorumluId, bolum, donemYil, donemAy])`) — aynı sorumlu aynı ay
  içinde formu ikinci kez gönderemez, üzerine yazmak isterse upsert gerekir.
- `AvansTalebiSatiri.avansIstiyorMu` her zaman dolu (form üzerinde switch
  default `false`) — "boş bırakıldı" durumu ayrıca tutulmuyor.
- `updatedAt` (`@updatedAt`) ve `@@index([donemYil, donemAy])` sonradan
  eklendi (2026-07-22). Sandbox dev DB'de migration
  `20260722185956_avans_talebi_updated_at_index` ile uygulandı — mevcut
  satırlarda `updatedAt`, `createdAt` değeriyle backfill edilip sonra
  `NOT NULL` yapıldı (bkz. migration SQL). Melih prod tarafında aynı
  backfill adımını izlemeli, düz `ADD COLUMN ... NOT NULL` prod'daki dolu
  tabloda migration'ı patlatır.
- Test amaçlı impersonasyon parametresi (`?testPersonnelId=`) kaldırıldı
  (2026-07-22) — finansal/denetim izi taşıyan bir formda bu riski sandbox'ta
  bile tutmamaya karar verildi. Artık GET/POST her zaman gerçek oturum
  sahibinin (`user.id`) kaydına göre çalışıyor; ayrı test hesapları
  (`test-user-sorumlu`, `test-user-bos-ekip` vb.) ile uçtan uca test ediliyor.
