# Şu an — 2026-09-27

**Yalnız bugünü tutar.** Geçmiş fazların günlükleri buraya taşınmaz; onlar
Claude proje dokümanlarındadır.

## Nerede duruyoruz

Servis yönetimi **FAZ 1A main'de**. FAZ 1B ve sonrası **7 dalda bekliyor**
(dağılım: `SERVICE_MODULE.md`). Şikâyet modülü (FAZ 5) kod olarak bitti,
merge sırasında.

Son tamamlananlar: `servis.admin` düşürüldü (`8eea6ad1`),
`servis.edit`/`servis.tanim.manage` ayrımı testle sabitlendi, dal temizliği
(25 → 14 `dev/elif/*`).

## 🔴 Açık gate'ler — canlıya geçiş öncesi

1. **`faz1b-alternatif-servis` merge** — kapasite motoru (doluluk, boş
   koltuk, kapasite aşımı uyarısı) yalnız orada. İlk merge bu dal.
2. **Prod dry-run + Elif'in Excel listesiyle karşılaştırma.** Dry-run
   bugün koşulabilir: servis tabloları boş olsa da dry-run onlara
   **dokunmuyor** (`if (!APPLY) return`, satır 506). Beklenen sonuç tablosu
   önceden yazıldı; çıktı onunla karşılaştırılacak.
3. **Tanım verisi prod'da 0.** `servis_yerleske` / `servis_guzergah` /
   `servis_durak` boş ve bunları yaratan **hiçbir seed ya da script yok**
   (64 seed dosyası tarandı). Tek yol bugün UI'dan elle giriş.
   Dev'de 9 güzergâh + 106 durak **gerçek veriyle** dolu ama yerleşke
   `PLACEHOLDER`; taşınabilir bir tanım seed'i yazılabilir — karar bekliyor.
4. **Durak kodu şeması uyuşmuyor** — göç script'i `ARA-CEZAEVI` biçimi
   üretiyor, DB'de `ARAPCESME-01` var. 106/106 uyumsuz. Üç seçenek raporlandı,
   karar bekliyor.
5. **Prod rol açılışı** — servis anahtarları prod'da yalnız `super-admin`'de.
   Tetikleyici: "servis çekirdeği prod'a çıkıp göç doğrulandıktan sonra".
6. **TOSB güzergâhı** tanımlı değil; script `'TOSB SERVİS' → 'TOSB'` bekliyor.

## Test durumu

`npm run verify` temiz. Tam takımda **17 test / 21 dosya** kırmızı — hepsi
`ipro` / `pdks` / `ldap` alanında ve `origin/main`'in kendisinde de aynı
şekilde düşüyor (ölçüldü). Servis ve auth tarafında kırmızı yok.

## Sırada

`faz1b-alternatif-servis` merge'ü (Melih) → prod dry-run → tanım verisi
kararı → rol açılışı.
