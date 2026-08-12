import type { YillikTakvimDurum } from '@/generated/prisma'

const WORKFLOW_LOCKED_STATES = new Set<YillikTakvimDurum>(['TAMAMLANDI_ONAY_BEKLIYOR', 'ONAYLANDI'])

/** Onaya gönderilmiş veya nihai onaylanmış kaydın iş içeriği değiştirilemez. */
export function isYillikTakvimWorkflowLocked(durum: YillikTakvimDurum): boolean {
  return WORKFLOW_LOCKED_STATES.has(durum)
}
