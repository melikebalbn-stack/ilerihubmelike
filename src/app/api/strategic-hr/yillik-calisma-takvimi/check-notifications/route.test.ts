import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const run = vi.fn()
vi.mock('@/lib/yillik-calisma-takvimi/notifications', () => ({ runYillikTakvimNotifications: (...args: unknown[]) => run(...args) }))
import { POST } from './route'

describe('Yıllık Takvim cron endpoint', () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.CRON_SECRET = 'secret'; run.mockResolvedValue({ dryRun: true, evaluatedRecordCount: 0, candidates: [] }) })
  it('secret yok veya yanlışsa motoru çalıştırmaz', async () => {
    expect((await POST(new NextRequest('http://local/api', { method: 'POST' }))).status).toBe(401)
    expect((await POST(new NextRequest('http://local/api', { method: 'POST', headers: { 'x-cron-secret': 'wrong' } }))).status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })
  it('doğru secret ile varsayılan dry-run çalıştırır', async () => {
    expect((await POST(new NextRequest('http://local/api', { method: 'POST', headers: { 'x-cron-secret': 'secret' } }))).status).toBe(200)
    expect(run).toHaveBeenCalledWith({ dryRun: true })
  })
  it('local ortamda dryRun=false isteğini gerçek gönderime açmaz', async () => {
    await POST(new NextRequest('http://local/api?dryRun=false', { method: 'POST', headers: { 'x-cron-secret': 'secret' } }))
    expect(run).toHaveBeenCalledWith({ dryRun: true })
  })
})
