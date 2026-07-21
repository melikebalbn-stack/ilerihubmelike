export const VALID_NEDEN = ['UNUTMA', 'BOZULMA', 'KAYBETME', 'VAZIFE'] as const

export type KartOkutamamaNedeni = (typeof VALID_NEDEN)[number]

export const NEDEN_LABELS: Record<KartOkutamamaNedeni, string> = {
  UNUTMA: 'Unutma',
  BOZULMA: 'Bozulma',
  KAYBETME: 'Kaybetme',
  VAZIFE: 'Vazife',
}
