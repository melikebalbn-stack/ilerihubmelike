import { test, expect, type Page } from '@playwright/test'

// Servis Yönetimi A+B+C duman testi. Dev sandbox'a karşı koşar (E2E_BASE_URL),
// idari-isler rolündeki E2E kullanıcısı ile (mavi yaka girişi).
const SICIL = process.env.E2E_SICIL ?? 'E2E-SERVIS'
const TC4 = process.env.E2E_TC4 ?? '4242'

async function girisYap(page: Page) {
  const csrf = await (await page.request.get('/api/auth/csrf')).json()
  const res = await page.request.post('/api/auth/callback/bluecollar', {
    form: { csrfToken: csrf.csrfToken, employeeId: SICIL, tcLastFour: TC4, json: 'true' },
  })
  expect(res.status()).toBeLessThan(400)
  const oturum = await (await page.request.get('/api/auth/session')).json()
  expect(oturum?.user?.id).toBeTruthy()
}

const SAYFALAR: Array<[string, string, RegExp]> = [
  ['/servis-yonetimi', 'ana sayfa', /Servis/i],
  ['/servis-yonetimi/panel', 'panel', /Servis Paneli/],
  ['/servis-yonetimi/kapasite', 'kapasite', /Kapasite/i],
  ['/servis-yonetimi/veri-kalite', 'veri kalite', /Veri Kalite/i],
  ['/servis-yonetimi/operasyonel-servis-listesi', 'operasyonel liste', /Operasyonel/i],
  ['/servis-yonetimi/bu-ay-ne-degisti', 'bu ay ne değişti', /De[ğg]i[şs]ti/i],
  ['/servis-yonetimi/personel-atama-excel', 'excel toplu atama', /Excel.*Toplu Atama/],
]

test.describe('Servis Yönetimi duman testi', () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page)
  })

  for (const [url, ad, baslik] of SAYFALAR) {
    test(`${ad} yüklenir, hata sınırına düşmez`, async ({ page }) => {
      const hatalar: string[] = []
      page.on('pageerror', (e) => hatalar.push(e.message))
      const res = await page.goto(url)
      expect(res?.status()).toBeLessThan(400)
      await expect(page.getByText(baslik).first()).toBeVisible()
      await expect(page.getByText('Bir hata olustu')).toHaveCount(0)
      expect(hatalar).toEqual([])
    })
  }

  test('acil durum listesi KVKK anahtarı olmayan idari-isler için kapalı (negatif)', async ({ page }) => {
    await page.goto('/servis-yonetimi/acil-durum-listesi')
    await expect(page.getByText('Bu sayfayı görüntüleme yetkiniz yok.')).toBeVisible()
  })

  test('güzergâh detayına panelden gidilir', async ({ page }) => {
    await page.goto('/servis-yonetimi/panel')
    const baglanti = page.locator('a[href^="/servis-yonetimi/guzergah/"]').first()
    await expect(baglanti).toBeVisible()
    await baglanti.click()
    await expect(page).toHaveURL(/\/servis-yonetimi\/guzergah\/.+/)
    await expect(page.getByText('Bir hata olustu')).toHaveCount(0)
  })

  test('excel: şablon indirilir, dosyasız önizleme kapalı', async ({ page }) => {
    await page.goto('/servis-yonetimi/personel-atama-excel')
    await expect(page.getByRole('button', { name: /Önizle/ })).toBeDisabled()
    const sablon = page.getByRole('button', { name: /şablon/i }).or(page.getByRole('link', { name: /şablon/i })).first()
    const [indirme] = await Promise.all([page.waitForEvent('download'), sablon.click()])
    expect(indirme.suggestedFilename()).toMatch(/\.xlsx$/)
  })

  test('yetkisiz kullanıcı yönetim API\'sine yazamaz (negatif)', async ({ request }) => {
    const res = await request.post('/api/servis-yonetimi/firma', { data: { ad: 'x' } })
    expect([401, 403]).toContain(res.status())
  })
})
