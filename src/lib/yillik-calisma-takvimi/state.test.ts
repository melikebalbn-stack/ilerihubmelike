import { describe, expect, it } from 'vitest'
import { isYillikTakvimWorkflowLocked } from './state'

describe('Yıllık Takvim workflow kilidi', () => {
  it('onay bekleyen ve onaylanmış kaydı kilitler; revizyonu düzenlenebilir bırakır', () => {
    expect(isYillikTakvimWorkflowLocked('TAMAMLANDI_ONAY_BEKLIYOR')).toBe(true)
    expect(isYillikTakvimWorkflowLocked('ONAYLANDI')).toBe(true)
    expect(isYillikTakvimWorkflowLocked('REVIZYON_ISTENDI')).toBe(false)
  })
})
