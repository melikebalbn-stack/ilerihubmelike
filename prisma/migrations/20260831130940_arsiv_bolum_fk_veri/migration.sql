-- ARŞİV BÖLÜM FK — VERİ DOLDURMA
--
-- Şema migration'ı (20260831130739_arsiv_bolum_fk) yalnız kolonu açtı.
-- Burası mevcut 30 DepartmentDefinition kaydını doğru arsiv_bolum satırına bağlar.
--
-- NEDEN: arsiv-auth.ts erişimi `Personnel.bolum` metnini `arsiv_bolum.ad` ile BİREBİR
-- karşılaştırıyordu. 30.08 Title-Case yeniden adlandırmasından sonra 28 aktif bölümden
-- yalnız 2'si eşleşiyordu → arşiv fiilen SUPER_ADMIN dışında kimseye açılmıyordu.
--
-- Normalize: upper() Türkçe 'İ'yi bozduğu için KULLANILMAZ; translate() ile İ/I/ı→i,
-- ş→s, ğ→g, ç→c, ö→o, ü→u eşlemesi yapılır (src/lib/auth/personnel-access.ts
-- normalizeDept() ile aynı kural).

-- ── 1) Normalize ad eşleşmesi (20 kayıt) ────────────────────────────────────────
UPDATE "DepartmentDefinition" d
   SET "arsivBolumId" = b.id
  FROM arsiv_bolum b
 WHERE d."arsivBolumId" IS NULL
   AND lower(translate(b.ad,   'İIıŞşĞğÇçÖöÜü', 'iiissggccoouu'))
     = lower(translate(d.name, 'İIıŞşĞğÇçÖöÜü', 'iiissggccoouu'));

-- ── 2) Elle karar verilen beş eşleşme ───────────────────────────────────────────
-- Normalize de çözmüyor; adlar gerçekten farklı. arsiv_bolum.kod (UNIQUE) üzerinden
-- bağlanır — id dizisi ortamlar arası kaymasın diye. Parantez içi: prod'daki id.
UPDATE "DepartmentDefinition" d
   SET "arsivBolumId" = b.id
  FROM (VALUES
          ('Asansör Müdürlüğü',           'ASN'),  -- id 1  · "ASANSÖR"
          ('Finans-Muhasebe Müdürlüğü',   'FMM'),  -- id 6  · "FİNANS MUHASEBE MÜDÜRLÜĞÜ" (tire farkı)
          ('İnsan Varlıkları Müdürlüğü',  'IVK'),  -- id 9  · "İNSAN VARLIKLARI" ("Müdürlüğü" eklendi)
          ('Mühendislik Müdürlüğü',       'MHN'),  -- id 15 · "MÜHENDİSLİK" ("Müdürlüğü" eklendi)
          ('Satış & Pazarlama Müdürlüğü', 'SAT')   -- id 21 · "SATIŞ VE PAZ.MÜDÜRLÜĞÜ" (VE↔&, PAZ.↔Pazarlama)
       ) AS m(dept_adi, arsiv_kod)
  JOIN arsiv_bolum b ON b.kod = m.arsiv_kod
 WHERE d.name = m.dept_adi
   AND d."arsivBolumId" IS NULL;

-- ── 3) Dörde ayrılan depo → tek arşiv kutusu (DEP) ──────────────────────────────
-- Çoka-bir: dört bölümün arşivi ayrılmadı, hepsi DEPO kutusunu gösterir.
UPDATE "DepartmentDefinition" d
   SET "arsivBolumId" = b.id
  FROM arsiv_bolum b
 WHERE b.kod = 'DEP'
   AND d."arsivBolumId" IS NULL
   AND d.name IN ('Yarı Mamul ve Hammadde Depo', 'Mamul Depo', 'Tesellüm Depo', 'Sarf Depo');

-- ── 4) DOĞRULAMA — eşleşmeyen kayıt kalırsa migration DURUR ─────────────────────
-- Muaf: 'BÜRO MEMURU' (isActive=false, arşiv karşılığı yok, kişi taşımıyor).
DO $$
DECLARE
  eksik text;
  dolu  int;
  bos   int;
BEGIN
  SELECT string_agg(name, ', ' ORDER BY name) INTO eksik
    FROM "DepartmentDefinition"
   WHERE "arsivBolumId" IS NULL
     AND name <> 'BÜRO MEMURU';

  IF eksik IS NOT NULL THEN
    RAISE EXCEPTION 'ARŞİV FK: arsivBolumId çözülemeyen bölüm(ler) var → %. Eşleme elle karara bırakıldı; migration durduruldu.', eksik;
  END IF;

  SELECT count(*) FILTER (WHERE "arsivBolumId" IS NOT NULL),
         count(*) FILTER (WHERE "arsivBolumId" IS NULL)
    INTO dolu, bos
    FROM "DepartmentDefinition";

  RAISE NOTICE 'ARŞİV FK: % bölüm bağlandı, % bölüm null (yalnız muaf kayıtlar).', dolu, bos;
END $$;
