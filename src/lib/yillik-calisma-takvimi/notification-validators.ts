import { z } from 'zod'
import { YillikTakvimKatilimciRol } from '@/generated/prisma'

export const BildirimTetikSchema = z.string().refine(
  value => value === 'son_gun' || /^(gun_kala|gun_gecikme):([1-9]\d{0,2})$/.test(value),
  'Geçersiz bildirim tetiği',
)
const KanalSchema = z.enum(['HUB', 'EPOSTA'])
export const BildirimKuraliCreateSchema = z.object({
  tetik: BildirimTetikSchema,
  aliciRoller: z.array(z.nativeEnum(YillikTakvimKatilimciRol)).min(1).max(7),
  kanal: z.array(KanalSchema).min(1).max(2),
  aktif: z.boolean().optional(),
}).strict()
export const BildirimKuraliUpdateSchema = BildirimKuraliCreateSchema.partial().refine(
  value => Object.keys(value).length > 0,
  'En az bir alan gönderilmelidir',
)

export function parseBildirimTetik(tetik: string) {
  if (tetik === 'son_gun') return { tip: 'son_gun' as const, gun: 0 }
  const [tip, gun] = tetik.split(':')
  return { tip: tip as 'gun_kala' | 'gun_gecikme', gun: Number(gun) }
}

export function bildirimTetigiEslesir(tetik: string, farkGun: number): boolean {
  const parsed = parseBildirimTetik(tetik)
  return parsed.tip === 'son_gun' ? farkGun === 0 : parsed.tip === 'gun_kala' ? farkGun === parsed.gun : farkGun === -parsed.gun
}
