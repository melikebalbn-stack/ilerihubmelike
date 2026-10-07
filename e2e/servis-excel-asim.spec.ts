import { test, expect } from '@playwright/test'
import * as XLSX from 'xlsx'

// Kapasite aşımı: araçlı güzergâha (ARAPCESME, 15 koltuk, 5 kişi dolu) 11 kişi önizlenir → aşım uyarısı çıkar,
// onay kutusu işaretlenmeden "uygula" kapalı kalır. ÖNİZLEME ONLY — kayıt yazılmaz.
// Gerekli: E2E_ASIM_SICILLER = atamasız 11+ aktif sicil (virgüllü), E2E_ASIM_GUZERGAH, E2E_ASIM_DURAK.
const SICILLER = (process.env.E2E_ASIM_SICILLER ?? '').split(',').filter(Boolean)
const GUZERGAH = process.env.E2E_ASIM_GUZERGAH ?? 'ARAPCESME'
const DURAK = process.env.E2E_ASIM_DURAK ?? 'ARAPCESME-01'
const SICIL = process.env.E2E_SICIL ?? 'E2E-SERVIS'
const TC4 = process.env.E2E_TC4 ?? '4242'

test('aşım uyarısı çıkar ve onaysız uygulanamaz', async ({ page }, testInfo) => {
  test.skip(SICILLER.length < 11, 'E2E_ASIM_SICILLER (en az 11) verilmedi')
  const csrf = await (await page.request.get('/api/auth/csrf')).json()
  await page.request.post('/api/auth/callback/bluecollar', {
    form: { csrfToken: csrf.csrfToken, employeeId: SICIL, tcLastFour: TC4, json: 'true' },
  })
  const bugun = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  const ws = XLSX.utils.aoa_to_sheet([
    ['Sicil No', 'Güzergâh Kodu', 'Durak Kodu', 'Sefer Dilimi Kodu(ları)', 'Başlangıç Tarihi'],
    ...SICILLER.map((s) => [s, GUZERGAH, DURAK, 'SABAH_GIDIS', bugun]),
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Atama')
  const yol = testInfo.outputPath('asim.xlsx')
  XLSX.writeFile(wb, yol)

  await page.goto('/servis-yonetimi/personel-atama-excel')
  await page.getByLabel('Excel dosyası').setInputFiles(yol)
  await page.getByRole('button', { name: /Önizle/ }).click()
  const uygula = page.getByRole('button', { name: new RegExp(`${SICILLER.length} satırı uygula`) })
  await expect(uygula).toBeVisible()
  await expect(uygula).toBeDisabled()
  await page.getByRole('checkbox', { name: /(aşım|asim|onay)/i }).first().check()
  await expect(uygula).toBeEnabled()
})
