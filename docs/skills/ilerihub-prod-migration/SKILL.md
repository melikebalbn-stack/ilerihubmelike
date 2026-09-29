---
name: ilerihub-prod-migration
description: YALNIZ sunucu (rokunet) oturumu için — ILERIHub prod DB'ye migration uygularken: migrate diff, bilinen drift filtresi, yedek+TOC, psql -f, resolve --applied, preflight ve guard'lı push sırası. Geliştirici sandbox'ında kullanılmaz; geliştiriciler süreci bilmek için okuyabilir.
---

# ILERIHub — Prod Migration Prosedürü

Sunucu: 172.16.16.33, kullanıcı rokunet. Prod DB `ilerihub`. Prod'a dokunan her komutu **Melih kendisi çalıştırır**; Claude Code hazırlar, komut bloğunu verir, çalıştırmaz.

## Kesin kurallar
- `migrate deploy` prod'da YASAK; `migrate dev` paylaşımlı DB'de YASAK.
- Additive (yeni tablo, nullable kolon, index): **önce migration, sonra kod deploy**.
- Destructive (DROP, RENAME, NOT NULL): **önce kod deploy + swap, sonra DB**.
- `ALTER TYPE ... ADD VALUE` ayrı migration dosyasında, `--single-transaction` OLMADAN.
- DB main'in önünde kalırsa preflight herkesin deploy'unu durdurur → migration uygulandıktan hemen sonra şema main'e push edilir.

## 1) Hazırlık (salt okunur)
- Geliştiricinin dalını doğrula: SHA, dosya listesi, şema diff sınıflaması (yeni model / nullable / index / mevcut enum'a değer / NOT NULL / FK / unique / silme). Composite FK veya kısmi unique varsa DUR.
- `preflight.sh` → yalnız bilinen drift (`servis_personel_atama_guzergah_durak_fkey`, `lib-knowndrift.sh`). Başka fark varsa DUR.
- origin/main'den taze worktree, dal `chore/<is>`; yalnız `prisma/schema.prisma` + migration klasörü (+ gerekiyorsa seed dosyaları). Özellik kodu dalda kalır.
- SQL üret: `npx prisma migrate diff --from-schema <main şeması> --to-schema <dal şeması> --script` (`--to-schema-datamodel` ve `--from-url` bu sürümde yok). `Loaded Prisma config` satırını ve bilinen drift DROP'unu çıkar.
- Migration timestamp'i main'deki son klasörden sonra olmalı.
- Sahte `DATABASE_URL` ile `prisma generate` → `NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit`. Enum eklemede exhaustive switch / `Record<Enum,…>` taraması.
- Etkilenen tabloların satır sayısı (kilit riski).

## 2) Yedek
`pg_dump -Fc` → TOC satır sayısını son yedekle karşılaştır; %90 altındaysa DUR. Yol + boyut raporla.

## 3) Komut bloğu (Melih çalıştırır)
```bash
unset DATABASE_URL PORT
cd "$WT"
set -a; . /home/rokunet/projects/ilerihub/.env; set +a
psql "$DATABASE_URL" -Atc "select current_database();"     # ilerihub değilse DUR
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f "prisma/migrations/$MIG/migration.sql"
npx prisma migrate resolve --applied "$MIG"                 # WT içinde, ~/projects/ilerihub'da DEĞİL
npx prisma migrate status | tail -3
# doğrulama SELECT'leri (kolon / tablo / constraint / enum_range)
unset DATABASE_URL
git fetch origin \
  && git rebase origin/main \
  && [ -z "$(git log --oneline HEAD..origin/main)" ] \
  && [ "$(ls -1 prisma/migrations | grep -E '^[0-9]{14}_' | sort | tail -1)" = "$MIG" ] \
  && git push origin HEAD:refs/heads/main \
  || { git rebase --abort 2>/dev/null; echo "⛔ DUR"; }
git -C /home/rokunet/repo-elif.git remote update --prune
/home/rokunet/scripts/preflight.sh 2>&1 | tail -6            # "temiz — yalnız bilinen drift"
```

## 4) Seed
- Sıra: `seed-roles` → `seed-permissions` → modül mapping seed'i.
- Mapping seed'i rol bağlarını **geri açabilir**; kasıtlı kapatılmış yetki varsa çalıştırma, yalnız gereken bağları SQL ile ekle (`NOT EXISTS` korumalı).
- Doğrulama: anahtar | rol listesi sorgusu.

## Tuzaklar
- Push non-fast-forward → main ilerlemiş; DB zaten uygulanmışsa **hemen** rebase + push (drift herkesi durdurur).
- Başka oturum prod'a migration uygulayıp push etmemişse preflight drift verir → o oturuma iletilir, bu işin kapsamında çözülmez.
- Elle alınan yedek tablolar (`*_yedek_*`) drift üretir; iş bitince silinmeli.
