# Servis yönetimi modülü

Personel servis (shuttle) operasyonunun yönetimi: güzergâh/durak/araç/şoför
tanımları, personelin servise ve durağa atanması, kapasite takibi, operasyonel
listeler ve şikâyet yönetimi.

## Modülün çalışan kısmının bir bölümü hâlâ main'de değil

**Ölçülmüş gerçek, 2026-09-28.** Bu bölüm 2026-09-27'de "82 dosya 7 dalda"
diyordu; o ifade **artık yanlış**, iki dal main'e girdi.

**Main'de olan:** FAZ 1A CRUD (firma/yerleşke/güzergâh/durak/araç/şoför/sefer
dilimi + personel atama/durum), shared surfaces, revizyon ve şikâyet
şemaları, permission sözlüğü, **kapasite motoru + alternatif servis önerisi
+ transfer** (yeni), **dışa aktarım** (güzergâh listesi/detay Excel+PDF,
personel atama listesi Excel — yeni).
Sayılar: 64 `route.ts`, 11 `src/lib/servis-yonetimi/` dosyası, 2 ekran.

**Main'e YENİ giren iki dalın içeriği (ölçüm):** her iki dalın
üç-nokta diff'indeki dosyaların **tamamı** main'de birebir aynı
(`git rev-parse` hash karşılaştırması):

| Dal | Dosya | main'de birebir aynı |
|---|---:|---:|
| `servis-yonetimi-faz1b-alternatif-servis` | 16 | **16 / 16** |
| `servis-yonetimi-export` | 10 | **10 / 10** |

🔴 Dikkat: bu iki dalın **uçları main'in atası DEĞİL**
(`git merge-base --is-ancestor` → hayır). Melih içeriği yeniden yazarak
aldı (6 yeni commit: `3dfc3a60`, `7b02e751`, `45e28fe7`, `339e9684`,
`477250b9`, `ee67d6f0`). Yani "dal merge oldu" demek yanlış; doğrusu
**dalın içeriği main'e taşındı**.

İki dal 2026-09-28'de SİLİNDİ (Melih onayı): silmeden önce içerik ölçümü
güncel main'e karşı tekrarlandı — 16/16 ve 10/10 blob birebir aynı, yerel
ve origin uçları ayrı ayrı doğrulandı. Yerel ve origin'den kaldırıldı.

**Main'de OLMAYAN — 76 dosya, dal başına:**

| Dal | Yalnız orada olan | Ne kaybedilir |
|---|---:|---|
| `servis-sikayet-uygulama` | 28 | şikâyet modülünün tamamı: 2 ekran, 7 uç, 6 lib, PDF üretici |
| `servis-yonetimi-acil-durum-listesi` | 26 | acil durum listesi **+ operasyonel servis listesi** (ekran, uç, Excel, PDF, KVKK erişim izi) |
| `servis-yonetimi-veri-kalite-merkezi` | 11 | Veri Kalite Merkezi ekranı + 13 kontrol + Excel |
| `servis-yonetimi-bu-ay-ne-degisti` | 6 | değişiklik özeti ekranı |
| `servis-yonetimi-faz1b-harita` | 5 | durak haritası (leaflet) |

🔴 `acil-durum-listesi` satırı 10'dan 26'ya çıktı. Sebep dal büyümesi değil:
`operasyonel-liste` dalı silinince içeriği bu dalda kaldı, ayrıca önceki
sayım test dosyalarını dışarıda bırakmıştı. (12'si `.test` dosyası.)

**Ayrıca main'de olmayan, özellik dalı olmayanlar:**

| Dal | Yeni dosya | İçerik |
|---|---:|---|
| `dev/elif/servis-tanim-paketi` | 4 | tanım seed'i + güzergâh/durak verisi + İdari İşler eşleme tablosu + kanonik durak kodu |
| `feat/servis-goc-script` | 3 | göç script'i + sınıflandırma katmanı + testi |
| `feat/servis-yonetimi-faz1-a-tasarim` | 3 | FAZ 1A tasarım artefaktları (migration SQL, prisma modeli, constraint testi) |

🔴 Bu dallara **commit eklenmez**. Bir şey gerekiyorsa taze dal açılır ve
Melih'e söylenir.

## Veri modeli (main)

`servis_yerleske` → `servis_guzergah` (`yerleskeId` NOT NULL) →
`servis_guzergah_durak` → `servis_durak` (FK'sı yok, bağımsız).
`servis_sefer_dilimi`, `servis_arac`, `servis_sofor`,
`servis_guzergah_arac_varsayilan`, `servis_guzergah_sofor_varsayilan`,
`servis_personel_atama` (+ `..._dilim` junction), `servis_personel_durum`,
`servis_sorumlusu`, `servis_listesi_revizyonu` (+satırı), `servis_sikayet`.

Her yazma `servis_islem_gecmisi`'ne iz bırakır (`ServisIslemHedefTipi` 16
değer). İz **değer yazmaz**, yalnız alan adları.

## Roller ve yetki

`DATA_AND_SECURITY.md` → servis yetki matrisi. Özet: tanım işleri
`servis.tanim.manage`, operasyonel kayıt `servis.edit`, pasifleştirme/geri
alma **her zaman** generic `servis.passive`/`servis.restore`.

## Yerleşik desenler

- **Pasifleştirme, silme değildir.** Her tanım kaydında
  `[id]/pasiflestir` + `[id]/geri-al` ucu vardır; fiziksel silme yoktur.
- **Nokta-zaman sorgusu `aktif` bayrağına güvenmez** — tarih aralığı
  (`baslangicTarihi`/`bitisTarihi`) pozitif AND-of-OR ile sorgulanır,
  olumsuzlama kullanılmaz.
- **Tarihçe dialogu tek bileşendir** (`_components/ServisGecmisDialog.tsx`),
  13 model onu paylaşır.
- **Seri no üretimi** advisory lock ile:
  `pg_advisory_xact_lock(hashtext('<seri>'))` + `COALESCE(MAX(no),0)+1`
  **aynı** `$transaction` içinde.

## Göç (Excel'den aktarım)

`feat/servis-goc-script` dalında `docs/servis-yonetimi/goc-personnel-servis-atama.ts`.
Girdi **Excel değil, veritabanıdır**: `Personnel.serviceRoute/serviceStop`.
`--db=<ad>` zorunlu (yanlış DB kilidi), `--apply` olmadan hiçbir şey yazmaz.

🔴 Bilinen iki engel (ölçülmüş, `CURRENT_STATE.md`'de takip ediliyor):
1. Script tanım verisi **yaratmaz**, yalnız `kod` ile arar. Prod'da
   yerleşke/güzergâh/durak **0**. → Karşılığı yazıldı:
   `prisma/seed-servis-tanim.ts` (`dev/elif/servis-tanim-paketi`),
   bootstrap-only + idempotent, `--apply` olmadan yazmaz.
2. Durak kodu biçimi. Kanonik biçim `<güzergâh kodu>-<sıra, 2 hane>` olarak
   sabitlendi: `src/lib/servis-yonetimi/servis-durak-kodu.ts`.
   🔴 Aynı fonksiyonun bir kopyası göç dalındaki `goc-siniflandirma.ts`
   içinde duruyor; iki dal birleşince o kopya silinip buradan import
   edilmeli (birleştirme notu dosyanın kendisinde).
