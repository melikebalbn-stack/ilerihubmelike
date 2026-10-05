# Fatura Takip — Teknik Dokümantasyon

Sandbox: `sandbox/melike` · URL: `/sandbox/melike/faturalar` (prod'da henüz yok, bkz. "Durum")

## 1. Amaç

Şirkete gelen faturaları kaydedip Genel / Sistem Geliştirme (ve diğer gerçek bölümler)
ayrımıyla takip etmek; TL/USD faturaları fatura tarihindeki TCMB kuruyla otomatik €'ya
çevirmek; aylık ciro karşısında bölüm bazlı harcama oranını görmek; Excel ile toplu
içe/dışa aktarım yapmak; KPI dosyasına çekilebilecek sayısal bir özet üretmek.

## 2. Erişim

`_lib/access.ts`:

- `ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN']` → her zaman erişebilir.
- `isSistemGelistirme(department)` → departman adını normalize edip (Türkçe karakterleri
  ASCII'ye çevirir, küçük harfe indirir, boşlukları sadeleştirir) `'sistem gelistirme'` ile
  **prefix (tam önek)** eşleşmesine bakar — `includes`/substring KULLANILMIYOR, çünkü proje
  genelinde substring heuristiği başka bölümleri (ör. Mühendislik) yanlış yakalamıştı.
- `canAccessFaturaTakip(role, department)` = admin rolü **veya** Sistem Geliştirme bölümü.

Bu fonksiyon hem API erişim kontrolünde hem de `_lib/summary.ts`'de "bu fatura Sistem
Geliştirme'ye mi ait" sorusunu cevaplamak için **tek kaynak** olarak kullanılıyor.

## 3. Veri Modeli (Prisma)

### `Invoice`

| Alan | Tip | Açıklama |
|---|---|---|
| `id` | String (cuid) | PK |
| `invoiceDate` | Date | Fatura tarihi — TCMB kuru bu tarihe göre çekilir |
| `companyName` | String | Firma adı (autocomplete ile önceki firmalardan seçilebilir) |
| `invoiceNumber` | String (unique) | Fatura no |
| `amount` | Decimal(14,2) | Girilen tutar (fatura üzerindeki para biriminde) |
| `currency` | enum `InvoiceCurrency` (`TRY`\|`USD`\|`EUR`) | Girilen para birimi |
| `exchangeRate` | Decimal(10,4) | O tarih için kullanılan TCMB EUR kuru (TRY/USD ise ara adımda USD kuru da kullanılır ama saklanan bu, EUR'ya nihai çevirim oranı) |
| `amountTRY` | Decimal(14,2) | Hesaplanan TL karşılığı |
| `amountEUR` | Decimal(14,2) | Hesaplanan € karşılığı — tüm toplamlar/grafikler bu alan üzerinden |
| `departmentOrgUnitId` | String? | **İsim tarihsel** — artık gerçekte `Personnel.bolum` metninin kendisini tutuyor (id = ad). `null` = Genel. `allocations` doluysa yok sayılır. |
| `departmentName` | String? | Görünen bölüm adı (departmentOrgUnitId ile aynı) |
| `note` | String? | Serbest not |
| `createdById` | String | Oluşturan kullanıcı |
| `allocations` | `InvoiceDepartmentAllocation[]` | Çoklu bölüme % ile bölünmüşse buradaki satırlar geçerli |

### `InvoiceDepartmentAllocation`

Tek bir faturanın birden fazla bölüme yüzdeyle bölünmesi için.

| Alan | Tip | Açıklama |
|---|---|---|
| `invoiceId` | String (FK → Invoice, `onDelete: Cascade`) | |
| `departmentOrgUnitId` | String | Bölüm adı (= Personnel.bolum) |
| `departmentName` | String | Aynı değer, görünen ad |
| `percentage` | Decimal(5,2) | Bu bölüme ayrılan yüzde |
| `amountTRY` / `amountEUR` | Decimal(14,2) | Bu yüzdeye karşılık gelen tutar |

**Önemli kural:** yüzdeler toplamı 100'ü bulmak ZORUNDA DEĞİL. Kalan kısım örtük olarak
"Genel" sayılır — ayrı bir satır olarak saklanmaz, sadece hesaplama sırasında (`summary.ts`)
`toplam - allocations toplamı` farkı "Genel" payına eklenir. Validasyon: yüzde toplamı
≤ %100,5 olmalı (küçük yuvarlama payı), > 0 olmalı.

### `InvoiceMonthlyRevenue`

Aylık ciro (€) girişi — "Ciro İçindeki Payı" kıyaslamalarında kullanılır.

| Alan | Tip | Açıklama |
|---|---|---|
| `month` | Date (unique) | Ayın ilk günü (ör. `2026-02-01`), pratikte "YYYY-MM" anahtarı gibi kullanılıyor |
| `revenueEUR` | Decimal(16,2) | O ayın cirosu (€) |
| `updatedById` | String | Son güncelleyen kullanıcı |

### `TcmbRateCache`

TCMB'den çekilen kurların önbelleği (aynı tarih+para birimi için tekrar tekrar dış
servise gitmemek için).

| Alan | Tip | Açıklama |
|---|---|---|
| `date` | Date | Kur tarihi |
| `currency` | enum `InvoiceCurrency` | |
| `rate` | Decimal(10,4) | TCMB Döviz Alış kuru |
| unique | `[date, currency]` | |

## 4. İş Mantığı

### TCMB € dönüşümü (`_lib/tcmb.ts`)

`getRateForDate(dateStr, currency)`: TCMB'nin güncel (`today.xml`) ya da geçmiş
(`kurlar/YYYYMM/DDMMYYYY.xml`) kur dosyasını çeker. TCMB'nin yayın yapmadığı günlerde
(hafta sonu/resmî tatil) **en fazla 7 gün geriye** bakarak en yakın önceki iş gününün
kurunu kullanır. Sonuç `TcmbRateCache`'e yazılır, aynı tarih+para birimi için bir daha
dış servise gidilmez.

- `TRY` fatura → doğrudan TCMB EUR kuruna bölünür.
- `USD` fatura → önce USD→TRY kuruyla TL'ye, sonra TL→EUR kuruyla €'ya çevrilir.
- `EUR` fatura → kur = 1, tutar aynen kullanılır.

### Bölüm kaynağı (`departments/route.ts`)

Bölüm listesi **`Personnel.bolum`**'dan geliyor (aktif personel, distinct, boş olmayan
değerler) — ayrı bir "master" bölüm listesi YOK, personel sayfasındaki bölümlerle birebir
aynı kaynak. Şu an **28 farklı bölüm** var (Asansör Müdürlüğü, Bakımhane, Fabrika
Müdürlüğü, ... Yönetim).

⚠️ **Dikkat (daha önce bug'dı):** "Sistem Geliştirme" bölümünün gerçek veritabanı değeri
**title-case** `"Sistem Geliştirme Müdürlüğü"` — ALL-CAPS değil. Kodda bu string'in tam
eşleşmesine ihtiyaç duyan her yer (`page.tsx`'teki `SG_LABEL`, `summary.ts`'teki
karşılaştırma) ya bu değeri harfiyen kullanmalı ya da `isSistemGelistirme()` (normalize +
prefix) ile karşılaştırmalı.

### Çoklu bölüm & Genel örtük kalanı (`_lib/invoice.ts`)

`resolveDepartments(departmentOrgUnitId, allocations)`:
- Tek bölüm modunda: `departmentOrgUnitId` direkt kullanılır, `null` = Genel.
- Çoklu bölüm modunda: en az 1 `allocations` satırı olmalı, yüzde toplamı 0 ile 100,5
  arası olmalı. Yüzde toplamı 100'ü bulmuyorsa fark **örtük Genel** sayılır (ayrı satır
  olarak saklanmaz).

`computeAmounts(currency, amountNum, dateStr)`: TCMB kuru + TRY/EUR karşılıklarını hesaplar.

### Özet hesaplama (`_lib/summary.ts`)

`computeSummary(invoices)` her faturayı (çoklu bölümlüyse alloc'lara bölerek + örtük
Genel kalanını ekleyerek) "bölüm parçaları"na çevirir, sonra:
- Ay + bölüm bazında toplar (`months[].departments[]`),
- Bölüm bazında genel toplar (`departments[]`),
- `isSistemGelistirme()` ile Sistem Geliştirme / Genel ikili toplamını çıkarır
  (`totals.genel`, `totals.sistemGelistirme`, `totals.toplam`).

Hem `summary/route.ts` (ekrana) hem `export/route.ts?type=summary` (KPI Excel'e) burayı
kullanır — **tek kaynak**, iki yerde ayrı hesap yok.

### "Oran" tanımı

Sayfada tek bir oran tanımı var: **bir € tutarının, o kapsamdaki CİRO'ya bölünmesi.**
Hem üstteki "Sistem Geliştirme — Ciro İçindeki Payı" kartı hem "Bölüme göre dağılım"
tablosundaki "Ciro İçindeki Payı" sütunu aynı hesabı yapar (payda hep ciro, pay hep o
satırın/kartın € tutarı). Ciro girilmemişse (0) `—` gösterilir.

## 5. API Uçları

Hepsi `src/app/api/sandbox/melike/faturalar/` altında, hepsi `requireUser()` +
`canAccessFaturaTakip()` ile korunuyor.

| Method | Yol | İş |
|---|---|---|
| GET | `/` | Fatura listesi (`?department=`, `?search=` filtreleri) |
| POST | `/` | Yeni fatura oluştur |
| GET | `/[id]` *(yok, sadece aşağıdakiler)* | — |
| DELETE | `/[id]` | Fatura sil |
| PATCH | `/[id]` | Hızlı tek-bölüm değişikliği (allocations'ı temizler) |
| PUT | `/[id]` | Tam düzenleme (tek/çoklu bölüm, tutar, tarih, vb.) |
| GET | `/departments` | `Personnel.bolum` distinct listesi |
| GET | `/companies` | Firma adı autocomplete (`?q=`) |
| GET | `/summary` | `computeSummary()` sonucu (kartlar, grafik, tablo için) |
| GET | `/revenue` | Tüm aylık ciro kayıtları |
| PUT | `/revenue` | Bir ayın cirosunu gir/güncelle (`{month: "YYYY-MM", revenueEUR}`) |
| GET | `/tcmb-rate` | Tek bir tarih+para birimi için kur (form önizlemesi için) |
| GET | `/export?template=1` | Boş Excel şablonu (çoklu bölüm örneği dahil) |
| GET | `/export?type=summary` | KPI Özet — sayısal, yuvarlanmamış Excel |
| GET | `/export` | Ham fatura listesi Excel |
| POST | `/import` | Excel'den toplu fatura yükleme (en fazla 500 satır) |

## 6. Excel İçe/Dışa Aktarım (`_lib/excel.ts`)

Dışa aktarılan "Bölüm" hücre formatı, içe aktarmanın kabul ettiği format ile **birebir
aynı** (round-trip):

- Tek bölüm: `"KALİTE MÜDÜRLÜĞÜ"`
- Çoklu bölüm: `"KALİTE MÜDÜRLÜĞÜ %60, SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ %40"`
- Kalan örtük Genel isteğe bağlı yazılabilir: `"...%70, Genel %30"` — import bunu
  tanır ama **göz ardı eder** (zaten örtük hesaplanıyor).

İçe aktarma `matchDepartment()` ile **bulanık (fuzzy)** eşleştirme yapar — Excel'e yazılan
metin gerçek `Personnel.bolum` listesiyle birebir aynı harf/boşluk olmak zorunda değil.

## 7. Sayfa Yapısı (`page.tsx`)

Yukarıdan aşağı:

1. Başlık + "Excel İçe/Dışa Aktar" ve "Yeni Fatura Ekle" butonları.
2. Tek satır TCMB notu.
3. **Kapsam seçimi**: Aylık / Tüm Zamanlar (Kümülatif) toggle + (Aylık modda) ay seçici.
   Kartları, grafiği ve "Bölüme göre dağılım" tablosunu birlikte sürer.
4. 2 özet kart: **Toplam (€)**, **Sistem Geliştirme — Ciro İçindeki Payı**.
5. Tek kart: **"Bölüme göre dağılım"**
   - Grafik: Tüm Zamanlar modunda ay bazlı **stacked bar** (Genel/açık gri, Sistem
     Geliştirme/lacivert, Diğer bölümler/koyu gri — her segmentin ucunda tam € etiketi).
     Aylık modda seçili ayın **yatay çubuk** grafiği (bölüm adları uzun olduğu için; her
     çubuğun ucunda tam € etiketi).
   - Altında aynı kapsamın tam tablo kırılımı (Bölüm, Toplam ₺, Toplam €, Ciro İçindeki
     Payı) + "KPI Özet İndir" linki.
6. **Ciro karşılaştırması** kartı: Aylık modda seçili ayın cirosunu € olarak girme kutusu;
   Tüm Zamanlar modunda girilen tüm ayların toplamı (salt okunur).
7. Fatura listesi üstü: Bölüm filtresi, Ay filtresi, arama kutusu.
8. Fatura listesi tablosu: Tarih/Firma/Fatura No/€ Karşılığı/Bölüm sütunları sıralanabilir
   (tıkla), tarihler GG.AA.YYYY. Her satırda Düzenle (tam form) ve Sil.

Form dialogu (`_components/InvoiceFormDialog.tsx`): tek/çoklu bölüm modu, çoklu modda
28 bölüm için arama kutusu + kaydırılabilir liste (hepsi her zaman açık değil).

## 8. Renk Kuralı

Rastgele/rainbow kategorik palet **yok** — ilerihub'ın tüm sayfalarda kullandığı tek
marka rengi (lacivert `#1B4F72`) esas alınıyor:

- **Sistem Geliştirme** → lacivert (bu ekranın asıl ilgi noktası)
- **Genel** (atanmamış) → açık gri `#CBD5E1`
- **Diğer gerçek bölümler** → koyu gri `#94A3B8`

Renk burada kimlik değil vurgu taşıyor; hangi bölüm olduğu zaten çubuğun/satırın
etiketinde yazıyor.

## 9. Dosya Haritası

```
src/app/api/sandbox/melike/faturalar/
  route.ts                 GET liste / POST oluştur
  [id]/route.ts             DELETE / PATCH / PUT
  departments/route.ts      Personnel.bolum listesi
  companies/route.ts        firma autocomplete
  summary/route.ts          computeSummary() sonucu
  revenue/route.ts          aylık ciro GET/PUT
  tcmb-rate/route.ts        tek kur sorgusu
  export/route.ts           şablon / KPI özet / ham liste Excel
  import/route.ts           Excel toplu yükleme
  _lib/access.ts            erişim + isSistemGelistirme()
  _lib/tcmb.ts               TCMB kur çekme + cache
  _lib/excel.ts              excel parse/format yardımcıları
  _lib/invoice.ts            resolveDepartments, computeAmounts
  _lib/summary.ts            computeSummary (tek kaynak)

src/app/(dashboard)/sandbox/melike/faturalar/
  page.tsx                          ana sayfa
  _components/InvoiceFormDialog.tsx fatura ekle/düzenle formu
  _components/ImportDialog.tsx      excel içe/dışa aktar dialogu
  _components/CompanyAutocomplete.tsx firma adı autocomplete
```

## 10. Durum

- Branch: `sandbox/melike`, remote: `kisisel` (melikebalbn-stack/ilerihubmelike).
  `hub`/`origin`'de bu branch hiç olmadı.
- Prod'da (`hub.ilerigroup.com/sistem-gelistirme/faturalar`) şu an sadece **ilk sürüm**
  (Genel/SG ayrımı, Excel içe/dışa aktarım) entegre. Bu dokümandaki her şey — çoklu bölüm
  bölme, gerçek bölüm kaynağı, aylık ciro, tam düzenleme, KPI export, tüm UX/grafik/renk
  düzeltmeleri, "Sistem Geliştirme Oranı" bug fix'i — henüz **sadece bu sandbox'ta**.
- `sandbox/melike` branch'inin yerel `prisma/migrations/` geçmişi, bu işten bağımsız,
  önceden var olan bir nedenle gerçek dev DB geçmişinden geride — yeni migration'lar
  `prisma migrate diff` ile ek (additive) olarak üretilip elle uygulandı, `prisma migrate
  dev`/`db push` hiç kullanılmadı. Bu, Melih Bey bu branch'i canlıya alırken bilmesi
  gereken ayrı bir konu.
