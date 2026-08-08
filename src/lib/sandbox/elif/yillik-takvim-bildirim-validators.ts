import { z } from 'zod'
import { YILLIK_TAKVIM_KATILIMCI_ROLLERI } from '@/components/sandbox/elif/takvim/types'

const TetikSchema = z.string().refine(
  v => v === 'son_gun' || /^gun_kala:\d+$/.test(v) || /^gun_gecikme:\d+$/.test(v),
  { message: "Geçersiz tetik formatı (beklenen: 'gun_kala:N', 'gun_gecikme:N' veya 'son_gun')" },
)
const KanalSchema = z.enum(['HUB', 'EPOSTA'])

export const BildirimKuraliCreateSchema = z.object({
  tetik: TetikSchema,
  aliciRoller: z.array(z.enum(YILLIK_TAKVIM_KATILIMCI_ROLLERI)).min(1),
  kanal: z.array(KanalSchema).min(1),
  aktif: z.boolean().optional(),
})

export const BildirimKuraliUpdateSchema = BildirimKuraliCreateSchema.partial()

export function parseTetik(tetik: string): { tip: 'gun_kala' | 'gun_gecikme' | 'son_gun'; deger: number } {
  if (tetik === 'son_gun') return { tip: 'son_gun', deger: 0 }
  const [tip, degerStr] = tetik.split(':')
  return { tip: tip as 'gun_kala' | 'gun_gecikme', deger: Number(degerStr) }
}

export function tetikBugunEsleseiyorMu(tetik: string, farkGun: number): boolean {
  const { tip, deger } = parseTetik(tetik)
  if (tip === 'son_gun') return farkGun === 0
  if (tip === 'gun_kala') return farkGun === deger
  return farkGun === -deger
}
