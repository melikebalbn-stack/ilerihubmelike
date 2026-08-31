-- DEPARTMENT DEFINITION ↔ ORG UNIT BAĞLANTISI — VERİ DOLDURMA
--
-- Şema migration'ı (…_dept_orgunit_fk) yalnız kolonu açtı. Burası mevcut bölüm
-- tanımlarını organizasyon şemasındaki karşılık kutusuna bağlar.
--
-- NE DEĞİŞMİYOR: bölüm listesinin kaynağı. /api/settings/hr-departments yine
-- DepartmentDefinition döndürür; OrgUnit'ten besleme YOK. Personnel.bolum metin kalır.
-- Bu bağ yalnız iki tarafı ad metnine bağlı kalmadan eşler.
--
-- ŞEMADA BÖLÜM ROLÜ olan kutu: unitType='DEPARTMENT' AND code <> 'ORG-TF' (kök firma)
-- AND code NOT LIKE 'ORG-KR-%' (kurul/komite — ek görev, bölüm değil). 32 DEPARTMENT
-- kutusundan geriye 23 aday kalır.
--
-- Normalize: upper() Türkçe 'İ'yi bozduğu için KULLANILMAZ; translate() ile
-- İ/I/ı→i, ş→s, ğ→g, ç→c, ö→o, ü→u (normalizeDept() ile aynı kural).
--
-- ELLE UYGULAMA NOTU: `prisma migrate deploy` bu dosyayı kendi transaction'ında
-- çalıştırır. `psql -f` ile elle uygulanacaksa dosyayı BEGIN; … COMMIT; ile SARMALA —
-- aksi hâlde her ifade kendi transaction'ında commit olur ve aşağıdaki guard
-- tetiklendiğinde UPDATE geri alınmaz (kısmi yazma kalır).

-- ── 0) ÖN KONTROL — aday kutularda mükerrer normalize ad ────────────────────────
-- İki farklı kutu aynı ada normalize oluyorsa UPDATE hangisini seçeceğini rastgele
-- belirler. (Staging veri kümesinde bu durum GERÇEKTEN var: ORG-AS ve ORG-TF-P0108
-- ikisi de "Asansör Müdürlüğü".) Sessiz yanlış eşleşme yerine dur.
DO $$
DECLARE mukerrer text;
BEGIN
  SELECT string_agg(anahtar || ' → ' || kodlar, '; ') INTO mukerrer FROM (
    SELECT lower(translate(name, 'İIıŞşĞğÇçÖöÜü', 'iiissggccoouu')) AS anahtar,
           string_agg(code, ', ' ORDER BY code) AS kodlar
      FROM "OrgUnit"
     WHERE "unitType" = 'DEPARTMENT' AND code <> 'ORG-TF' AND code NOT LIKE 'ORG-KR-%'
     GROUP BY 1 HAVING count(*) > 1) t;
  IF mukerrer IS NOT NULL THEN
    RAISE EXCEPTION 'DEPT↔ORG: aday şema kutularında mükerrer ad var → %. Eşleşme belirsiz; migration durduruldu.', mukerrer;
  END IF;
END $$;

-- ── 1) Normalize ad eşleşmesi (22 kayıt) ────────────────────────────────────────
UPDATE "DepartmentDefinition" d
   SET "orgUnitId" = u.id
  FROM "OrgUnit" u
 WHERE d."orgUnitId" IS NULL
   AND u."unitType" = 'DEPARTMENT'
   AND u.code <> 'ORG-TF'
   AND u.code NOT LIKE 'ORG-KR-%'
   AND lower(translate(u.name, 'İIıŞşĞğÇçÖöÜü', 'iiissggccoouu'))
     = lower(translate(d.name, 'İIıŞşĞğÇçÖöÜü', 'iiissggccoouu'));

-- ── 2) DOĞRULAMA ────────────────────────────────────────────────────────────────
-- (a) Bağlanan sayısı 22 değilse DUR.
-- (b) Null kalması BEKLENEN 8 kayıt dışında null kalan varsa DUR.
--     Beklenen null: dört depo (şemada operatör kutuları var, bölüm kutusu yok),
--     DEPO (123 ayrılmış kayıt taşıyor), GENEL MÜDÜRLÜK, YATIRIM VE TEŞVİK,
--     BÜRO MEMURU (isActive=false). Bu turda şemada kutu AÇILMIYOR.
DO $$
DECLARE
  bagli int;
  beklenmeyen text;
BEGIN
  SELECT count(*) INTO bagli FROM "DepartmentDefinition" WHERE "orgUnitId" IS NOT NULL;
  IF bagli <> 22 THEN
    RAISE EXCEPTION 'DEPT↔ORG: bağlanan kayıt sayısı % (beklenen 22). Şema kutuları veya bölüm adları değişmiş; migration durduruldu.', bagli;
  END IF;

  SELECT string_agg(name, ', ' ORDER BY name) INTO beklenmeyen
    FROM "DepartmentDefinition"
   WHERE "orgUnitId" IS NULL
     AND name NOT IN ('Yarı Mamul ve Hammadde Depo', 'Mamul Depo', 'Tesellüm Depo', 'Sarf Depo',
                      'DEPO', 'GENEL MÜDÜRLÜK', 'YATIRIM VE TEŞVİK', 'BÜRO MEMURU');
  IF beklenmeyen IS NOT NULL THEN
    RAISE EXCEPTION 'DEPT↔ORG: beklenmeyen şekilde şema karşılığı bulunamayan bölüm(ler) → %. Elle karar gerekir; migration durduruldu.', beklenmeyen;
  END IF;

  RAISE NOTICE 'DEPT↔ORG: 22 bölüm şema kutusuna bağlandı, 8 bölüm null (beklenen liste).';
END $$;
