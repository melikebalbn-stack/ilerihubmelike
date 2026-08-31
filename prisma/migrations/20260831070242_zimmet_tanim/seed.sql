-- ZimmetTanim seed - migration.sql UYGULANDIKTAN SONRA elle calistirilir
-- (psql -f). Prisma migrate bu dosyayi otomatik calistirmaz.
--
-- DIKKAT (idempotentlik): "ad, parentId" unique kisitlamasi parentId NULL
-- (kok/tur seviyesi) icin ISE YARAMAZ - standart SQL'de iki NULL birbirine
-- esit sayilmaz, yani ayni "Yazilim" kok kaydi ON CONFLICT ile yakalanmadan
-- tekrar tekrar eklenebilirdi. Bu yuzden kok kaydi icin ON CONFLICT DEGIL,
-- acik WHERE NOT EXISTS kontrolu kullaniliyor - script kac kez calistirilirsa
-- calistirilsin guvenli (idempotent).
DO $$
DECLARE
  kok_id TEXT;
BEGIN
  SELECT id INTO kok_id FROM "ZimmetTanim" WHERE ad = 'Yazılım' AND "parentId" IS NULL LIMIT 1;

  IF kok_id IS NULL THEN
    kok_id := gen_random_uuid()::text;
    INSERT INTO "ZimmetTanim" (id, ad, "parentId", sira, "updatedAt")
    VALUES (kok_id, 'Yazılım', NULL, 0, now());
  END IF;

  -- 8 yazilim, Yazilim kokunun altina - donanim olanlar (MAS Endustriyel PC,
  -- Termal Yazici gibi) KASITLI OLARAK burada YOK.
  INSERT INTO "ZimmetTanim" (id, ad, "parentId", sira, "updatedAt")
  SELECT gen_random_uuid()::text, v.ad, kok_id, v.sira, now()
  FROM (VALUES
    ('Office 365', 10),
    ('LOGO Tiger3', 20),
    ('LOGO Connect', 30),
    ('LOGO  Bordro Plus', 40),
    ('SOLIDWORKS', 50),
    ('AUTOCAD YAZILIMI', 60),
    ('Adobe Lisans', 70),
    ('E-Flow', 80)
  ) AS v(ad, sira)
  WHERE NOT EXISTS (
    SELECT 1 FROM "ZimmetTanim" c WHERE c.ad = v.ad AND c."parentId" = kok_id
  );
END $$;
