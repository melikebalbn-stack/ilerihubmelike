// Üretim Terminali (tezgah başı) — T1 mock veri katmanı.
//
// Bu modül HİÇBİR IFS çağrısı yapmaz; tüm veri sabittir. T2+ aşamalarında
// ShopFloorService projeksiyonlarına bağlanacak. Şimdilik ekran/etkileşim
// iskeletini beslemek için gerçekçi örnek kayıtlar tutar.

export type TerminalDurum = 'ISLENEBILIR' | 'BEKLIYOR'

export interface TerminalIsMerkezi {
  kod: string
  ad: string
}

export interface TerminalIsEmri {
  id: string
  isMerkezi: string
  isEmriNo: string
  operasyon: string
  operasyonNo: number
  stokKodu: string
  stokAdi: string
  /** ISO 8601 tarih (yyyy-MM-dd). */
  teslimTarihi: string
  miktar: number
  kalanMiktar: number
  uretilenMiktar: number
  hurdaMiktar: number
  durum: TerminalDurum
}

// T2 — canlı (PLC) takip anlık durumu. Tek bir tezgahın o anki üretim/OEE
// göstergeleri. Gerçekte MAS/PLC katmanından gelecek; şimdilik tek mock kayıt.
export interface TerminalCanliDurum {
  isEmriId: string
  makine: string
  veriKaynagi: 'PLC'
  durum: 'CALISIYOR' | 'DURUSTA'
  durusTuru?: string
  /** ISO 8601 — duruş başlangıcı (durum DURUSTA ise). */
  durusBaslangic?: string
  netUretim: number
  hurda: number
  planUretim: number
  ortCevrimSn: number
  planCevrimSn: number
  planliDurusDk: number
  plansizDurusDk: number
  belirsizDurusDk: number
  netSureDk: number
  /** ISO 8601 — iş başlangıç zamanı. */
  isBaslangic: string
  /** Son PLC sinyalinden bu yana geçen saniye. */
  sonSinyalSn: number
  /** Yüzde (0–100). */
  oee: number
  performans: number
  kullanilabilirlik: number
  kalite: number
}

export const MOCK_IS_MERKEZI: TerminalIsMerkezi = {
  kod: 'WMM01',
  ad: 'Montaj Hattı',
}

// MAS ekranındaki değerlere benzer gerçekçi tek kayıt (88/200, çevrim 217,9 vs 180,
// OEE 82,6). wo-1 (M002250148) iş emrine bağlı.
export const MOCK_CANLI_DURUM: TerminalCanliDurum = {
  isEmriId: 'wo-1',
  makine: 'CN01',
  veriKaynagi: 'PLC',
  durum: 'DURUSTA',
  durusTuru: 'Planlı Duruş — Mola',
  durusBaslangic: '2026-07-04T13:48:00',
  netUretim: 88,
  hurda: 3,
  planUretim: 200,
  ortCevrimSn: 217.9,
  planCevrimSn: 180,
  planliDurusDk: 14,
  plansizDurusDk: 6,
  belirsizDurusDk: 2,
  netSureDk: 318,
  isBaslangic: '2026-07-04T08:30:00',
  sonSinyalSn: 47,
  oee: 82.6,
  performans: 82.6,
  kullanilabilirlik: 91.5,
  kalite: 96.6,
}

// T3 — duruş bildirim sebepleri. Planlı vs plansız ayrımı UI'da gruplama için.
export const DURUS_SEBEPLERI: {
  kod: string
  ad: string
  tur: 'PLANLI' | 'PLANSIZ'
}[] = [
  { kod: 'CAY', ad: 'Çay Molası', tur: 'PLANLI' },
  { kod: 'YEMEK', ad: 'Yemek Molası', tur: 'PLANLI' },
  { kod: 'KALIP', ad: 'Kalıp/Ayar Değişimi', tur: 'PLANLI' },
  { kod: 'TEMIZLIK', ad: 'Temizlik', tur: 'PLANLI' },
  { kod: 'ARIZA', ad: 'Makine Arızası', tur: 'PLANSIZ' },
  { kod: 'MALZEME', ad: 'Malzeme Bekleme', tur: 'PLANSIZ' },
  { kod: 'TAKIM', ad: 'Takım/Aparat Bekleme', tur: 'PLANSIZ' },
  { kod: 'OPERATOR', ad: 'Operatör Yok', tur: 'PLANSIZ' },
]

// T3 — hurda bildirim sebepleri.
export const HURDA_SEBEPLERI: { kod: string; ad: string }[] = [
  { kod: 'MAKINE', ad: 'Makine Hatası' },
  { kod: 'OPERATOR', ad: 'Operatör Hatası' },
  { kod: 'MALZEME', ad: 'Malzeme Hatası' },
  { kod: 'OLCU', ad: 'Ölçü/Tolerans Dışı' },
]

