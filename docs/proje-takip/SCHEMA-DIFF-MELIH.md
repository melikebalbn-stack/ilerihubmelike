# Proje Takip — schema.prisma diff önerisi (Melih onayına)

Aşağıdaki iki model **yeni** — mevcut hiçbir modele dokunulmuyor.
`prisma/schema.prisma` dosyasının sonuna eklenmesi öneriliyor.
Sandbox dev DB'ye de henüz uygulanmadı — bu sadece kod tarafındaki
draft'ın (bu klasördeki dosyalar) hangi modele karşılık geldiğini
göstermek için hazırlandı; migration Melih'in onayından sonra atılacak.

```prisma
model ProjeTakip {
  id            String    @id @default(cuid())
  projeNo       String    @unique // otomatik üretim: PRJ-2026-00001 (advisory-lock pattern, OR-2026 gibi)
  siraNo        Int?      // Syteline "Sıra No" - legacy import için opsiyonel

  // ── SATIŞ TARAFI: proje açılışında dolduruluyor ──
  musteriFirma       String
  musteriYetkilisi   String?
  musteriKod         String?
  ileriKod           String?     // mühendislik atayana kadar boş kalabilir
  ileriTanim         String
  grupKod            String?
  kategori           String?     // Proje / Müşteri / İleri / Offtheshelf ...
  kalipFikstur       String?     // KALIP YOK / MÜSTERİ / İLERİ
  kalipKodu          String?
  yillikAdet         Float?
  minimumSipMiktari  Float?
  numuneAdedi        String?     // veride "TBD" gibi metin de geliyor, String tutuluyor
  prototipFiyati     Decimal?    @db.Decimal(14, 2)
  prototipParaBirimi String?     // EUR/USD/TRY
  nre                Decimal?    @db.Decimal(14, 2)
  nreParaBirimi      String?
  projeKalipFikstur  String?     @db.Text
  projeBilgisi       String?     @db.Text
  rfpNo              String?
  rfpTarih           DateTime?
  rfpAcilisHafta     Int?        // rfpTarih'ten otomatik hesaplanır (bkz. tarih-hesapla.ts); yalnız legacy import'ta tarih yoksa elle doldurulur
  yil                Int?

  // ── MÜHENDİSLİK TARAFI: bildirim sonrası dolduruluyor ──
  revizeTerminTrh       DateTime?
  terminProjeTrh        DateTime?
  poNumarasi            String?
  projeDurumTipi        String?   // NUMUNE / PROTOTYPE / SERI / PPAP / TASARIM / REVIZYON / YENIDEN_PPAP
  sevkiyatTrh           DateTime?
  sevkiyatYil           Int?      // sevkiyatTrh'ten otomatik hesaplanır; yalnız legacy import'ta tarih yoksa elle doldurulur
  sevkiyatHafta         Int?      // sevkiyatTrh'ten otomatik hesaplanır; yalnız legacy import'ta tarih yoksa elle doldurulur
  onayTrh               DateTime?
  onayYil               Int?      // onayTrh'ten otomatik hesaplanır; yalnız legacy import'ta tarih yoksa elle doldurulur
  onayHafta             Int?      // onayTrh'ten otomatik hesaplanır; yalnız legacy import'ta tarih yoksa elle doldurulur
  aciklama              String?   @db.Text
  lokasyon              String?
  birimFiyat            Decimal?  @db.Decimal(14, 2)
  birimFiyatParaBirimi  String?
  hedefYillik           Decimal?  @db.Decimal(14, 2)
  kalipTutar            Decimal?  @db.Decimal(14, 2)
  kickOffStatu          String?
  poKalip               String?
  kickoffCW             Int?
  kickoffYil            Int?
  istemeTrhCW           Int?
  istemeTrhYil          Int?
  sevkTrhCW             Int?
  sevkYil               Int?
  poTrhCW               Int?
  poYil                 Int?
  poOngCW               Int?
  poOngYil              Int?

  // ── Syteline legacy / açıklaması netleşmemiş alanlar (veri kaybı olmasın diye tutuluyor) ──
  legacyComboBox10  String?
  legacyComboBox23  String?
  legacyDateCombo5  DateTime?
  legacyKullaniciStatic String?  // C(KullaniciStatic) - kaydı giren/güncelleyen kişi (metin)

  // ── İş akışı / durum ──
  durum                            String   @default("YENI_DEVAM_EDEN")
  // YENI_DEVAM_EDEN / TASARIM_YENI_DEVAM_EDEN / ONAY_BEKLEYEN_GONDERILEN / REVIZYON / ONAY_ALAN / IPTAL
  // (bkz. api/_lib/sabitler.ts DURUM_DEGERLERI — tek kaynak)
  muhendislikDoldurmaDurumu        String   @default("BEKLIYOR") // BEKLIYOR / TAMAMLANDI
  muhendislikBildirimGonderildiMi  Boolean  @default(false)
  muhendislikBildirimTarihi        DateTime?

  // ── Sorumlular (plain String, @relation yok - Personnel modeline dokunmuyoruz) ──
  olusturanId           String   // Satış temsilcisi - session.user.id
  muhendislikSorumluId  String?  // atanan mühendis - session.user.id

  loglar    ProjeTakipLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("proje_takip")
  @@index([durum])
  @@index([muhendislikSorumluId])
  @@index([musteriFirma])
}

model ProjeTakipLog {
  id           String     @id @default(cuid())
  projeTakipId String
  projeTakip   ProjeTakip @relation(fields: [projeTakipId], references: [id])
  islemTipi    String     // OLUSTURULDU / MUHENDISLIK_DOLDURDU / DURUM_DEGISTI / BILDIRIM_GONDERILDI / BILDIRIM_BEKLIYOR
  // (bkz. api/_lib/sabitler.ts LOG_ISLEM_TIPLERI — tek kaynak)
  yapanId      String
  detay        String?    @db.Text
  createdAt    DateTime   @default(now())

  @@index([projeTakipId])
  @@map("proje_takip_log")
}
```

