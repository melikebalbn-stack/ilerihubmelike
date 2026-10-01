-- İV kararı (01.10.2026): Rapor izninde belge ZORUNLU DEĞİL.
-- Her hastane vizite/rapor vermediği için zorunluluk talebi tıkıyordu. Belge yine YÜKLENEBİLİR
-- (yüklenirse özel nitelikli olarak saklanır), ama gönderim için şart değil.
-- Diğer belge-zorunlu türler (evlilik, ölüm, evlat edinme, babalık) değişmez.
-- Yalnız veri; şema değişikliği yok, deploy gerekmez (uygulama izin_turu'nu canlı okur). İdempotent.
UPDATE izin_turu SET "belgeZorunlu" = false, "updatedAt" = now()
WHERE kod = 'RAPOR' AND "belgeZorunlu" = true;
