# ILERIHub Migration Discipline

Blue-Green deployment altyapısı için DB schema migration kuralları.

## Neden gerek

Deploy sırasında nginx upstream switch yaparken **eski ve yeni kod** aynı DB'ye
30-60 saniye boyunca paralel yazabilir. Bu süre içinde:

- Yeni kod, eski schema ile **çalışabilmeli**
- Eski kod, yeni schema ile **çalışabilmeli** (rollback senaryosu)
- Veri kaybı veya bozulma olmamalı

Bu yüzden schema + kod aynı PR'da yapılmaz, **aşamalı** yapılır.

---

## Pattern: Expand → Migrate → Contract

### 1. Expand (genişlet)
- Yeni kolon/tablo/index EKLE (nullable + backward compatible)
- Eski kod hâlâ çalışır (yeni kolonu kullanmaz)
- Yeni kod yazılır AMA eski + yeni format destekler

### 2. Migrate (taşı)
- Veri yeni yapıya taşınır (script veya backfill)
- Çift yazım: kod hem eski hem yeni alana yazar
- Okuma yavaş yavaş yeni alana kayar

### 3. Contract (daralt)
- Eski kolon/tablo/index SİL
- Kod sadece yeni yapıyı bilir
- Geri dönüşü zor (önceki aşamalardan sonra)

Her aşama **AYRI deploy** olur. Aralarında en az birkaç saat (ideal: 1-2 gün) bekle
— production'da sorun çıkarsa farkedilsin.

---

## Senaryolar

### Senaryo 1: Yeni nullable kolon ekleme (KOLAY — TEK AŞAMA)

Örnek: Personnel'e `linkedin_url` ekle.

```sql
-- Tek migration
ALTER TABLE personnel ADD COLUMN linkedin_url TEXT;
```

**Kod:** Yeni alan yazma/okuma optional. Eski kod hâlâ çalışır (NULL kabul edilir).

**Deploy:** Tek PR, tek deploy. Risk düşük.

---

### Senaryo 2: Zorunlu kolon ekleme (3 AŞAMA)

Örnek: User'a `mfa_enabled` zorunlu ekle (default false, sonra zorunlu).

**PR-A (Expand):**
```sql
ALTER TABLE "User" ADD COLUMN mfa_enabled BOOLEAN DEFAULT false;
```
Kod: Optional kullan. Default false.

**PR-B (Migrate, AYRI deploy):**
```sql
-- Tüm satırlarda değer dolu olduğunu garantile
UPDATE "User" SET mfa_enabled = false WHERE mfa_enabled IS NULL;
```
Kod: Her yere mfa_enabled değeri yazar (default false explicit).

**PR-C (Contract, AYRI deploy, 1-2 gün sonra):**
```sql
ALTER TABLE "User" ALTER COLUMN mfa_enabled SET NOT NULL;
```

---

### Senaryo 3: Kolon yeniden adlandırma (3 AŞAMA — DUAL WRITE)

Örnek: Personnel'de `tel` → `phone` rename.

**PR-A (Expand):**
```sql
ALTER TABLE personnel ADD COLUMN phone TEXT;
-- Mevcut veriyi kopyala
UPDATE personnel SET phone = tel WHERE phone IS NULL;
```
Kod: Hem `tel` hem `phone`'a yazar. Okumada `phone` öncelikli, NULL ise `tel` fallback.

**PR-B (Migrate, AYRI deploy):**
- Kod: Sadece `phone` okur, `tel`'i ignore eder
- Eski kod hâlâ `tel`'i de yazıyor — uyumluluk için

**PR-C (Contract, AYRI deploy):**
- Kod: Sadece `phone` yazar/okur
- Migration: `ALTER TABLE personnel DROP COLUMN tel;`

⚠️ **Asla tek PR'da rename yapma** — `RENAME` PostgreSQL'de atomic ama deploy
sırasında eski kod hâlâ `tel`'i sorgular, exception verir.

---

### Senaryo 4: Kolon silme (2 AŞAMA — CONTRACT)

Örnek: Personnel'den `eski_kategori` sil (artık kullanılmıyor).