export const MOCK_IS_EMIRLERI: TerminalIsEmri[] = [
  {
    id: 'wo-1',
    isMerkezi: 'WMM01',
    isEmriNo: 'M002250148',
    operasyon: 'DİŞ ÇEKME',
    operasyonNo: 10,
    stokKodu: '31450027',
    stokAdi: 'Flanş Bağlantı Mili M16',
    teslimTarihi: '2026-07-08',
    miktar: 500,
    kalanMiktar: 320,
    uretilenMiktar: 176,
    hurdaMiktar: 4,
    durum: 'ISLENEBILIR',
  },
  {
    id: 'wo-2',
    isMerkezi: 'WMM01',
    isEmriNo: 'M002250152',
    operasyon: 'DELİK DELME',
    operasyonNo: 20,
    stokKodu: '31450081',
    stokAdi: 'Redüktör Kapak Sacı 6mm',
    teslimTarihi: '2026-07-10',
    miktar: 250,
    kalanMiktar: 250,
    uretilenMiktar: 0,
    hurdaMiktar: 0,
    durum: 'BEKLIYOR',
  },
  {
    id: 'wo-3',
    isMerkezi: 'WMM01',
    isEmriNo: 'M002250159',
    operasyon: 'İÇ TORNALAMA',
    operasyonNo: 30,
    stokKodu: '31450113',
    stokAdi: 'Rulman Yatağı Gövdesi Ø90',
    teslimTarihi: '2026-07-09',
    miktar: 120,
    kalanMiktar: 45,
    uretilenMiktar: 72,
    hurdaMiktar: 3,
    durum: 'ISLENEBILIR',
  },
  {
    id: 'wo-4',
    isMerkezi: 'WMM01',
    isEmriNo: 'M002250163',
    operasyon: 'MONTAJ',
    operasyonNo: 40,
    stokKodu: '31450204',
    stokAdi: 'Konveyör Tahrik Grubu Komple',
    teslimTarihi: '2026-07-15',
    miktar: 60,
    kalanMiktar: 60,
    uretilenMiktar: 0,
    hurdaMiktar: 0,
    durum: 'BEKLIYOR',
  },
  {
    id: 'wo-5',
    isMerkezi: 'WMM01',
    isEmriNo: 'M002250170',
    operasyon: 'DIŞ TORNALAMA',
    operasyonNo: 10,
    stokKodu: '31450259',
    stokAdi: 'Piston Kolu Ø45x220',
    teslimTarihi: '2026-07-11',
    miktar: 800,
    kalanMiktar: 610,
    uretilenMiktar: 185,
    hurdaMiktar: 5,
    durum: 'ISLENEBILIR',
  },
  {
    id: 'wo-6',
    isMerkezi: 'WMM01',
    isEmriNo: 'M002250178',
    operasyon: 'TAŞLAMA',
    operasyonNo: 50,
    stokKodu: '31450288',
    stokAdi: 'Mil Ucu Rektifiye Bileziği',
    teslimTarihi: '2026-07-14',
    miktar: 340,
    kalanMiktar: 128,
    uretilenMiktar: 210,
    hurdaMiktar: 2,
    durum: 'ISLENEBILIR',
  },
  {
    id: 'wo-7',
    isMerkezi: 'WMM01',
    isEmriNo: 'M002250185',
    operasyon: 'DİŞ ÇEKME',
    operasyonNo: 20,
    stokKodu: '31450301',
    stokAdi: 'Bağlantı Cıvatası M20x80',
    teslimTarihi: '2026-07-16',
    miktar: 1500,
    kalanMiktar: 1500,
    uretilenMiktar: 0,
    hurdaMiktar: 0,
    durum: 'BEKLIYOR',
  },
  {
    id: 'wo-8',
    isMerkezi: 'WMM01',
    isEmriNo: 'M002250191',
    operasyon: 'DELİK DELME',
    operasyonNo: 30,
    stokKodu: '31450347',
    stokAdi: 'Şaft Kelepçesi Yarım Ay',
    teslimTarihi: '2026-07-13',
    miktar: 420,
    kalanMiktar: 96,
    uretilenMiktar: 320,
    hurdaMiktar: 4,
    durum: 'ISLENEBILIR',
  },
  {
    id: 'wo-9',
    isMerkezi: 'WMM01',
    isEmriNo: 'M002250198',
    operasyon: 'İÇ TORNALAMA',
    operasyonNo: 40,
    stokKodu: '31450392',
    stokAdi: 'Kovan Burç Bronz Ø60',
    teslimTarihi: '2026-07-18',
    miktar: 200,
    kalanMiktar: 200,
    uretilenMiktar: 0,
    hurdaMiktar: 0,
    durum: 'BEKLIYOR',
  },
  {
    id: 'wo-10',
    isMerkezi: 'WMM01',
    isEmriNo: 'M002250205',
    operasyon: 'MONTAJ',
    operasyonNo: 50,
    stokKodu: '31450436',
    stokAdi: 'Hidrolik Silindir Blok Grubu',
    teslimTarihi: '2026-07-20',
    miktar: 40,
    kalanMiktar: 22,
    uretilenMiktar: 17,
    hurdaMiktar: 1,
    durum: 'ISLENEBILIR',
  },
]
