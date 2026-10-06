import { test, expect, type Page } from '@playwright/test'
import * as XLSX from 'xlsx'
import * as fs from 'node:fs'

// Excel toplu atama uçtan uca: şablon indir → doldur → yükle → önizle → uygula → sonuç + kapasite kartı.
// Dev DB'ye 2 atama yazar (operasyonel kayıt silinmez; tekrar koşumda "zaten atanmış" satırları hata/atlanır).
// Gerekli: E2E_TEST_SICILLER="SENT0003,SENT0004" (atamasız aktif personel), E2E_GUZERGAH_ID, E2E_GUZERGAH_KOD, E2E_DURAK_KOD.
const SICIL = process.env.E2E_SICIL ?? 'E2E-SERVIS'
const TC4 = process.env.E2E_TC4 ?? '4242'
const SICILLER = (process.env.E2E_TEST_SICILLER ?? '').split(',').filter(Boolean)
const GUZERGAH_ID = process.env.E2E_GUZERGAH_ID ?? ''
const GUZERGAH_KOD = process.env.E2E_GUZERGAH_KOD ?? ''
const DURAK_KOD = process.env.E2E_DURAK_KOD ?? ''
const DILIM_KOD = process.env.E2E_DILIM_KOD ?? 'SABAH_GIDIS'

async function girisYap(page: Page) {
  const csrf = await (await page.request.get('/api/auth/csrf')).json()
  await page.request.post('/api/auth/callback/bluecollar', {
    form: { csrfToken: csrf.csrfToken, employeeId: SICIL, tcLastFour: TC4, json: 'true' },
  })
}

const bugunTR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())

async function personelKarti(page: Page): Promise<number> {
  await page.goto(`/servis-yonetimi/guzergah/${GUZERGAH_ID}`)
  const kart = page.getByTestId('guzergah-kart-Personel')
  await expect(kart).toBeVisible()
  return Number((await kart.innerText()).replace(/\D/g, ''))
}

test('excel toplu atama uçtan uca + kapasite kartı', async ({ page }, testInfo) => {
  test.skip(SICILLER.length < 2 || !GUZERGAH_ID || !GUZERGAH_KOD || !DURAK_KOD, 'E2E_* ortam değişkenleri verilmedi')
  await girisYap(page)
  const once = await personelKarti(page)

  await page.goto('/servis-yonetimi/personel-atama-excel')
  // Bağlantı gerçekten indirmeye çıkar (tıklama değil, aynı href'e istek: yükleniyor katmanı düzeltmesi
  // dev sunucuya taşınana kadar tıklama sonrası ekran kilitlenir — route-change-provider.test.tsx bunu korur).
  const href = await page.getByRole('link', { name: /Şablonu indir/ }).getAttribute('href')
  const sablonRes = await page.request.get(href!)
  expect(sablonRes.status()).toBe(200)
  const sablonYolu = testInfo.outputPath('sablon.xlsx')
  fs.writeFileSync(sablonYolu, await sablonRes.body())

  const wb = XLSX.readFile(sablonYolu)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const basliklar = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })[0]
  expect(basliklar).toEqual(['Sicil No', 'Güzergâh Kodu', 'Durak Kodu', 'Sefer Dilimi Kodu(ları)', 'Başlangıç Tarihi'])
  const doldurulmus = XLSX.utils.aoa_to_sheet([basliklar, ...SICILLER.map((s) => [s, GUZERGAH_KOD, DURAK_KOD, DILIM_KOD, bugunTR()])])
  const yeni = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(yeni, doldurulmus, wb.SheetNames[0])
  const doluYol = testInfo.outputPath('dolu.xlsx')
  XLSX.writeFile(yeni, doluYol)

  await page.getByLabel('Excel dosyası').setInputFiles(doluYol)
  await page.getByRole('button', { name: /Önizle/ }).click()
  const uygula = page.getByRole('button', { name: new RegExp(`${SICILLER.length} satırı uygula`) })
  await expect(uygula).toBeEnabled()
  const [uygulaYaniti] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/personel-atama-excel/uygula')),
    uygula.click(),
  ])
  console.log('UYGULA', uygulaYaniti.status(), (await uygulaYaniti.text()).slice(0, 400))
  await expect(page.getByTestId('uygulama-ozeti')).toContainText(`${SICILLER.length} yeni atama`)

  const sonra = await personelKarti(page)
  expect(sonra).toBe(once + SICILLER.length)
})
