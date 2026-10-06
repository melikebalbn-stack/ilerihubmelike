-- RMA iade türü opsiyonel: 153 geçmiş kayıttan yalnız 24'ünde dolu; NOT NULL aktarımı
-- engelliyordu, uydurma değer veriyi bozardı. Yeni kayıtta Zod hâlâ zorunlu tutar.
ALTER TABLE "RmaKayit" ALTER COLUMN "iadeTuru" DROP NOT NULL;
