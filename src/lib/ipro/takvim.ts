// IPRO vardiya + çalışma takvimi — SERVİS + SAF yardımcılar (Melike #5).
// OEE hesabı YOK — yalnız veri girişi. is-basla/is-bitir/poller'a dokunmaz.
// Helper LIB'de (route export kuralı — 23.07 dersi).
import { prisma } from '@/lib/prisma'
import type { IproTatilTip } from '@/lib/ipro/takvim-util'

// Saf yardımcılar (pazarMi/gunDurumu/gecerliSaat/gecerliTatilTip) client-safe modülde:
export { gecerliTatilTip, gecerliSaat, pazarMi, gunDurumu, tarihAnahtari, IPRO_TATIL_TIPLERI } from '@/lib/ipro/takvim-util'
export type { IproTatilTip, GunDurum } from '@/lib/ipro/takvim-util'

// ── Vardiya servisi ──

export interface VardiyaGirdi {
  kod: string
  ad: string
  baslangicSaat: string
  bitisSaat: string
  ertesiGuneTasar: boolean
  sira: number
  aktif: boolean
}

export function listVardiyalar() {
  return prisma.iproVardiya.findMany({ orderBy: [{ sira: 'asc' }, { kod: 'asc' }] })
}

export function createVardiya(data: VardiyaGirdi) {
  return prisma.iproVardiya.create({ data, select: { id: true, kod: true } })
}

export function updateVardiya(id: string, data: Partial<VardiyaGirdi>) {
  return prisma.iproVardiya.update({ where: { id }, data, select: { id: true, kod: true } })
}

// ── Tatil (çalışma takvimi) servisi ──

export interface TatilGirdi {
  tarih: Date
  tip: IproTatilTip
  aciklama: string
  createdById?: string | null
}

export function listTatiller(yil: number) {
  return prisma.iproTatil.findMany({ where: { yil }, orderBy: { tarih: 'asc' } })
}

export function createTatil(g: TatilGirdi) {
  return prisma.iproTatil.create({
    data: { tarih: g.tarih, tip: g.tip, aciklama: g.aciklama, yil: g.tarih.getUTCFullYear(), createdById: g.createdById ?? null },
    select: { id: true, tarih: true, tip: true },
  })
}

export function deleteTatil(id: string) {
  return prisma.iproTatil.delete({ where: { id }, select: { id: true } })
}
