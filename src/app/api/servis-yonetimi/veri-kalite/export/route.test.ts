import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  personnelFindMany: vi.fn(),
  personelAtamaFindMany: vi.fn(),
  personelAtamaGroupBy: vi.fn(),
  guzergahFindMany: vi.fn(),
  seferDilimiFindMany: vi.fn(),
  aracVarsayilanFindMany: vi.fn(),
  soforVarsayilanFindMany: vi.fn(),
  atamaDilimFindMany: vi.fn(),
  aracFindMany: vi.fn(),
  soforFindMany: vi.fn(),
  durakFindMany: vi.fn(),
  guzergahDurakSaatFindMany: vi.fn(),
}))

// 🔴 require-permission MOCK'LANMIYOR — GERÇEK requireAllPermissions koşsun ki
// AND mantığı fiilen kanıtlansın. Dizili requirePermission OR'dur; guard'ı
// mock'lasaydık "yalnız servis.view ile 403" testi OR tuzağını YAKALAYAMAZDI.
// Bunun yerine bir alt katman (oturum + kullanıcı izinleri) mock'lanıyor.
vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('@/lib/auth/get-user-permissions', () => ({ getUserPermissions: mocks.getUserPermissions }))

// veri-kalite.ts ve veri-kalite-excel.ts MOCK'LANMIYOR — gerçek sorgu
// katmanı ve gerçek xlsx baytları üretilsin (mevcut route.test.ts deseni).
vi.mock('@/lib/prisma', () => ({
  prisma: {
    personnel: { findMany: mocks.personnelFindMany },
    servisPersonelAtama: { findMany: mocks.personelAtamaFindMany, groupBy: mocks.personelAtamaGroupBy },
    servisGuzergah: { findMany: mocks.guzergahFindMany },
    servisSeferDilimi: { findMany: mocks.seferDilimiFindMany },
    servisGuzergahAracVarsayilan: { findMany: mocks.aracVarsayilanFindMany },
    servisGuzergahSoforVarsayilan: { findMany: mocks.soforVarsayilanFindMany },
    servisPersonelAtamaDilim: { findMany: mocks.atamaDilimFindMany },
    servisArac: { findMany: mocks.aracFindMany },
    servisSofor: { findMany: mocks.soforFindMany },
    servisDurak: { findMany: mocks.durakFindMany },
    servisGuzergahDurakSaat: { findMany: mocks.guzergahDurakSaatFindMany },
  },
}))

import { GET } from './route'
import { GET as EKRAN_GET } from '../route'
import { veriKaliteRaporuGetir } from '@/lib/servis-yonetimi/veri-kalite'
import {
  raporSiraliOlustur,
  VARDIYA_UYUMSUZLUGU,
  ADRES_DEGISMIS,
  KAPASITE_ASIMI,
} from '../_rapor-duzeni'

function oturumKur(izinler: string[] | null) {
  if (izinler === null) {
    mocks.getServerSession.mockResolvedValue(null)
    return
  }
  mocks.getServerSession.mockResolvedValue({ user: { id: 'u1' } })
  mocks.getUserPermissions.mockResolvedValue(new Set(izinler))
}

function tumKontrolleriBosSonuclaKur() {
  mocks.personnelFindMany.mockResolvedValue([])
  mocks.personelAtamaFindMany.mockResolvedValue([])
  mocks.personelAtamaGroupBy.mockResolvedValue([])
  mocks.guzergahFindMany.mockResolvedValue([])
  mocks.seferDilimiFindMany.mockResolvedValue([])
  mocks.aracVarsayilanFindMany.mockResolvedValue([])
  mocks.soforVarsayilanFindMany.mockResolvedValue([])
  mocks.atamaDilimFindMany.mockResolvedValue([])
  mocks.aracFindMany.mockResolvedValue([])
  mocks.soforFindMany.mockResolvedValue([])
  mocks.durakFindMany.mockResolvedValue([])
  mocks.guzergahDurakSaatFindMany.mockResolvedValue([])
}

