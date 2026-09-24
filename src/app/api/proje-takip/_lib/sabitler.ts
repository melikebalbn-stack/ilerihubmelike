// Proje Takip sabit değer listeleri — tek kaynak. Zod şemaları bunlardan
// z.enum(...) üretir, API bu değerler dışındakini reddeder.

export const DURUM_DEGERLERI = [
  "YENI_DEVAM_EDEN",
  "TASARIM_YENI_DEVAM_EDEN",
  "ONAY_BEKLEYEN_GONDERILEN",
  "REVIZYON",
  "ONAY_ALAN",
  "IPTAL",
] as const;

export const PROJE_DURUM_TIPI_DEGERLERI = [
  "NUMUNE",
  "PROTOTYPE",
  "SERI",
  "PPAP",
  "TASARIM",
  "REVIZYON",
  "YENIDEN_PPAP",
] as const;

export const MUHENDISLIK_DOLDURMA_DEGERLERI = ["BEKLIYOR", "TAMAMLANDI"] as const;

export const LOG_ISLEM_TIPLERI = [
  "OLUSTURULDU",
  "MUHENDISLIK_DOLDURDU",
  "DURUM_DEGISTI",
  "BILDIRIM_GONDERILDI",
  "BILDIRIM_BEKLIYOR",
] as const;
