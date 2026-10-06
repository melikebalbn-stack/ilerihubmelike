-- İzin: İV'nin elle düzeltebildiği kıdem başlangıcı (yalnız gösterim; hak edişi etkilemez).
-- Boşsa en eski istihdam dönemi (topluluğa giriş) kullanılır. Additive; DROP yok.
ALTER TABLE "Personnel" ADD COLUMN "kidemBaslangici" DATE;
