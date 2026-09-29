---
name: ilerihub-dal-main-alma
description: YALNIZ sunucu (rokunet) oturumu için — bir geliştirici dalını ILERIHub main'e alırken: üç katmanlı yetki denetimi, temiz worktree doğrulaması, içerik tabanlı merge kontrolü ve guard'lı push zinciri. Geliştiriciler dallarını neye göre denetleneceğini bilmek için okuyabilir.
---

# ILERIHub — Geliştirici Dalını Main'e Alma

Claude Code (sunucu, rokunet) önce **salt okunur denetim** yapar, sonra Melih'e komut bloğu verir; push'u Melih çalıştırır. Korumasız yeni yüzey varsa komut bloğu VERİLMEZ.

## a) Dal doğrulama
- SHA, merge-base, `HEAD..origin/main` sayısı, commit sayısı, dosya listesi (A/M, +/−).
- Şema/migration/seed dokunuşu varsa önce `ilerihub-prod-migration`.
- ALLOW_PATHS dışı dosyalar (Sidebar, `src/lib/pdf/`, `audit-log.ts`, `permissions.ts`, `package.json`) ayrıca listelenir.

## b) Yetki denetimi — üç katman AYRI
| Katman | Geçer | Korumasız sayılır |
|---|---|---|
| API ucu | `requirePermission` / `requireAllPermissions` fonksiyonun ilk ifadesi, `if (error) return error` | guard yok ya da sonra |
| Sayfa | server guard, ya da client'ta `permissions` kontrolü + "yetkiniz yok" gövdesi, fetch yalnız yetkiliyse | `useSession()` çağrılıp sonucu kullanılmıyor |
| Sidebar | yeni öğede `permission` alanı | alan yok |
Tablo: dosya | katman | koruma | anahtar. Uç guard'ı doğru olsa bile sayfa guard'ı eksik olabilir — ayrı kontrol et.

## c) Temiz worktree
```bash
export DATABASE_URL='postgresql://yok:yok@127.0.0.1:1/asla_baglanma'
git rebase origin/main
npx prisma generate            # taze client şart; bayat client sahte kırmızı test üretir
NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit
npx vitest run --project unit
```
Başarısız test varsa aynı koşuyu origin/main'de taze client'la tekrarla ve kümeyi karşılaştır.

## d) Sonraki dallara etki
Aynı dosyaya (özellikle Sidebar) dokunan kuyruktaki dallar için `/tmp` worktree'de deneme `rebase --onto` → çakışan satır aralığı. Çözme; bilgi olarak ver. Birbirine dokunan dallar **seri** alınır: biri girer, sıradaki yeni main'e rebase edilip geliştirici kendi dalında çözer.

## e) Komut bloğu (her dal için ayrı blok)
```bash
unset DATABASE_URL PORT
SP=<scratchpad>; W=$SP/wt-<is>-push; rm -rf "$W"
git -C /home/rokunet/projects/ilerihub-dev worktree prune
git -C /home/rokunet/projects/ilerihub-dev worktree add --detach "$W" origin/<dal>
cd "$W"; ln -sfn "$SP/wt-bgrubu/node_modules" node_modules
export DATABASE_URL='postgresql://yok:yok@127.0.0.1:1/asla_baglanma'
git fetch origin \
  && git rebase origin/main \
  && [ -z "$(git log --oneline HEAD..origin/main)" ] \
  && npx prisma generate \
  && NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit \
  && unset DATABASE_URL \
  && git push origin HEAD:refs/heads/main \
  && echo "✅ MAIN'DE" \
  || { git rebase --abort 2>/dev/null; echo "⛔ DUR — sıradaki bloğu ÇALIŞTIRMA"; }
git -C /home/rokunet/repo-elif.git remote update --prune
/home/rokunet/scripts/preflight.sh 2>&1 | tail -6
```
İkinci dal yalnız ilkinde "✅ MAIN'DE" görülürse çalıştırılır.

## f) Sonrası
- Rebase'le alınan dalın ref'i main'in atası olmaz; "girdi mi" sorusu **içerik** ile ölçülür. "previously applied commit" uyarısı = içerik zaten main'de.
- Geliştiriciye: SHA + "dalı içerik ölçümüyle doğrulayıp sil" + sıradaki dal.
- Canlıya çıkış bir sonraki deploy'la olur; modül yetkileri kapalıysa kullanıcı görmez.
