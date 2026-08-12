import { describe, expect, it, vi } from 'vitest'
import { lockYillikTakvimParent } from './transaction'

describe('Yıllık Takvim parent lock', () => {
  it('transaction client tagged raw sorgusunu kullanır ve güncel state döndürür', async () => {
    const query = vi.fn().mockResolvedValue([{ id: 'r1', durum: 'PLANLANDI', iptalMi: false, arsivMi: false, kaynakModul: null }])
    const result = await lockYillikTakvimParent({ $queryRaw: query } as never, 'r1')
    expect(result?.id).toBe('r1'); expect(query).toHaveBeenCalledOnce()
    const [strings, value] = query.mock.calls[0]
    expect(strings.join('?')).toContain('FOR UPDATE'); expect(value).toBe('r1')
  })
})
