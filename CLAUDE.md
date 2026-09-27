# ILERIHub — kod asistanı çalışma sözleşmesi

Kısa ve operasyonel. Teknik gerçek `context/` altındadır, burada
tekrarlanmaz — görevine göre `context/README.md`'den ilgili dosyayı oku.

## Ortam (Elif)

Klasör `/home/elif/ilerihub` · port **3011** · pm2 `ilerihub-dev-elif` ·
kendi izole dev DB'si **`ilerihub_dev_elif`** (prod'a etkisi yok).
Sandbox alanı: `src/app/(dashboard)/sandbox/elif/`.

## Normal akış

```
görev → context router → İLGİLİ KODU OKU → sınırı belirle → uygula
      → verify → kendi düzelt → tekrar verify → context güncelle
      → final audit → checkpoint (commit)
```

Rutin ve geri dönüşlü teknik işler için **onay isteme** — kendin çöz ve devam
et. Onay yalnız aşağıdaki listede.

## 🔴 DUR VE SOR

1. Production/canlı sistemi etkileyen her işlem
2. Gerçek şirket verisini değiştiren / destructive işlem
3. DB veri kaybı riski
4. Geri dönüşü zor schema migration
5. Auth/authorization güvenliğini değiştiren karar
6. Başka modülde veya başka geliştiricinin alanında geniş kapsamlı değişiklik
7. Shared component davranışını değiştiren önemli işlem
8. Önemli ürün / iş süreci kararı
9. Repository'de çözülemeyen kritik belirsizlik
10. **main'e merge — BİZDE ASLA, Melih yapar**
11. ALLOW_PATHS dışındaki dosyalar
12. **`hazirla` / `yayinla` — kalıcı donmuş, istisnasız**

## 🔴 Veritabanı

**Her veri/şema komutundan önce:**
```
psql "$DATABASE_URL" -Atc "select current_database();"
```
Çıktı `ilerihub` ise **DUR — o PROD'dur**. Yalnız `ilerihub_dev_elif`
görünce devam et. Dosya adına güvenme. Çıktıyı raporda göster.

Kendi dev DB'mde `prisma migrate dev` ve `prisma generate` serbest.
**Asla:** `DROP DATABASE/ROLE`, `createdb`, `dropdb`, `ALTER ROLE`,
`GRANT/REVOKE`, `TRUNCATE`, `migrate reset`, seed çalıştırma, ve `sudo`
gerektiren her şey. *(Sebep: `ilerihub_user` aynı zamanda PROD sahibidir.)*
"Veritabanını sıfırla" teklifi **asla** kabul edilmez.

Yazma öncesi `pg_dump` yedeği; silme tek transaction; öncesi/sonrası sayım.

## Git

- Taze iş = **main'den taze dal**. Mevcut iş dallarına commit eklenmez.
- `git add -A` **yasak** — dosyalar tek tek stage'lenir.
- Commit öncesi `git status`/`diff` gösterilir.
- **Asla commit'lenmez:** `src/generated/`, `.env*`, `prisma.config.ts`.
- Push hedefi **daima ve yalnız `origin`**. `hub` / `kisisel`'e push yok.
  Stash'lere dokunulmaz. Merge yok. `--force-with-lease` yalnız kendi dalında.
- Rebase tabanı ilerlediyse **doğrulama sıfırdan tekrarlanır**.

## Dal silme ölçütü

İki nokta `log`/`diff` **kullanılmaz** — squash merge SHA kimliğini yok eder,
ilerlemiş main diff'i kirletir. Doğru ölçüt:
üç nokta ile dalın **kendi** dosya kümesi → her dosya main'dekiyle **bayt
bayt**. Yerel ve origin uçları **ayrı ayrı** doğrulanır.

## Test

- Günlük: **`npm run verify`** (typecheck + lint + unit).
- Tam takım: `npm test -- --run`. Push öncesi **iki kez** koşulur (kırılgan
  test yakalamak için).
- Kırmızı çıkan test **benim işim mi**, iddia değil **ölçümle** kanıtlanır:
  aynı testler base commit'te koşulur.
- Kritik testler **mutasyonla** doğrulanır — kod bilerek bozulur, test
  düşmezse test vakumludur.
- Boş sonuca dayanma: bir arama boş dönüyorsa, aynı sorgunun bilinen bir
  pozitifte çalıştığı **önce** gösterilir.
- Sunucu ayaktayken `.next` silinmez: `pm2 stop → rm -rf .next → pm2 start`.

## Kod kuralları

`context/ARCHITECTURE.md` → zorunlu desenler ve bilinen tuzaklar.
Özet: `@/lib/prisma`'dan import, `@/lib/auth`'tan guard, shadcn,
yamalı/geçici çözüm yok — kök sebep çözülür, kapsam kendiliğinden
küçültülmez. Tahmin edilmez; emin değilsen **dur ve sor**.

## İletişim

Sade Türkçe, teknik terimler İngilizce. Kısa ve net. Popup / seçenek menüsü
kullanılmaz — sorular düz yazıyla, en fazla tek net soru. Önce kısa plan,
sonra uygulama.
