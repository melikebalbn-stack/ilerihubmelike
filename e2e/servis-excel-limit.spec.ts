import { test, expect, type Page } from '@playwright/test'
import * as XLSX from 'xlsx'

// Excel toplu atama: 300 satır kabul + önizleme süresi, 301 satır net ret.
// Dev DB'de güzergâh yok → satırlar hata satırı çıkar; ölçülen şey sınır ve süredir.
const SICIL = process.env.E2E_SICIL ?? 'E2E-SERVIS'
const TC4 = process.env.E2E_TC4 ?? '4242'
const SURE_SINIRI_MS = 30_000

async function girisYap(page: Page) {
  const csrf = await (await page.request.get('/api/auth/csrf')).json()
  await page.request.post('/api/auth/callback/bluecollar', {
    form: { csrfToken: csrf.csrfToken, employeeId: SICIL, tcLastFour: TC4, json: 'true' },
  })
}

function xlsxTamponu(satir: number): Buffer {
  const veri: string[][] = [['Sicil No', 'Güzergâh Kodu', 'Durak Kodu', 'Sefer Dilimi Kodu(ları)', 'Başlangıç Tarihi']]
  for (let i = 0; i < satir; i++) veri.push([`YOK-${i}`, 'YOK', 'YOK-1', 'YOK', '2026-10-06'])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(veri), 'Atama')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

const dosya = (n: number) => ({
  name: `atama-${n}.xlsx`,
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer: xlsxTamponu(n),
})

test.describe('Excel toplu atama sınırları', () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page)
    await page.goto('/servis-yonetimi/personel-atama-excel')
    await expect(page.getByRole('heading', { name: /Toplu Atama/ })).toBeVisible()
  })

  test('300 satır önizlenir ve süre ölçülür', async ({ page }) => {
    await page.getByLabel('Excel dosyası').setInputFiles(dosya(300))
    const t0 = Date.now()
    await page.getByRole('button', { name: /Önizle/ }).click()
    await expect(page.getByRole('button', { name: /satırı uygula/ })).toBeVisible()
    const sure = Date.now() - t0
    console.log(`SURE_300_SATIR_ONIZLEME_MS=${sure}`)
    expect(sure).toBeLessThan(SURE_SINIRI_MS)
    await expect(page.getByText('Bir hata olustu')).toHaveCount(0)
  })

  test('301 satır reddedilir, mesaj bölüp yüklemeyi söyler', async ({ page }) => {
    await page.getByLabel('Excel dosyası').setInputFiles(dosya(301))
    await page.getByRole('button', { name: /Önizle/ }).click()
    await expect(page.getByText(/300/).and(page.getByText(/böl/i)).first()).toBeVisible()
  })
})
