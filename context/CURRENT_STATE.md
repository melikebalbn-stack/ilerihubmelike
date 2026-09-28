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
   `servis-yonetimi-export`in 10 dosyası da girdi. Dalların ref'leri
   duruyor, dokunulmuyor.

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

Tam takım **142 dosya / 1560 test, 0 başarısız** (bu dalda ölçüldü, taban
güncel main).

🔴 **DÜZELTME — Ders 111.** Bu bölüm 2026-09-27'de "17 test / 21 dosya
kırmızı, `origin/main`'in kendisinde de aynı şekilde düşüyor" diyordu.
**O ölçüm geçersiz.** Sebep: worktree'ler `src/generated`'i paylaşılan
dizine symlink'liyordu ve o Prisma client bayattı (2026-06-20). Bayat
client hem daldaki hem base'deki koşuyu aynı şekilde bozuyor, bu yüzden
"küme aynı, demek ki mevcut sorun" çıkarımı dayanaksızdı.
Kural: **her worktree kendi client'ını üretir**; paylaşılacaksa yalnız
`node_modules`. Paylaşılan dizine `prisma generate` koşulmaz (dev sunucusu
o client'ı yüklü tutuyor).

## Sırada

Prod dry-run (Melih) → yerleşke/firma gerçek adları + 14 açık eşleme
satırı (İdari İşler) → yinelenen durak kararı (Elif) → tanım seed'i
prod'da `--apply` (Melih) → rol açılışı.
