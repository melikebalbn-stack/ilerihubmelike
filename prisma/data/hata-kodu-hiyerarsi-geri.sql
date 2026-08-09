-- ═══════════════════════════════════════════════════════════════════════════
--  KAL-KYT-15 Bölüm 1 — hata kodu hiyerarşisini YENİDEN KURAR
--
--  Neden gerekli: `20260809180000_hata_kodu_duz_liste` ustKodId kolonunu düşürdü,
--  hiyerarşi verisi kolonla birlikte gitti. `20260809200000_hata_kodu_hiyerarsi_geri`
--  kolonu BOŞ olarak geri ekler; bağları bu dosya kurar.
--
--  ÖNCE migration, SONRA bu dosya.
--
--  Kural: her alt kod, kendinden KÜÇÜK EN YAKIN başlığa bağlanır.
--  Başlıklar (ustKodId NULL kalır): 100 150 180 200 250 300 350 400 450 500
--                                   550 600 700 750 800 850 900 950
--  Genel uygunsuzluklar (ustKodId NULL kalır): 1..9
--
--  191 → 180 (Planlama) İSTİSNASI: kuralın kendisi zaten bunu veriyor
--  (180 < 191 < 200 → en yakın küçük başlık 180). Ayrı bir UPDATE gerekmiyor;
--  aşağıdaki kontrol sorgusu bunu ayrıca doğruluyor.
--
--  Kod, ad, aktif/pasif ve siraNo değerlerine DOKUNULMAZ — yalnız ustKodId yazılır.
--  Tek transaction. Yeniden çalıştırılabilir (idempotent): aynı sonucu üretir.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Başlıklar ve genel uygunsuzluklar kökte kalır (kolon zaten NULL geldi;
-- dosya ikinci kez çalıştırılırsa da doğru duruma çeker).
UPDATE "HataKodu"
SET "ustKodId" = NULL
WHERE kod IN (1,2,3,4,5,6,7,8,9,
              100,150,180,200,250,300,350,400,450,500,
              550,600,700,750,800,850,900,950);

-- Alt kodlar: kendinden küçük EN YAKIN başlığa bağlanır.
UPDATE "HataKodu" c
SET "ustKodId" = (
  SELECT p.id
  FROM "HataKodu" p
  WHERE p.kod IN (100,150,180,200,250,300,350,400,450,500,
                  550,600,700,750,800,850,900,950)
    AND p.kod < c.kod
  ORDER BY p.kod DESC
  LIMIT 1
)
WHERE c.kod NOT IN (1,2,3,4,5,6,7,8,9,
                    100,150,180,200,250,300,350,400,450,500,
                    550,600,700,750,800,850,900,950);

-- ── KONTROL ── beklenen: toplam 126 · kok 27 · alt 99 · yetim 0
SELECT
  count(*)                                        AS toplam,
  count(*) FILTER (WHERE "ustKodId" IS NULL)      AS kok_27,
  count(*) FILTER (WHERE "ustKodId" IS NOT NULL)  AS alt_99,
  count(*) FILTER (WHERE "ustKodId" IS NULL AND kod > 9
                     AND kod NOT IN (100,150,180,200,250,300,350,400,450,500,
                                     550,600,700,750,800,850,900,950)) AS yetim_0
FROM "HataKodu";

-- 191 → 180 (Planlama) teyidi: tek satır, ust_kod = 180 dönmeli
SELECT c.kod AS kod, p.kod AS ust_kod, p.ad AS ust_ad
FROM "HataKodu" c JOIN "HataKodu" p ON p.id = c."ustKodId"
WHERE c.kod = 191;

-- Doğruysa COMMIT; değilse ROLLBACK.
COMMIT;
