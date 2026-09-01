export type SeferDilimi = { id: string; kod: string; ad: string; yon: 'GIDIS' | 'DONUS' }
export type GuzergahDurakSaat = { id: string; dilimId: string; saat: string; aktif: boolean; dilim: SeferDilimi }
export type GuzergahDurak = {
  id: string
  durakId: string
  durak: { id: string; kod: string; ad: string; aktif: boolean }
  sira: number
  aktif: boolean
  saatler: GuzergahDurakSaat[]
}
