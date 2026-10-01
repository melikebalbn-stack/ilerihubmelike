---
name: ilerihub-gelistirici-dal-disiplini
description: ILERIHub geliştiricisi (Elif, Nurgül, Melike) kendi dalında iş yaparken ve her push öncesi — worktree düzeni, rebase-push refleksi, şema yetki sınırı, yetki zinciri, sandbox DB ve Türkçe karakter kuralları.
---

# ILERIHub — Geliştirici Dal Disiplini

Bu skill sandbox'ta çalışan geliştiricinin kod asistanı içindir. Amaç: dalın main'e sorunsuz girmesi, başkasının işini geri almamak, Melih'i gereksiz beklemeye sokmamak.

## 1. Çalışma düzeni
- Ana repo dev server'a ayrılır, **dal değiştirmez**.
- Her aktif iş kendi worktree'sinde: `git worktree add ../wt-<is> origin/main -b dev/<ad>/<is>`.
- `node_modules` her worktree'de kendisinindir: worktree kökünde `npm ci` (≈35 sn). Main'e alma ve tam takım doğrulaması kendi `node_modules`'ı ile yapılır; ana repoya symlink yalnız hızlı tek-dosya denemesi içindir.
- `.env` ana repodaki `.env`'e symlink kalır (`ln -s <ana-repo>/.env .env`). Vitest bu dosyayı `process.env`'e yüklemez: DB'ye bağlanan testler (`--project integration`: ipro, ldap-sync-debounce) için önce `set -a; . ./.env; set +a` ve `current_database()` kontrolü gerekir. Ölçüm (2026-10-01, kendi `node_modules` + symlink `.env`): scripts/ipro unit testleri (92) yeşil; integration projesi kırmızı — export'suz `SASL: client password must be a string`, export'lu `table public.ipro_mola_tanim does not exist` (dev DB main'in migration'larından geride). Kırmızının nedeni symlink değil DB'dir; `migrate status` ile geride sayısını ölç, sandbox gerideyse §5'teki yola git (yedek → `migrate deploy`, yalnız sandbox).
- `src/generated` symlink YAPILMAZ: her worktree kendi dizininde tutar ve orada `prisma generate` çalıştırır. Paylaşılırsa worktree'deki generate ana repodaki dev server'ın client'ını ezer ve farklı şemalı dallarda sahte test sonucu üretir.
- Dal adı `dev/<ad>/` ile başlar ve işi anlatır. **Her iş için main'den taze dal.** Bir günden uzun yaşayan dal her gün rebase edilir.
- Meta-iş (CI, lint, başka modül bulguları) yapma; tek satır not düş, Melih isterse açılır.

## 2. Push refleksi (her push öncesi, istisnasız)
```bash
unset DATABASE_URL PORT
git fetch origin && git rebase origin/main
git log --oneline HEAD..origin/main      # BOŞ olmalı
DATABASE_URL='postgresql://yok:yok@127.0.0.1:1/x' npx prisma generate
NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit
npx vitest run --project unit
git push --force-with-lease
```
- `git add -A` YASAK — selektif staging, her dosya ayrı satır, sonra `git status --short`.
- Bayat generated client sahte tsc/test hatası üretir → rebase sonrası her zaman `prisma generate`.
- Push sonrası Melih'e tek satır: dal | SHA | test sayısı | tsc.
- **hazirla / yayinla / deploy çalıştırma.** Main'e alma ve deploy Melih'te.

## 3. Şema yetki sınırı
| Sormadan yapabilirsin | Önce Melih'e sor |
|---|---|
| Yeni model/tablo | Mevcut enum'a değer ekleme |
| Nullable alan | Alan/model/enum silme |
| Yeni index | NOT NULL yapma |
| Yepyeni enum | Tip değişikliği, unique, mevcut modele FK |
- Şemayı dalında yaz; **migration üretme**, migration Melih'te.
- `migrate dev` YASAK. Composite FK veya kısmi unique index ekleme (kalıcı drift yaratır; tekillik transaction içinde sağlanır).

## 4. Yetki (permission) zinciri — tekrarlayan tuzak
1. `permissions.ts`'e sabit eklemek yetmez.
2. `seed-permissions.ts` DB'ye yazar ama role bağlamaz.
3. `role_permission` kaydı olmadan izin **kimsede yok** — super-admin dahil (kodda bypass yok).
4. Yeni anahtar eklediğinde Melih'e bildir; prod'a o ekler.
5. Her yeni yüzey üç katmanda korunur: API ucu (`requirePermission`, fonksiyonun ilk ifadesi, `if (error) return error`), sayfa (server guard ya da client'ta `permissions` kontrolü + "yetkiniz yok" gövdesi; `useSession()` sonucu kullanılmıyorsa korumasız sayılır), Sidebar öğesi `permission` alanı.
- `requirePermission([...])` OR'dur; AND gerekiyorsa `requireAllPermissions`.
- İstemci izinleri JWT'den gelir → deploy sonrası 5 dk gecikme normal.

## 5. Sandbox DB
- Her DB adımından önce: `psql "$DATABASE_URL" -Atc 'select current_database();'` → `ilerihub` görürsen DUR, o prod. `config-*.env` adına güvenme.
- `npx prisma migrate status` yalnız checkout'lu dalın klasörünü görür; main'e göre geride sayısını ayrıca ölç.
- Sandbox gerideyse: yedek → `migrate deploy` (yalnız sandbox'ta) → reset yok.

## 6. Türkçe ve veri
- Türkçe karşılaştırma: JS `toLocaleUpperCase('tr-TR')`; SQL'de `upper(translate(x,'çğşöüıİÇĞŞÖÜ','CGSOUIICGSOU'))`. Düz `upper()` İ/I'yı bozar.
- Import semantiği: boş/boşluk hücre = **dokunma** (tek `bosHucre()` kapısı).
- Prisma import her zaman `src/generated/prisma`; istemci bileşende yalnız `import type`.
- Prod kişisel verisi sandbox'a girmez; gerekirse anonim dağılım + sentetik veri.

## 7. Ölçüm dürüstlüğü
- "Main'e girdi" iddiası commit atasıyla değil **içerik (blob hash) karşılaştırmasıyla** doğrulanır.
- Yanlış bir tespiti fark ettiğinde açıkça geri çek ve düzelt.
