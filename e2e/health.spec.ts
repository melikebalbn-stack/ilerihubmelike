import { test, expect } from '@playwright/test'

test.describe('Health Check Endpoint', () => {
  test('should return 200 status when healthy', async ({ request }) => {
    const response = await request.get('/api/health')

    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(body.status).toBe('healthy')
    expect(body.checks.database.status).toBe('up')
    expect(body.timestamp).toBeTruthy()
    expect(body.uptime).toBeGreaterThan(0)
  })

  test('should return correct response structure', async ({ request }) => {
    const response = await request.get('/api/health')
    const body = await response.json()

    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('version')
    expect(body).toHaveProperty('uptime')
    expect(body).toHaveProperty('timestamp')
    expect(body).toHaveProperty('checks')
    expect(body.checks).toHaveProperty('database')
  })

  test('should include database latency', async ({ request }) => {
    const response = await request.get('/api/health')
    const body = await response.json()

    expect(body.checks.database.latencyMs).toBeDefined()
    expect(typeof body.checks.database.latencyMs).toBe('number')
    expect(body.checks.database.latencyMs).toBeGreaterThanOrEqual(0)
  })
})
