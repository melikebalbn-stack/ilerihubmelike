-- Melih Bey onayıyla uygulanır. --single-transaction OLMADAN uygulanmalı (ALTER TYPE ADD VALUE).
-- FİF Paket 4: KSS "Kayda Al" sonrası sorumlu bölüm onayı adımı (izleme sorumlusu seçimi).
-- Sıra: 20261002070000_fif_paket3 SONRASI uygulanır. Veri dönüşümü YOK
-- (mevcut kayıtlar SORUMLU_ATAMA_BEKLIYOR'a taşınmaz; yalnız yeni Kayda Al'lar kullanır).

-- AlterEnum
ALTER TYPE "FifDurum" ADD VALUE 'SORUMLU_ATAMA_BEKLIYOR';
