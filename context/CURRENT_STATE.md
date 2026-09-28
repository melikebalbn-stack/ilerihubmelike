# Şu an — 2026-09-28

**Yalnız bugünü tutar.** Geçmiş fazların günlükleri buraya taşınmaz; onlar
Claude proje dokümanlarındadır.

## Nerede duruyoruz

Servis yönetimi **FAZ 1A + kapasite motoru + dışa aktarım main'de**.
Kalan yüzeyler **5 dalda bekliyor** (dağılım: `SERVICE_MODULE.md`).
Şikâyet modülü (FAZ 5) kod olarak bitti, merge sırasında.

Son tamamlananlar: `faz1b-alternatif-servis` ve `servis-yonetimi-export`
içerikleri main'e taşındı (6 commit, `3dfc3a60`…`ee67d6f0`); tanım paketi
yazıldı (`dev/elif/servis-tanim-paketi`) — seed + 9 güzergâh/133 durak +
İdari İşler eşleme tablosu.

## Açık gate'ler — canlıya geçiş öncesi

1. ✅ **KAPANDI — kapasite motoru main'de.** `faz1b-alternatif-servis`in
   16 dosyasının 16'sı main'de birebir aynı (ölçüldü). Aynı turda
   `servis-yonetimi-export`in 10 dosyası da girdi. İki dal, içerik ölçümü
   güncel main'e karşı tekrarlandıktan sonra SİLİNDİ (Melih onayı).

2. **Prod dry-run + Elif'in Excel listesiyle karşılaştırma.** Dry-run
   bugün koşulabilir: servis tabloları boş olsa da dry-run onlara
   **dokunmuyor** (`if (!APPLY) return`). Beklenen sonuç tablosu önceden
   yazıldı; çıktı onunla karşılaştırılacak. **Melih'te.**

3. **Tanım verisi prod'da 0 — seed yazıldı, koşulmadı.**
   `prisma/seed-servis-tanim.ts` (`dev/elif/servis-tanim-paketi`):
   bootstrap-only, idempotent, `--db` kapısı, `--apply` olmadan yazmaz.
   🔴 Yerleşke ve firma **parametre** — placeholder gömülmedi, gerçek adlar
   İdari İşler'den gelmeden script durur. Seed'i **Melih koşar.**

4. **Durak kodu şeması** — kanonik biçim `<güzergâh kodu>-<sıra, 2 hane>`
   olarak sabitlendi (`src/lib/servis-yonetimi/servis-durak-kodu.ts`).
   Kalan iş: göç dalındaki kopya fonksiyon, iki dal birleşince silinip
   buradan import edilecek.

5. **Prod rol açılışı** — servis anahtarları prod'da yalnız `super-admin`'de.
   Tetikleyici: "servis çekirdeği prod'a çıkıp göç doğrulandıktan sonra".

6. **TOSB güzergâhı** tanım paketinde **tanımlı** (`kod: 'TOSB'`), ama
   **duraksız** — durak listesi İdari İşler'den gelmedi. Göç sözlüğünün
   beklediği `'TOSB SERVİS' → 'TOSB'` eşlemesi artık karşılık buluyor.

7. 🔴 **YENİ — durak eşlemesinde 14 satır açık.** İdari İşler tablosunun
   51 satırı net, **14 satırı (18 kişi) hedefsiz** (`ESLEME_ACIK`).
   Varsayılan üretilmedi; bu metinler göçte eşleşmeyen olarak kalacak.

8. 🔴 **YENİ — 16 olası yinelenen durak çifti, Elif'in kararında.**
   133 durak adı ikişerli karşılaştırıldı (Levenshtein + sıra bağımsız
   kelime kümesi + kısaltma). Beşi neredeyse kesin aynı yer
   (`Sarı Cami`/`SARI CAMİİ`, `İçmeler Köp.`/`İÇMELER KÖPRÜSÜ`,
   `Tel Boyu Şifa`/`ŞİFA TEL BOYU`, `Unteks`/`UNTEX`,
   `23 Nisan Cd. Hakmar`/`23 NİSAN CAD. HAKMAR`).
   **Hiçbiri birleştirilmedi.**

