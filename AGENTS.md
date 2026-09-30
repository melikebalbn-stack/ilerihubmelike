# ILERIHub geliştirme kuralları
Kurallar docs/skills/ altında. Kurulum: klasörleri ~/.claude/skills/ altına kopyala.
- Her iş ve her push öncesi: docs/skills/ilerihub-gelistirici-dal-disiplini/SKILL.md
- Prod migration süreci (yalnız sunucu): docs/skills/ilerihub-prod-migration/SKILL.md
- Dalı main'e alma süreci (yalnız sunucu): docs/skills/ilerihub-dal-main-alma/SKILL.md

## Bulut oturumu çalışma şekli (Melih'in claude.ai / web oturumları)
Sunucuya, prod DB'ye ve IFS'e erişimi olmayan bulut oturumu için geçerlidir.

**Kod**
- Kod parçası yazıp kullanıcıya kopyalatma. `melihjoe/ilerihub` repo'sunu oturuma bağla (push), klonla, değişikliği dosyada doğrudan yap.
- Kurulum (bir kez):
  ```bash
  npm ci --no-audit --no-fund --ignore-scripts
  PRISMA_SCHEMA_ENGINE_BINARY=/bin/true DATABASE_URL='postgresql://yok:yok@127.0.0.1:1/x' npx prisma generate
  ```
  (`binaries.prisma.sh` bulutta engelli; `PRISMA_SCHEMA_ENGINE_BINARY` indirmeyi atlatır, client yine üretilir.)
- Her değişiklikten sonra `npm run type-check` (~3 dk). İlgili birim testi varsa `npx vitest run --project unit`. Hata varsa düzeltmeden "bitti" deme.
- IFS'e canlı istek atılamaz. IFS davranışı doğrulanması gereken iş → kodu yaz, doğrulamayı sunucu oturumuna bırakılacak adım olarak yaz.

**Commit ve push**
- Commit öncesi neyin değiştiğini kısa bir tabloyla göster (dosya | ne).
- `git add -A` yasak: her dosya ayrı `git add`, sonra `git status --short`.
- Mesaj İngilizce, conventional commits (`feat(depo): …`, `fix(ifs): …`, `docs: …`).
- Push: `git fetch origin main && git rebase origin/main` → type-check tekrar → `git push origin HEAD:main` (yalnız fast-forward; force push yok).

**Deploy (kullanıcı çalıştırır)**
- Sunucuya erişim yok; iş bitince kullanıcıya şu bloğu commit SHA'sı doldurulmuş olarak ver:
  ```bash
  /home/rokunet/scripts/deploy.sh                                        # pasif slota build (~11 dk)
  /home/rokunet/scripts/rollback.sh --swap-only --expect <SHA> --dry-run # önce kuru deneme
  /home/rokunet/scripts/rollback.sh --swap-only --expect <SHA>           # canlıya al
  /home/rokunet/scripts/status.sh
  ```
- Başka bir deploy sürüyorsa bekle. Slot klasörlerinde elle değişiklik ya da build yok. Mesai içinde PM2 restart yok.

**Veritabanı**
- Şemayı değiştiren her iş (yeni migration, tablo/kolon ekleme-silme, tip, NOT NULL, unique, FK) önce kullanıcıya sorulur; onaysız yapılmaz.
- `prisma migrate deploy` / `migrate dev` yasak. Onaylı migration prod'a kullanıcı tarafından `docs/skills/ilerihub-prod-migration` sürecine göre uygulanır (yedek → `psql -f` → `migrate resolve --applied`), kod push'u ondan sonra.

**İletişim**
- Emin olunmayan iş kuralı tahmin edilmez, sorulur.
- Cevaplar Türkçe, kısa, mümkünse tablo.
- Şifre / secret sohbete ya da koda yazılmaz.
