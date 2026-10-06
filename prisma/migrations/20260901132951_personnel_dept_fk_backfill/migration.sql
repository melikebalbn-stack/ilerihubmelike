-- PERSONNEL → DEPARTMENT / SORUMLU FK · BACKFILL (FAZ 1)
--
-- Şema migration'ı yalnız 4 nullable kolonu açtı. Burası MEVCUT veriyi doldurur.
-- METİN alanları (bolum, birimSorumlusu, sorumlu2, sorumlu3) OLDUĞU GİBİ KALIR ve
-- yazılmaya devam eder — okuma tarafının hiçbiri bu turda FK'ya çevrilmedi.
--
-- ELLE UYGULAMA NOTU: `prisma migrate deploy` bu dosyayı kendi transaction'ında
-- çalıştırır. `psql -f` ile elle uygulanacaksa BEGIN; … COMMIT; ile SARMALA —
-- yoksa guard tetiklendiğinde UPDATE geri alınmaz.

-- ── 1) departmentId — Personnel.bolum = DepartmentDefinition.name (BİREBİR) ──────
-- Normalize/ILIKE YOK: ölçümde aktif 188 personelin 188'i birebir eşleşiyor.
-- Gevşek eşleşme yanlış bölüme bağlama riski taşır; birebir tutmayan varsa
-- aşağıdaki guard durdurur ve elle karar gerekir.
UPDATE "Personnel" p
   SET "departmentId" = d.id
  FROM "DepartmentDefinition" d
 WHERE p.aktif AND p."departmentId" IS NULL AND d.name = p.bolum;

-- ── 2) sorumlu1/2/3 Id — ad = Personnel.adSoyad AND aktif ────────────────────────
-- `aktif = true` ZORUNLU: 7 isimde (BEDRİ GÜLER, EROL TURHAN, FAZIL MELİH DİLBEN,
-- MEHTAP KAPTAN, MUSTAFA ÇELİK, ORHAN ÇAKMAK, ŞENER ŞEN) bir aktif + en az bir
-- pasif mükerrer kayıt var; filtre olmadan FK pasif kayda bağlanır.
-- Aynı ada sahip İKİ AKTİF kişi yok (ölçüldü) — eşleşme tekil.
UPDATE "Personnel" p SET "sorumlu1Id" = s.id FROM "Personnel" s
 WHERE p.aktif AND p."sorumlu1Id" IS NULL AND btrim(coalesce(p."birimSorumlusu",'')) <> ''
   AND s.aktif AND s."adSoyad" = btrim(p."birimSorumlusu") AND s.id <> p.id;

UPDATE "Personnel" p SET "sorumlu2Id" = s.id FROM "Personnel" s
 WHERE p.aktif AND p."sorumlu2Id" IS NULL AND btrim(coalesce(p."sorumlu2",'')) <> ''
   AND s.aktif AND s."adSoyad" = btrim(p."sorumlu2") AND s.id <> p.id;

UPDATE "Personnel" p SET "sorumlu3Id" = s.id FROM "Personnel" s
 WHERE p.aktif AND p."sorumlu3Id" IS NULL AND btrim(coalesce(p."sorumlu3",'')) <> ''
   AND s.aktif AND s."adSoyad" = btrim(p."sorumlu3") AND s.id <> p.id;

-- ── 3) DOĞRULAMA ────────────────────────────────────────────────────────────────
DO $$
DECLARE eksik_dept text; eksik_sor text; pasif_dolu int;
BEGIN
  -- (a) Aktif her personelin departmentId'si dolu olmalı.
  SELECT string_agg(p."sicilNo" || ' → ' || coalesce(p.bolum,'(BOŞ)'), ', ') INTO eksik_dept
    FROM "Personnel" p WHERE p.aktif AND p."departmentId" IS NULL;
  IF eksik_dept IS NOT NULL THEN
    RAISE EXCEPTION 'BACKFILL: departmentId çözülemeyen aktif personel → %', eksik_dept;
  END IF;

  -- (b) Sorumlu METNİ dolu ama FK boş kalan olmamalı (kendi kendini gösteren hariç).
  SELECT string_agg(t.iz, '; ') INTO eksik_sor FROM (
    SELECT p."sicilNo" || ' s1=' || btrim(p."birimSorumlusu") AS iz FROM "Personnel" p
     WHERE p.aktif AND btrim(coalesce(p."birimSorumlusu",''))<>'' AND p."sorumlu1Id" IS NULL
       AND btrim(p."birimSorumlusu") <> p."adSoyad"
    UNION ALL
    SELECT p."sicilNo" || ' s2=' || btrim(p."sorumlu2") FROM "Personnel" p
     WHERE p.aktif AND btrim(coalesce(p."sorumlu2",''))<>'' AND p."sorumlu2Id" IS NULL
       AND btrim(p."sorumlu2") <> p."adSoyad"
    UNION ALL
    SELECT p."sicilNo" || ' s3=' || btrim(p."sorumlu3") FROM "Personnel" p
     WHERE p.aktif AND btrim(coalesce(p."sorumlu3",''))<>'' AND p."sorumlu3Id" IS NULL
       AND btrim(p."sorumlu3") <> p."adSoyad") t;
  IF eksik_sor IS NOT NULL THEN
    RAISE EXCEPTION 'BACKFILL: sorumlu metni dolu ama FK çözülemedi → %', eksik_sor;
  END IF;

  -- (c) Pasif kayıtlara DOKUNULMAMIŞ olmalı.
  SELECT count(*) INTO pasif_dolu FROM "Personnel"
   WHERE NOT aktif AND ("departmentId" IS NOT NULL OR "sorumlu1Id" IS NOT NULL
                        OR "sorumlu2Id" IS NOT NULL OR "sorumlu3Id" IS NOT NULL);
  IF pasif_dolu <> 0 THEN
    RAISE EXCEPTION 'BACKFILL: % pasif kayda FK yazılmış (yalnız aktifler doldurulmalıydı)', pasif_dolu;
  END IF;

  RAISE NOTICE 'BACKFILL OK: aktif personelin tamamı departmentId aldı, sorumlu FK boşluğu yok, pasif kayıtlar null.';
END $$;