**PR-A (Code cleanup):**
- Kod: Hiçbir yerden `eski_kategori` okumayı/yazmayı kaldır
- Migration YOK (DB'de henüz kolon var, optional)

**PR-B (DB cleanup, AYRI deploy, 1-2 gün sonra):**
```sql
ALTER TABLE personnel DROP COLUMN eski_kategori;
```

⚠️ **Asla tek PR'da yapma** — eğer rollback olursa eski kod kolon arar.

---

### Senaryo 5: Tablo rename (EN ZOR — 4 AŞAMA + view)

Genelde gerek yok. Gerekiyorsa: yeni tablo + dual write view + cutover + drop.
İstenirse ayrı runbook yaz.

---

## Pre-deploy checklist

Schema değişikliği içeren her PR için:

- [ ] Migration backward-compatible mi? (Eski kod yeni schema ile çalışır)
- [ ] Forward-compatible mi? (Yeni kod eski schema ile çalışır)
- [ ] Drop/Rename var mı? Varsa AŞAMALI mı? (Tek PR yasak)
- [ ] Index ekleme: CONCURRENTLY mi? (Production'da blocking olmasın)
  ```sql
  CREATE INDEX CONCURRENTLY idx_name ON table (column);
  ```
- [ ] Migration script staging'de test edildi mi?
- [ ] Rollback path açık mı? (rollback.sh sonrası eski kod çalışır mı?)

---

## Production'da migration nasıl çalıştırılır

```bash
# 1. Staging'de test
ssh rokunet@172.16.16.33
cd /home/rokunet/projects/ilerihub-staging
npx prisma migrate dev --name <migration_name>
# Sonuçları doğrula

# 2. Prod blue'da migration (HENÜZ deploy YAPMA)
cd /home/rokunet/projects/ilerihub
npx prisma migrate deploy
# Bu DB schema'sını günceller AMA kod henüz değişmedi
# Mevcut blue kodu yeni schema ile çalışmaya devam etmeli (expand aşaması)

# 3. Deploy (kod değişikliğini canlıya al)
/home/rokunet/scripts/deploy.sh
# Bu green'e git pull + build + nginx switch yapar
```

Sıra **önemli**: Migration ÖNCE, deploy SONRA. Çünkü:
- Migration ÖNCE: Eski kod yeni schema ile çalışabilmeli (expand backward-compatible)
- Deploy SONRA: Yeni kod hem eski hem yeni veriyi okur

---

## ILERIHub'daki gerçek örnekler

### PR-F1 (User↔Personnel link, 23 Nis 2026)
- Expand: `User.personnelId @unique + FK` (nullable)
- Migrate: 166/206 user matching script ile bağlandı
- Contract: Yok (kalan 40 user manuel bağlanacak, henüz null kalabilir)

### PR-Y1 (RBAC, 6 May 2026)
- 6 yeni tablo, 47 permission, 9 sistem rolü
- Expand: Yeni tablolar + Role enum → UserRoleEnum rename
- Önemli sapma: enum rename DB'de `@@map("Role")` ile korundu (atomik değil, expand-contract uygulandı)

### PR-Y2 (auth helpers)
- Expand: Yeni helper'lar (require-session.ts) eklendi
- Migrate: Mevcut handler'lar yeni helper'a geçirildi (393 handler, atomik commit'ler)
- Contract: Eski helper kaldırılmadı, kullanılmıyor

---

## Bilinen tuzaklar

1. **`@@unique(map:"...")` index üretir, constraint değil** — `DROP INDEX` kullan, `DROP CONSTRAINT` değil (memory'de detay var)

2. **Prisma migrate vs raw SQL** — Karmaşık migration'lar için raw SQL kullan. `prisma migrate dev` shadow DB ile çalışır, prod data ile test etmez.

3. **`SET NOT NULL` atomic ama yavaş** — Büyük tabloda LOCK alır. Önce constraint ekle ve test et:
   ```sql
   ALTER TABLE x ADD CONSTRAINT y_not_null CHECK (y IS NOT NULL) NOT VALID;
   ALTER TABLE x VALIDATE CONSTRAINT y_not_null;
   -- Sonra:
   ALTER TABLE x ALTER COLUMN y SET NOT NULL;
   ```

4. **Enum değişiklikleri** — PostgreSQL enum'unda eski değer silmek zor. Yeni enum oluştur, kolonu çevir, eski drop.

5. **Foreign key cascade** — `ON DELETE CASCADE` veri kaybı yaratır. Production'da düşünerek kullan, `RESTRICT` daha güvenli (rollback edilebilir hata).
