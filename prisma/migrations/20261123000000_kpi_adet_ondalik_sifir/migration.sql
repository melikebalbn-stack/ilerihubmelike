-- KPI-ONDALIK: "Adet" (tam sayı/count) birimli KPI'larda ondalık basamak hâlâ varsayılanda
-- (2) kalıp "39,33 Adet" gibi anlamsız gösterime devam ediyordu — bu KPI'lar henüz kimse elle
-- özelleştirmediği için varsayılanda, retroaktif olarak 0'a çekiliyor. Elle farklı bir değer
-- seçilmiş olan (varsayılan dışı) bir KPI'ya dokunulmuyor.
UPDATE "KPIDefinition" SET "ondalikBasamak" = 0 WHERE lower(trim(unit)) = 'adet' AND "ondalikBasamak" = 2;
