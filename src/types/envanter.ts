export type EnvanterUrunTipi =
  | 'STANDART_STOK'
  | 'PERIYODIK_TUKETIM'
  | 'NUMARALI_URUN'
  | 'ZIMMETLI_URUN'
  | 'BEDENLI_URUN'
  | 'KKD_URUNU'

export type EnvanterVaryantTipi =
  | ''
  | 'BEDEN'
  | 'NUMARA'
  | 'RENK'
  | 'BEDEN_RENK'
  | 'NUMARA_RENK'

export type EnvanterStokSatiri = {
  ilkGiris: string
  minStok: string
  kritikStok: string
  maxStok: string
  depo: string
  raf: string
}

export type EnvanterUrunForm = {
  kod: string
  ad: string
  kategori: string
  tip: EnvanterUrunTipi | string
  olcuBirimi: string
  barkod: string
  aciklama: string

  varyantTipi: EnvanterVaryantTipi | string
  bedenTipi: string
  bedenler: string[]
  numaralar: string[]
  renkler: string[]
  stokSatirlari: Record<string, EnvanterStokSatiri>

  tedarikci: string
  marka: string
  model: string
  sonAlisFiyati: string
  paraBirimi: string
  kdvOrani: string
  minSiparisMiktari: string
  tedarikSuresiGun: string

  dagitimSekli: string
  periyot: string
  kullanimOmruGun: string
  teslimYetkisi: string
  sureSonuAksiyonu: string
  dagitimKurali: string

  eskiUrunIade: boolean
  yoneticiOnayi: boolean
  aciklamaZorunlu: boolean
  fotoZorunlu: boolean
  imzaZorunlu: boolean
  qrZorunlu: boolean
  barkodZorunlu: boolean

  hedefYaka: string
  hedefBolum: string
  hedefPozisyon: string
  hedefLokasyon: string
  hedefVardiya: string
  calismaSekli: string
  personelHedefTipi: string
  atamaTipi: string
  tahminiDagitim: string
  sonrakiDagitimTarihi: string
  seciliPersoneller: string[]
}

export type EnvanterUrunListItem = {
  id: string
  kod: string
  ad: string
  kategori: string | null
  tip: string
  bedenTipi: string
  olcuBirimi: string
  mevcut: number
  min: number
  kritik: number
  durum: 'NORMAL' | 'KRITIK' | 'PASIF'
  varyantSayisi: number
}

export type EnvanterUrunDetail = {
  id: string
  kod: string
  ad: string
  kategori: string | null
  tip: string
  olcuBirimi: string
  barkod: string | null
  aciklama: string | null
  tedarikci: string | null
  marka: string | null
  model: string | null
  dagitimSekli: string | null
  periyot: string | null
  kullanimOmruGun: number | null
  teslimYetkisi: string | null
  sureSonuAksiyonu: string | null
  dagitimKurali: string | null
  createdAt: string
  varyantlar: {
    id: string
    varyantAdi: string
    beden: string | null
    numara: string | null
    renk: string | null
  }[]
  stoklar: {
    id: string
    mevcut: number
    minStok: number | null
    kritikStok: number | null
    maxStok: number | null
    depo: string | null
    raf: string | null
    durum: string
    varyantAdi: string | null
  }[]
  hareketler: {
    id: string
    hareketTipi: string
    miktar: number
    depo: string | null
    raf: string | null
    aciklama: string | null
    createdAt: string
  }[]
}