## Not: `olusturanId` / `muhendislikSorumluId` / `yapanId` neden düz `String`, neden `@relation` (FK) değil

- [[AvansTalebi]] ile aynı gerekçe: bunlar mantıken **User.id** (session sahibinin
  kaydı) karşılığı ama Prisma ilişkisi kurulmadı, çünkü bu `User` modeline ters-ilişki
  alanı eklemeyi gerektirir — "başkasının modeli" sınırını ihlal eder
  (CLAUDE.md: mevcut paylaşımlı modelleri değiştirme).
- Referans bütünlüğü DB seviyesinde FK ile değil, route içinde `requireUser()`
  ile (oturum var mı kontrolü) sağlanıyor (bkz. `api/create/route.ts`).

## Durum: bu draft henüz sandbox dev DB'ye migrate edilmedi

Nurgül'ün tercihiyle bu paket, [[project_ilerihub_sandbox_nurgul]] altındaki
"kim migrate dev çalıştırır" kararı netleşene kadar **schema.prisma'ya
dokunulmadan** bırakıldı. Yani bu klasördeki kod (`_lib/schema.ts`,
`_lib/proje-no.ts`, `create/route.ts`, `YeniProjeForm.tsx`) şu anda
**type-check/çalışma zamanında hata verir** — `prisma.projeTakip` /
`prisma.projeTakipLog` Prisma Client'ta yok, çünkü model schema.prisma'da yok.

Bu modeller onaylanıp migration atıldıktan sonra kod olduğu gibi çalışır;
sadece `prisma generate` sonrası tipler oluşacak.

## Diğer notlar

- `projeNo` üretimi `AvansTalebi`/OR-2026 pattern'ının aynısı: sabit bir
  advisory-lock anahtarı (`987654321`) altında transaction içinde sayım yapıp
  `PRJ-<yıl>-00001` formatında üretiyor (`_lib/proje-no.ts`).
- Legacy Syteline alanları (`legacyComboBox10`, `legacyComboBox23`,
  `legacyDateCombo5`, `legacyKullaniciStatic`) anlamı netleşmediği için veri
  kaybı olmasın diye ham tutuluyor; import script'i yazılırken netleştirilecek.
