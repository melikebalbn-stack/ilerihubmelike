// Geçiş kuralı (atama-gecis.ts) ORTAK örnek tablosu — transfer (service.test.ts), Excel değişikliği
// (excel-atama.test.ts) ve yardımcının kendi testi AYNI beklentileri doğrular → "iki akış aynı sonuç".
// Sabit "şimdi": 2026-10-03 (Türkiye günü); eski atama 2026-09-27'de başlamış.
export const GECIS_SIMDI_ISO = '2026-10-03T09:00:00.000Z'
export const GECIS_ESKI_BASLANGIC = '2026-09-27'

export const GECIS_ORNEKLERI: { ad: string; gun: string; eskiAktif: boolean; eskiBitis: string; yeniBugunKapsar: boolean }[] = [
  { ad: 'bugün', gun: '2026-10-03', eskiAktif: false, eskiBitis: '2026-10-03', yeniBugunKapsar: true },
  { ad: 'geçmiş', gun: '2026-09-30', eskiAktif: false, eskiBitis: '2026-09-30', yeniBugunKapsar: true },
  { ad: 'yarın (ileri)', gun: '2026-10-04', eskiAktif: true, eskiBitis: '2026-10-03', yeniBugunKapsar: false },
  { ad: 'ileri, ay sonu geçişi', gun: '2026-11-01', eskiAktif: true, eskiBitis: '2026-10-31', yeniBugunKapsar: false },
  { ad: 'ileri, yıl sonu geçişi', gun: '2027-01-01', eskiAktif: true, eskiBitis: '2026-12-31', yeniBugunKapsar: false },
]
