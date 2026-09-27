# context/ — görev yönlendirici

Bu dizin **kod asistanının görmesi gereken teknik gerçeği** tutar. Program
yönetimi kaydı (faz takibi, göç analizleri, ders anlatıları, Melih
yazışmaları) **Claude proje dokümanlarında** durur ve buraya kopyalanmaz.

🔴 **Tek kaynak kuralı:** aynı bilgi iki dosyada durmaz. Bir gerçek burada
yazılıysa CLAUDE.md'de tekrarlanmaz; kodda okunabiliyorsa buraya yazılmaz
(kod önceliklidir — bu dosyalar kodla çelişirse **kod doğrudur**, belge
düzeltilir).

## Görev başına ne okunacak

Hepsini okuma. Görevine bakan satırı seç.

| Görev | Oku |
|---|---|
| Küçük bug fix, tek dosya düzeltmesi | *(hiçbiri — koda bak)* |
| Yeni ekran / API ucu | `ARCHITECTURE.md` |
| Yetki, rol, permission, KVKK | `DATA_AND_SECURITY.md` |
| Servis yönetimi modülünde herhangi bir iş | `SERVICE_MODULE.md` + `DATA_AND_SECURITY.md` |
| "Şu an neredeyiz / sırada ne var" | `CURRENT_STATE.md` |
| Mimari veya veri modeli değiştirecek iş | `DECISIONS.md` + `ARCHITECTURE.md` |
| Kapsam / bu iş bize mi ait | `PRODUCT_AND_SCOPE.md` |
| Şema değişikliği, migration | `DECISIONS.md` + `docs/MIGRATION-RULES.md` |
| Deploy, cron | `docs/DEPLOYMENT.md`, `docs/CRON.md` *(bu dizinde değil)* |

## Dosyalar

- **PRODUCT_AND_SCOPE.md** — ürün nedir, kim kullanır, modül sınırları
- **ARCHITECTURE.md** — stack, katmanlar, dosya yerleşimi, tekrarlanan desenler
- **SERVICE_MODULE.md** — servis yönetimi modülü (aktif iş alanı)
- **DATA_AND_SECURITY.md** — yetki matrisi, KVKK, veri sınırları
- **CURRENT_STATE.md** — **yalnız bugün**: açık gate'ler, sıradaki paket
- **DECISIONS.md** — **yalnız kalıcı** mimari/veri/güvenlik kararları

## Bakım

- `CURRENT_STATE.md` her paket sonunda güncellenir; geçmiş oraya birikmez.
- `DECISIONS.md`'e bug fix ve küçük UI değişikliği **yazılmaz**.
- Bir dosya kodla çeliştiği fark edilirse, o turda düzeltilir.
