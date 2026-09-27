# Servis yönetimi modülü

Personel servis (shuttle) operasyonunun yönetimi: güzergâh/durak/araç/şoför
tanımları, personelin servise ve durağa atanması, kapasite takibi, operasyonel
listeler ve şikâyet yönetimi.

## 🔴 Modülün çalışan kısmı main'de DEĞİL

Bu, modülde çalışmaya başlamadan önce bilinmesi gereken **ölçülmüş** gerçek.
Main'de yalnız temel var; işleyen yüzeylerin çoğu **tek tek dallarda** duruyor
ve her dosya **yalnız bir dalda** yaşıyor (başka kopyası yok).

**Main'de olan:** FAZ 1A CRUD (firma/yerleşke/güzergâh/durak/araç/şoför/sefer
dilimi + personel atama/durum), shared surfaces, revizyon ve şikâyet şemaları,
permission sözlüğü. 58 API ucu.

**Main'de OLMAYAN — 82 dosya, dal başına:**

| Dal | Yalnız orada olan | Ne kaybedilir |
|---|---:|---|
| `servis-yonetimi-faz1b-alternatif-servis` | 12 | **kapasite motoru** (doluluk oranı, boş koltuk, kapasite aşımı uyarısı) + alternatif servis önerisi + transfer — 🔴 **İLK MERGE bu dal** |
| `servis-sikayet-uygulama` | 28 | şikâyet modülünün tamamı: 2 ekran, 7 uç, 6 lib, PDF üretici |
| `servis-yonetimi-export` | 10 | güzergâh detay/liste + personel atama Excel'i, güzergâh detay PDF'i |
| `servis-yonetimi-veri-kalite-merkezi` | 11 | Veri Kalite Merkezi ekranı + 13 kontrol + Excel |
| `servis-yonetimi-acil-durum-listesi` | 10 | acil durum listesi ekranı + PDF + KVKK erişim izi |
| `servis-yonetimi-bu-ay-ne-degisti` | 6 | değişiklik özeti ekranı |
| `servis-yonetimi-faz1b-harita` | 5 | durak haritası (leaflet) |

🔴 Bu dallara **commit eklenmez**; özellikle `faz1b-alternatif-servis` ilk
merge adayıdır. Bir şey gerekiyorsa taze dal açılır ve Melih'e söylenir.

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
   yerleşke/güzergâh/durak **0**.
2. `durakKoduOner()` `RRR-DDDDDDDD` biçiminde kod üretir; dev'deki 106 durak
   `ROTA_KODU-NN` biçimindedir — **106/106 uyuşmuyor**. `--apply` bu hâliyle
   her durağı bulamaz.