/** Ekranın KAYIT_LIMIT'inin (200) ÜSTÜNDE veri üreten kurulum. */
const COK_KAYIT = 250
function cokKayitliKontrolKur() {
  tumKontrolleriBosSonuclaKur()
  // madde 1 (aktif-personel-servis-yok) prisma.personnel.findMany kullanıyor.
  mocks.personnelFindMany.mockResolvedValue(
    Array.from({ length: COK_KAYIT }, (_, i) => ({
      id: `p${i}`, sicilNo: String(i), adSoyad: `Personel ${i}`, bolum: 'Üretim',
    })),
  )
}

async function wbOku(res: Response) {
  const buf = Buffer.from(await res.arrayBuffer())
  return { buf, wb: XLSX.read(buf, { type: 'buffer' }) }
}

function sayfaSatirlari(wb: XLSX.WorkBook, ad: string): unknown[][] {
  return XLSX.utils.sheet_to_json(wb.Sheets[ad], { header: 1, defval: '', raw: true }) as unknown[][]
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ----------------------------------------------------------------------------
// 🔴 Yetki — GERÇEK requireAllPermissions (AND), Ders 55
// ----------------------------------------------------------------------------
describe('GET .../veri-kalite/export — yetkilendirme (AND)', () => {
  it('servis.view VE servis.export birlikte varsa 200 döner', async () => {
    oturumKur(['servis.view', 'servis.export'])
    tumKontrolleriBosSonuclaKur()
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('🔴 YALNIZ servis.view varsa 403 (OR olsaydı 200 dönerdi)', async () => {
    oturumKur(['servis.view'])
    tumKontrolleriBosSonuclaKur()
    const res = await GET()
    expect(res.status).toBe(403)
    // Hiçbir sorgu çalışmamalı — yetki reddi veriye dokunmadan önce.
    expect(mocks.personnelFindMany).not.toHaveBeenCalled()
  })

  it('🔴 YALNIZ servis.export varsa 403 (AND iki yönlü)', async () => {
    oturumKur(['servis.export'])
    tumKontrolleriBosSonuclaKur()
    const res = await GET()
    expect(res.status).toBe(403)
    expect(mocks.personnelFindMany).not.toHaveBeenCalled()
  })

  it('oturum yoksa 401 döner', async () => {
    oturumKur(null)
    tumKontrolleriBosSonuclaKur()
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mocks.personnelFindMany).not.toHaveBeenCalled()
  })
})

// ----------------------------------------------------------------------------
// Dosya
// ----------------------------------------------------------------------------
describe('GET .../veri-kalite/export — dosya', () => {
  beforeEach(() => oturumKur(['servis.view', 'servis.export']))

  it('xlsx MIME tipi ve gerçek xlsx baytları döner', async () => {
    tumKontrolleriBosSonuclaKur()
    const res = await GET()

    expect(res.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    const { buf, wb } = await wbOku(res)
    expect(buf.length).toBeGreaterThan(0)
    // xlsx = zip, "PK" magic byte
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK')
    expect(wb.SheetNames[0]).toBe('Özet')
  })

  it('🔴 Content-Disposition dosya adı SALT ASCII (Türkçe karakter yok)', async () => {
    tumKontrolleriBosSonuclaKur()
    const res = await GET()

    const cd = res.headers.get('content-disposition')!
    expect(cd).toContain('attachment;')
    // eslint-disable-next-line no-control-regex
    expect(cd).toMatch(/^[\x00-\x7F]*$/)
    expect(cd).toMatch(/filename="[A-Za-z0-9._-]+\.xlsx"/)
    expect(cd).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it("Özet'te 16 satır bulunur (13 kontrol + 3 yer tutucu)", async () => {
    tumKontrolleriBosSonuclaKur()
    const { wb } = await wbOku(await GET())
    const satirlar = sayfaSatirlari(wb, 'Özet')
    expect(satirlar).toHaveLength(17) // 1 başlık + 16
  })
})

// ----------------------------------------------------------------------------
// 🔴 KIRPMA SIZMASI — davranışsal koruma (madde 62 sessizce eksik çıkmasın)
// ----------------------------------------------------------------------------
describe('GET .../veri-kalite/export — kırpma YOK', () => {
  it(`export ${COK_KAYIT} kaydın HEPSİNİ yazar (200'e kesilmez)`, async () => {
    oturumKur(['servis.view', 'servis.export'])
    cokKayitliKontrolKur()

    const { wb } = await wbOku(await GET())
    const satirlar = sayfaSatirlari(wb, 'Personel Var Servis Yok')

    expect(satirlar).toHaveLength(COK_KAYIT + 1) // başlık + 250
    expect(satirlar.length - 1).toBeGreaterThan(200)

    // Son kayıt gerçekten dosyada — 200'den sonrası düşmemiş.
    const adSutunu = (satirlar[0] as string[]).indexOf('Ad Soyad')
    expect(satirlar[COK_KAYIT][adSutunu]).toBe(`Personel ${COK_KAYIT - 1}`)

    // Özet'te KIRPILDI YAZMAZ — dosya tam.
    const ozet = sayfaSatirlari(wb, 'Özet').find(s => s[0] === 'aktif-personel-servis-yok')!
    expect(ozet[4]).not.toBe('KIRPILDI')
  })

  it('AYNI kurguda EKRAN ucu HÂLÂ 200 kayda kırpar — iki ucun farkı bilinçli', async () => {
    oturumKur(['servis.view', 'servis.export'])
    cokKayitliKontrolKur()

    const res = await EKRAN_GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    const satir = json.data.find((s: { kod: string }) => s.kod === 'aktif-personel-servis-yok')

    expect(satir.kayitlar).toHaveLength(200) // ekran kırpıyor
    expect(satir.kirpildi).toBe(true)
    expect(satir.adet).toBe(COK_KAYIT) // gerçek toplam korunuyor
  })
})

// ----------------------------------------------------------------------------
// 🔴 E1 — SÜRÜKLENME TESTİ. Kod listesi ELLE YAZILMAZ; iki kaynaktan türetilir.
// 14. kontrol eklenip düzene girmezse bu test PATLAR.
// ----------------------------------------------------------------------------
describe('sürüklenme koruması — düzen ile kontrol kümesi birebir', () => {
  it('_rapor-duzeni.ts kod kümesi == veriKaliteRaporuGetir() kodları + 3 yer tutucu', async () => {
    tumKontrolleriBosSonuclaKur()

    // Kaynak 1: veri-kalite.ts'in KENDİ KONTROLLER tanımı (çalıştırarak türetildi;
    // KONTROLLER export edilmiyor, bu yüzden fonksiyonun çıktısından okunuyor).
    const rapor = await veriKaliteRaporuGetir()
    const kontrolKodlari = rapor.map(r => r.kod)

    // Kaynak 2: ortak düzen dosyası
    const duzenKodlari = raporSiraliOlustur(rapor).map(s => s.kod)

    const yerTutucuKodlari = [VARDIYA_UYUMSUZLUGU, ADRES_DEGISMIS, KAPASITE_ASIMI].map(y => y.kod)

    expect(new Set(duzenKodlari)).toEqual(new Set([...kontrolKodlari, ...yerTutucuKodlari]))
    expect(duzenKodlari).toHaveLength(kontrolKodlari.length + yerTutucuKodlari.length)
    // Hiçbir kod iki kez geçmiyor
    expect(new Set(duzenKodlari).size).toBe(duzenKodlari.length)
  })

  it('Excel dosyasının Özet sayfası da AYNI kod kümesini taşır (ne eksik ne fazla)', async () => {
    oturumKur(['servis.view', 'servis.export'])
    tumKontrolleriBosSonuclaKur()

    const rapor = await veriKaliteRaporuGetir()
    const beklenen = new Set(raporSiraliOlustur(rapor).map(s => s.kod))

    const { wb } = await wbOku(await GET())
    const dosyadaki = new Set(sayfaSatirlari(wb, 'Özet').slice(1).map(s => String(s[0])))

    expect(dosyadaki).toEqual(beklenen)
  })
})