- Mühendislik tarafı doldurma ekranı eklendi (`muhendislik/page.tsx`,
  `muhendislik/[projeNo]/page.tsx`, `_components/MuhendislikDoldurForm.tsx`,
  `api/.../[id]/muhendislik/route.ts`).
- Mühendisliğe bildirim (`_lib/bildirim.ts`) alıcı mantığı kararlaştırıldı
  ve uygulandı (2026-09-21): `YeniProjeForm`'a "Sorumlu Mühendis" alanı
  eklendi (opsiyonel). Satış birini seçerse `muhendislikSorumluId` o
  kişinin `User.id`'siyle set edilir ve bildirim/e-posta SADECE ona gider;
  boş bırakılırsa `muhendislikSorumluId` null kalır ve bildirim/e-posta
  `Mühendislik Müdürlüğü` departmanındaki (aktif + User hesabı olan)
  herkese gider (`_lib/muhendislik-ekibi.ts`). `Mühendislik Müdürlüğü`
  değeri tahmin değil — sandbox dev DB'de canlı `SELECT bolum, COUNT(*)
  FROM "Personnel" GROUP BY bolum` ile doğrulandı. Mühendislik Müdürlüğü
  departmanında 49 kayıt var (aktif+pasif), bunlardan 7'si aktif ve
  hepsinin User hesabı var — `getMuhendislikEkibi()` bu 7 kişiyi
  döndürüyor: Can Bayram Gülcan, Ertaç Çolak, Hatice Aslan, Mehmet Özmen,
  Mehmet Şahin, Rahmi Orkun Kırçuvaloğlu, Şevval Ertaç. 2 kanal: email (`sendEmail`) + in-app
  (`prisma.notification.create`), push yok. Alıcı bulunamazsa (ör. atanan
  kişi silinmiş) `ProjeTakipLog`'a `BILDIRIM_BEKLIYOR` düşer, bulunursa
  `BILDIRIM_GONDERILDI`.
- **Yetki modeli sadeleştirildi (2026-09-21):** Proje Takip'in tüm
  ekranlarında (Yeni Proje, Mühendislik Doldur, Rapor) `canAccessSandbox`/
  rol kontrolü kaldırıldı — sadece `requireUser()` (oturum var mı) yeterli,
  giriş yapmış herkese açık. Bu, kalıcı rotaya taşınırken de aynı kalacak
  şekilde kararlaştırıldı; avans-formu/zimmet-formu'nun kendi (birbirinden
  farklı) yetki modelleri buraya taşınmadı.
- Rapor ekranı eklendi (`rapor/page.tsx`) — toplam/bekleyen/tamamlanan/bu ay
  açılan sayaçları, durum/proje-durum-tipi/grup-kod dağılımları, son 8 proje.
  Sadece okuma (`groupBy`/`count`/`findMany`), model üzerinde değişiklik yok.
- Kod tarafı 5 fazın hepsiyle tamam: geriye Melih'in migration'ı uygulaması
  ve mühendislik bildirim alıcısının (`_lib/bildirim.ts`) kararlaştırılması
  kalıyor.

## Melih'in şema incelemesi — 6 madde (2026-09-22)

1. **Fiyat görünürlüğü** — `canSeeProjeFiyat()` helper'ı (`src/lib/proje-takip/can-see-fiyat.ts`)
   yazıldı (2026-09-22). Melih Bey'in belirttiği "Yönetim" bölüm değeri sandbox dev
   DB'de `Personnel.bolum`'da birebir yoktu (35 farklı bölüm sorgulandı).

   **canSeeProjeFiyat, Melih Bey'in orijinal departman-bazlı tasarımından saptı:
   "Yönetim" departman olarak DB'de karşılığı olmadığı için, Nurgül ile birlikte
   GENEL MÜDÜRLÜK departmanı + unvanında "müdür" geçen herkes (normalizeTr ile
   substring, 32 kişi) olarak yeniden tanımlandı. Bu madde 4'teki "anahtar kelime
   kullanma" kısıtına kısmen aykırı — unvan alanı için, departman için değil.
   Melih Bey'in ayrı onayı gerekiyor.**

   Nihai kural: `role` SUPER_ADMIN/ADMIN → true; `Personnel.bolum` (normalizeTr,
   tam eşleşme) `Mühendislik Müdürlüğü` / `Satış & Pazarlama Müdürlüğü` (SADECE bu
   yazım, büyük harfli `SATIŞ PAZARLAMA MÜDÜRLÜĞÜ` varyantı DAHİL DEĞİL) /
   `GENEL MÜDÜRLÜK` → true; `Personnel.gorev` (normalizeTr) "müdür" substring
   içeriyorsa → true.

   **Henüz uygulanmadı:** fiyat alanlarını response'tan çıkaran GET route'u
   (`api/proje-takip/[id]/route.ts` gibi) ve `canSeeProjeFiyat`'ın gerçek
   çağrı noktaları — bu ayrı bir adımda eklenecek. `requireUser()` varsayılan
   olarak `Personnel`'i include etmiyor, çağıran taraf ayrıca sağlamalı.
2. **Decimal**: `prototipFiyati`, `nre`, `birimFiyat`, `hedefYillik`, `kalipTutar` artık
   `Decimal? @db.Decimal(14,2)` (önceden `Float?`). Zod tarafında değişiklik YOK —
   `z.coerce.number()` aynen kaldı: kodda mevcut tek emsal (`cost-analysis/route.ts`,
   `finishedWeight`/Decimal alanları) zod kullanmadan düz `parseFloat` ile dolduruyor;
   Avans-formu'nda hiç parasal/Decimal alan yok (Melih'in varsaydığının aksine) — bu
   yüzden "Avans'taki pattern" kopyalanamadı, mevcut en yakın emsal esas alındı.
3. **Log ilişkisi**: `ProjeTakipLog.projeTakipId` artık `@relation`, `ProjeTakip.loglar
   ProjeTakipLog[]` eklendi, `@@index([projeTakipId])` eklendi.
4. **Index**: `ProjeTakip`'e `@@index([durum])`, `@@index([muhendislikSorumluId])`,
   `@@index([musteriFirma])` eklendi.
5. **Türetilmiş alanlar**: `src/lib/proje-takip/tarih-hesapla.ts` eklendi
   (`date-fns`'in `getISOWeek`/`getISOWeekYear`'ı — `src/lib/vardiya-hafta.ts`'teki
   gibi, elle hafta hesaplama yok). `rfpAcilisHafta` artık `rfpTarih`'ten,
   `sevkiyatYil/sevkiyatHafta` `sevkiyatTrh`'ten, `onayYil/onayHafta` `onayTrh`'ten
   hesaplanıyor (`create/route.ts`, `[id]/muhendislik/route.ts`). Bu 5 alan zod
   şemalarından çıkarıldı, formlardan da ilgili manuel input'lar kaldırıldı.
6. **Sabit değer listeleri**: `api/_lib/sabitler.ts` eklendi (`DURUM_DEGERLERI`,
   `PROJE_DURUM_TIPI_DEGERLERI`, `MUHENDISLIK_DOLDURMA_DEGERLERI`,
   `LOG_ISLEM_TIPLERI`). `muhendislik-schema.ts`'teki `projeDurumTipi` artık
   `z.enum(PROJE_DURUM_TIPI_DEGERLERI)` (yeni değer: `REVIZYON`). Diğer üç liste
   şu an hiçbir zod şemasında input olarak kullanılmıyor (`durum`,
   `muhendislikDoldurmaDurumu`, log `islemTipi` hep sunucu tarafında sabit
   literal olarak set ediliyor, kullanıcıdan gelmiyor) — yine de tek kaynak
   olarak tanımlandılar, ileride bir input noktası açılırsa buradan `z.enum(...)`
   ile bağlanacak.

**Bu paket main ile senkron migration'la dev DB'ye uygulandı** (24 Eylül,
`PENDING_proje_takip`) — `prisma.projeTakip`/`prisma.projeTakipLog` artık gerçek.

**Fiyat görünürlüğü kısıtlaması Nurgül'ün kararıyla kaldırıldı (24 Eylül)** —
fiyat alanları artık herkese açık. `canSeeProjeFiyat` helper'ı (`src/lib/proje-takip/can-see-fiyat.ts`)
kodda duruyor ama hiçbir route'ta çağrılmıyor.
