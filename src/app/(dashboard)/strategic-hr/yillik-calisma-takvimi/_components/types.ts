import type {
  YillikTakvimDurum, YillikTakvimGerceklesmeDurumu,
  YillikTakvimOncelik, YillikTakvimPeriyot,
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

export function getKayitTarihi(kayit: YillikTakvimKaydiRow): Date | null {
  const raw = kayit.nihaiSonTarih ?? kayit.bitisTarihi ?? kayit.baslangicTarihi
  return raw ? new Date(raw) : null
}

export function getAnaSorumluAdi(kayit: YillikTakvimKaydiRow): string {
  return kayit.katilimcilar.find(katilimci => katilimci.rol === 'ANA_SORUMLU')?.user.name ?? '—'
}