9. 🔴 **YENİ — 27 yeni durağın sırası gerçek değil.** Güzergâhtaki fiziksel
   sıraları bilinmediği için her güzergâhın mevcut max'ından devam
   ettirildi. Atama ve kapasite sıradan bağımsız olduğu için FAZ 1+2
   çekirdeği etkilenmiyor; yalnız ekrandaki görünüm sırası yanlış.

## Test durumu

Tam takım **144 dosya / 1578 test, 0 başarısız** — 2026-09-28, güncel main
tabanında, taze Prisma client ile ölçüldü.

Kırmızı test **yok**. Bu belgede daha önce bunun tersini söyleyen bir ifade
vardı; kaldırıldı.

### 🔴 Ders 111 — worktree'ler kendi Prisma client'ını üretir

Worktree'lerde `src/generated` paylaşılan dizine symlink'lenmişti ve o
client bayattı (2026-06-20). Bayat client, şemanın yeni kısmına dokunan
testleri düşürüyordu. Kritik olan: **aynı bozulmayı hem dalda hem base'de
üretiyor**, dolayısıyla "iki tarafta da düşüyor, demek ki mevcut sorun"
biçimindeki her çıkarım dayanaksız.

Kural:
- Her worktree `npx prisma generate` ile **kendi** client'ını üretir.
- Paylaşılacaksa yalnız `node_modules`.
- Paylaşılan dizine `prisma generate` **koşulmaz** — dev sunucusu o
  client'ı yüklü tutar. Zorunluysa önce `pm2 stop`.
- Başarısız bir testi "zaten böyleydi" diye geçmeden önce taze client'la
  yeniden ölç.

## Rebase sırası — 2026-09-28, 3/8 tamam, 4.'de durdu

Melih'in sırası. Her dal: ayrı worktree · kendi Prisma client'ı · rebase ·
blob hash ile içerik kaybı kontrolü · kendi testleri + tam takım iki koşu ·
`HEAD..origin/main` boş kapısı · `--force-with-lease`, yalnız origin.

| # | dal | yeni SHA | çakışma |
|---|---|---|---|
| 1 | `servis-sikayet-uygulama` | `8caeaa08` | yok |
| 2 | `servis-yonetimi-veri-kalite-merkezi` | `ded5d1f3` | yok |
| 3 | `servis-yonetimi-bu-ay-ne-degisti` | `dd371342` | yok |
| 4 | `servis-yonetimi-acil-durum-listesi` | — | 🔴 `src/lib/audit-log.ts` |
| 5 | `servis-yonetimi-faz1b-harita` | — | sıra gelmedi |
| 6 | `feat/servis-goc-script` | — | sıra gelmedi |
| 7 | `dev-system-foundation` | — | sıra gelmedi |
| 8 | `servis-tanim-paketi` | — | sıra gelmedi |

🔴 **4. dal çakışması, çözülmedi.** `audit-log.ts` içindeki `targetType`
union'ı: main'e aynı noktaya `CALIBRATION_*`, `PDKS_*`, `IZIN_*` üyeleri
girmiş, dal ise `'SERVIS'` ekliyor. Worktree `/home/elif/wt-acil` rebase
yarıda duruyor (`git rebase --abort` ile geri alınır).

🔴 **Beklenen çakışma çıkmadı, beklenmeyen çıktı.** `servis-yonetimi/page.tsx`
hiç çakışmadı. Buna karşılık ilk üç dalın üçü de `Sidebar.tsx`'e satır
ekliyor ve üçü de main'e karşı temiz geçti — ama **birbirlerine karşı
geçmezler**: main'e sırayla girerken aynı menü bloğunda çakışacaklar.

## Sırada

Prod dry-run (Melih) → yerleşke/firma gerçek adları + 14 açık eşleme
satırı (İdari İşler) → yinelenen durak kararı (Elif) → tanım seed'i
prod'da `--apply` (Melih) → rol açılışı.
