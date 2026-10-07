import { test, expect } from '@playwright/test'

// Pilot dönüştürücü çıktısını toplu atama ekranında ÖNİZLER (uygulamaz — kayıt yazılmaz).
// Kişisel veri dosyası repoda değil: E2E_PILOT_DOSYA=~/pilot-veri/<önek>-atama-1.xlsx
const DOSYA = process.env.E2E_PILOT_DOSYA ?? ''
const SICIL = process.env.E2E_SICIL ?? 'E2E-SERVIS'
const TC4 = process.env.E2E_TC4 ?? '4242'

test('pilot çıktısı önizlemede hatasız okunur (uygulanmaz)', async ({ page }) => {
  test.skip(!DOSYA, 'E2E_PILOT_DOSYA verilmedi')
  const csrf = await (await page.request.get('/api/auth/csrf')).json()
  await page.request.post('/api/auth/callback/bluecollar', {
    form: { csrfToken: csrf.csrfToken, employeeId: SICIL, tcLastFour: TC4, json: 'true' },
  })
  await page.goto('/servis-yonetimi/personel-atama-excel')
  await page.getByLabel('Excel dosyası').setInputFiles(DOSYA)
  await page.getByRole('button', { name: /Önizle/ }).click()
  await expect(page.getByRole('heading', { name: /2\. Önizleme/ })).toBeVisible()
  const kartlar = await page.locator('h3').evaluateAll((hs) =>
    hs.map((h) => `${h.textContent}=${h.parentElement?.parentElement?.querySelector('p')?.textContent ?? ''}`).filter((t) => /Yeni|Değişiklik|Dilim|Değişmeyen|Kapasite|Hatalı/.test(t)))
  console.log('ONIZLEME', kartlar.join(' | '))
  // Dönüştürücü kaynaklı hata olmamalı (kod/durak/sicil/dilim tanınmalı). Yetki kaynaklı
  // "değişiklik için servis.create ve servis.passive gerekir" satırları dönüştürücüyle ilgisiz, beklenir.
  const hataMetinleri = await page.locator('tbody tr').filter({ hasText: 'Hatalı' }).allInnerTexts()
  const donusturucuHatasi = hataMetinleri.filter((t) => !/servis\.passive yetkisi gerekir/.test(t))
  console.log('YETKI_KAYNAKLI_HATA', hataMetinleri.length - donusturucuHatasi.length, 'DIGER_HATA', donusturucuHatasi.length)
  expect(donusturucuHatasi).toEqual([])
})
