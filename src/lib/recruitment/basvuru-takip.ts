import crypto from "crypto";

// Başvuru takip imzası — public durum sorgusu (tablet teşekkür ekranı yoklaması) için
// hafif, sunucu-doğrulamalı kimlik. applicationNumber tahmin edilebilir olduğundan tek
// başına yetmez; imza ile birlikte capability oluşturur.
//
// HMAC-SHA256(applicationId, NEXTAUTH_SECRET) → hex → ilk 32 karakter.
// SIR (NEXTAUTH_SECRET) ASLA loglanmaz, yanıta konmaz, dışa verilmez.

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET tanımlı değil — takip imzası üretilemez");
  return s;
}

export function basvuruTakipImzasi(applicationId: string): string {
  return crypto.createHmac("sha256", secret()).update(applicationId).digest("hex").slice(0, 32);
}

// Sabit-zaman karşılaştırma (timingSafeEqual). Uzunluk sabit (32 hex) ve herkesçe bilinir;
// uzunluk uymuyorsa erken false (timing sızıntısı önemsiz — beklenen uzunluk gizli değil).
export function imzaDogrula(applicationId: string, imza: string): boolean {
  const beklenen = Buffer.from(basvuruTakipImzasi(applicationId));
  const gelen = Buffer.from(typeof imza === "string" ? imza : "");
  if (beklenen.length !== gelen.length) return false;
  return crypto.timingSafeEqual(beklenen, gelen);
}
