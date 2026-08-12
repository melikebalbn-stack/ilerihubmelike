import type {
  YillikTakvimDurum, YillikTakvimGerceklesmeDurumu,
  YillikTakvimOncelik, YillikTakvimPeriyot,
  YillikTakvimKayitTuru,
} from '@/generated/prisma'

export interface YillikTakvimKaydiRow {
  id: string
  anaKonu: string
  surec: string
  kisaBaslik: string | null
  oncelik: YillikTakvimOncelik
  periyot: YillikTakvimPeriyot
  durum: YillikTakvimDurum
  baslangicTarihi: string | null
  bitisTarihi: string | null
  nihaiSonTarih: string | null
  plananUygulamaTarihi: string | null
  iptalMi: boolean
  kalanGun: number | null
  kaynakModul: string | null
  gerceklesmeDurumu: YillikTakvimGerceklesmeDurumu
  gerceklesmeTarihi: string | null
  department: { id: string; name: string } | null
  katilimcilar: { rol: string; user: { name: string | null } }[]
}

export interface YillikTakvimKaydiDetail {
  id: string
  yil: number
  anaKonu: string
  surec: string
  kisaBaslik: string | null
  aciklama: string | null
  oncelik: YillikTakvimOncelik
  kayitTuru: YillikTakvimKayitTuru
  periyot: YillikTakvimPeriyot
  durum: YillikTakvimDurum
  plananUygulamaTarihi: string | null
  nihaiSonTarih: string | null
  disKurum: string | null
  gerceklesmeDurumu: YillikTakvimGerceklesmeDurumu
  gerceklesmeTarihi: string | null
  gerceklesmemeNedeni: string | null
  kaynakModul: string | null
  iptalMi: boolean
  arsivMi: boolean
  createdById: string
  department: { id: string; name: string } | null
  katilimcilar: { id: string; user: { id: string; name: string | null } }[]
  sonrakiKayitlar: { id: string; yil: number; durum: YillikTakvimDurum }[]
}

export interface YillikTakvimChecklistItem {
  id: string
  baslik: string
  aciklama: string | null
  sira: number
  sonTarih: string | null
  zorunlu: boolean
  kanitGerekli: boolean
  tamamlandi: boolean
  tamamlanmaTarihi: string | null
  sorumlu: { id: string; name: string | null } | null
  tamamlayan: { id: string; name: string | null } | null
}

export interface YillikTakvimApprovalStep {
  id: string
  tur: number
  adimSira: number
  unvan: string
  karar: 'ONAYLANDI' | 'REVIZYON_ISTENDI' | null
  yorum: string | null
  kararTarihi: string | null
  onaylayan: { id: string; name: string | null } | null
}

export interface YillikTakvimAttachment {
  id: string
  dosyaAdi: string
  dosyaTuru: string
  boyut: number | null
  createdAt: string
  yukleyen: { id: string; name: string | null }
}

export function getKayitTarihi(kayit: YillikTakvimKaydiRow): Date | null {
  const raw = kayit.nihaiSonTarih ?? kayit.bitisTarihi ?? kayit.baslangicTarihi
  return raw ? new Date(raw) : null
}

export function getAnaSorumluAdi(kayit: YillikTakvimKaydiRow): string {
  return kayit.katilimcilar.find(katilimci => katilimci.rol === 'ANA_SORUMLU')?.user.name ?? '—'
}
