import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  personnelFindUnique: vi.fn(),
  personnelUpdate: vi.fn(),
  personnelCreate: vi.fn(),
  personelFkAlanlari: vi.fn(),
  personelEklendiginde: vi.fn(),
  logAuditEvent: vi.fn(),
  xlsxRead: vi.fn(),
  xlsxSheetToJson: vi.fn(),
}))

vi.mock('@/lib/auth/require-user', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/personnel/fk-cozum', () => ({ personelFkAlanlari: mocks.personelFkAlanlari }))
vi.mock('@/lib/org/personel-koltuk-senkron', () => ({ personelEklendiginde: mocks.personelEklendiginde }))
vi.mock('@/lib/audit-log', () => ({ logAuditEvent: mocks.logAuditEvent }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    personnel: {
      findUnique: mocks.personnelFindUnique,
      update: mocks.personnelUpdate,
      create: mocks.personnelCreate,
    },
  },
}))
// XLSX'in kendi ikili (.xlsx zip) ayrıştırması bu test ortamında (jsdom +
// NextRequest.formData()'nın kendi File/ArrayBuffer realm'ı) güvenilir
// çalışmıyor — SheetJS type:'array' beklediği ArrayBuffer'ı tanımayıp ham
// baytları metin gibi okuyor (bağımsız doğrulandı, kaynak kodun HATASI
// DEĞİL). Satır ayrıştırma mantığını (route.ts'in KENDİ kodu) test etmek
// için yalnız XLSX kütüphanesi mock'lanıyor — dosya baytlarının kendisi
// önemsiz hale geliyor.
vi.mock('xlsx', () => ({
  read: mocks.xlsxRead,
  utils: { sheet_to_json: mocks.xlsxSheetToJson },
  SSF: { parse_date_code: vi.fn() },
}))

import { POST } from './route'

const TEMEL_SATIR: Record<string, unknown> = {
  'SİCİL NO': '1001',
  'ADI VE SOYADI': 'Ahmet Yılmaz',
  'CİNSİYET': 'ERKEK',
  'YAKA': 'MAVI',
  'İŞE GİRİŞ TARİHİ': '2020-01-15',
  'GÖREV': 'Operatör',
  'BÖLÜM': 'Üretim',
}

function xlsxOkumasiniKur(satirEk: Record<string, unknown>) {
  const satir = { ...TEMEL_SATIR, ...satirEk }
  mocks.xlsxRead.mockReturnValue({ SheetNames: ['Sayfa1'], Sheets: { Sayfa1: {} } })
  mocks.xlsxSheetToJson.mockImplementation((_sheet: unknown, opts: { header?: number }) => {
    if (opts?.header === 1) return [Object.keys(satir)]
    return [satir]
  })
}

function istekOlustur() {
  const file = new File(['icerik onemsiz, XLSX.read mock'], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const formData = new FormData()
  formData.append('file', file)
  return new NextRequest('http://localhost/api/personnel/import', { method: 'POST', body: formData })
}

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset())
  mocks.requireUser.mockResolvedValue({ user: { id: 'u1', email: 'hr@ilerigroup.com', role: 'ADMIN', department: null }, error: null })
  mocks.personelFkAlanlari.mockResolvedValue({})
  mocks.personelEklendiginde.mockResolvedValue(undefined)
  mocks.logAuditEvent.mockResolvedValue(undefined)
  mocks.personnelUpdate.mockResolvedValue({ id: 'p1' })
  mocks.personnelCreate.mockResolvedValue({ id: 'p1' })
})

describe('POST /api/personnel/import — ikametAdresi değişim damgası (mevcut kayıt güncellemesi)', () => {
  it('adres GERÇEKTEN değişirse ikametAdresiDegisimTarihi set edilir', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'p1', sicilNo: '1001', ikametAdresi: 'Eski Adres' })
    xlsxOkumasiniKur({ 'İKAMET ADRESİ': 'Yeni Adres' })

    const res = await POST(istekOlustur())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.errors).toEqual([])

    expect(mocks.personnelUpdate).toHaveBeenCalledTimes(1)
    const gonderilenVeri = mocks.personnelUpdate.mock.calls[0][0].data
    expect(gonderilenVeri.ikametAdresi).toBe('Yeni Adres')
    expect(gonderilenVeri.ikametAdresiDegisimTarihi).toBeInstanceOf(Date)
  })

  it('adres DEĞİŞMEDEN gelen satırda (aynı değer) damgaya DOKUNULMAZ', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'p1', sicilNo: '1001', ikametAdresi: 'Aynı Adres' })
    xlsxOkumasiniKur({ 'İKAMET ADRESİ': 'Aynı Adres' })

    const res = await POST(istekOlustur())
    expect(res.status).toBe(200)

    const gonderilenVeri = mocks.personnelUpdate.mock.calls[0][0].data
    expect(gonderilenVeri.ikametAdresiDegisimTarihi).toBeUndefined()
  })

  // 🔴 Kritik senaryo (FAZ 1C göçü): İKAMET ADRESİ sütunu bu satırda hiç
  // doldurulmamış (Excel hücresi boş → mapped.ikametAdresi === undefined).
  // Mevcut kayıtta GERÇEK bir adres varsa bu ne "değişiklik" sayılmalı ne de
  // mevcut adresi SİLMELİ — aksi halde toplu import yüzlerce kaydın adresini
  // sessizce null'lar ve sahte "değişti" damgası basar.
  it('İKAMET ADRESİ sütunu satırda hiç yoksa (boş hücre): mevcut adres SİLİNMEZ, damga SET EDİLMEZ', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'p1', sicilNo: '1001', ikametAdresi: 'Gerçek Mevcut Adres' })
    xlsxOkumasiniKur({}) // İKAMET ADRESİ sütunu YOK — TEMEL_SATIR'da da zaten tanımlı değil

    const res = await POST(istekOlustur())
    expect(res.status).toBe(200)

    expect(mocks.personnelUpdate).toHaveBeenCalledTimes(1)
    const gonderilenVeri = mocks.personnelUpdate.mock.calls[0][0].data
    expect(Object.prototype.hasOwnProperty.call(gonderilenVeri, 'ikametAdresi')).toBe(false)
    expect(gonderilenVeri.ikametAdresiDegisimTarihi).toBeUndefined()
  })

  it('YENİ kayıt oluşturmada (existing yok) damga hiç set edilmez — bu bir "değişiklik" değil', async () => {
    mocks.personnelFindUnique.mockResolvedValue(null)
    xlsxOkumasiniKur({ 'İKAMET ADRESİ': 'İlk Adres' })

    const res = await POST(istekOlustur())
    expect(res.status).toBe(200)

    expect(mocks.personnelCreate).toHaveBeenCalledTimes(1)
    expect(mocks.personnelUpdate).not.toHaveBeenCalled()
    const gonderilenVeri = mocks.personnelCreate.mock.calls[0][0].data
    expect(gonderilenVeri.ikametAdresiDegisimTarihi).toBeUndefined()
  })
})

// ----------------------------------------------------------------------------
// Melih kararı (22.09.2026): "Boş hücre = dokunma" — genel semantik, yalnız
// ikametAdresi'ne özgü değil. Farklı TİPTEN birkaç alan için ayrı ayrı
// kanıtlanıyor: opsiyonel metin, boolean, ve FK-besleyen metin alanı.
// ----------------------------------------------------------------------------
describe('POST /api/personnel/import — boş hücre = dokunma (Melih kararı, genel semantik)', () => {
  it('METİN alan (MASRAF MERKEZİ) satırda hiç yoksa: mevcut değer SİLİNMEZ (anahtar update verisinde yok)', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'p1', sicilNo: '1001', masrafMerkezi: 'MRK-100', ikametAdresi: null })
    xlsxOkumasiniKur({}) // MASRAF MERKEZİ sütunu yok

    const res = await POST(istekOlustur())
    expect(res.status).toBe(200)

    const gonderilenVeri = mocks.personnelUpdate.mock.calls[0][0].data
    expect(Object.prototype.hasOwnProperty.call(gonderilenVeri, 'masrafMerkezi')).toBe(false)
  })

  it('BOOLEAN alan (EMEKLİ) satırda hiç yoksa: mevcut true değeri false\'a SIFIRLANMAZ (anahtar update verisinde yok)', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'p1', sicilNo: '1001', emekli: true, ikametAdresi: null })
    xlsxOkumasiniKur({}) // EMEKLİ sütunu yok

    const res = await POST(istekOlustur())
    expect(res.status).toBe(200)

    const gonderilenVeri = mocks.personnelUpdate.mock.calls[0][0].data
    expect(Object.prototype.hasOwnProperty.call(gonderilenVeri, 'emekli')).toBe(false)
  })

  it('BOOLEAN alan gerçekten "EVET" ile gelirse yine set edilir (regresyon yok — pozitif senaryo)', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'p1', sicilNo: '1001', emekli: false, ikametAdresi: null })
    xlsxOkumasiniKur({ 'EMEKLİ': 'EVET' })

    const res = await POST(istekOlustur())
    expect(res.status).toBe(200)

    const gonderilenVeri = mocks.personnelUpdate.mock.calls[0][0].data
    expect(gonderilenVeri.emekli).toBe(true)
  })

  it('YENİ kayıt oluşturmada BOOLEAN alan boşsa anahtar hiç eklenmez — CREATE\'te şema varsayılanı (false) bugünkü davranışla AYNI (regresyon yok)', async () => {
    mocks.personnelFindUnique.mockResolvedValue(null)
    xlsxOkumasiniKur({})

    const res = await POST(istekOlustur())
    expect(res.status).toBe(200)

    const gonderilenVeri = mocks.personnelCreate.mock.calls[0][0].data
    expect(Object.prototype.hasOwnProperty.call(gonderilenVeri, 'emekli')).toBe(false)
  })

  it('FK besleyen metin alanı (BİRİM SORUMLUSU) satırda hiç yoksa personelFkAlanlari\'ye undefined iletilir (sorumlu1Id\'ye dokunulmaz)', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'p1', sicilNo: '1001', birimSorumlusu: 'Ayşe Kaya', ikametAdresi: null })
    xlsxOkumasiniKur({}) // BİRİM SORUMLUSU sütunu yok

    const res = await POST(istekOlustur())
    expect(res.status).toBe(200)

    const fkCagriArg = mocks.personelFkAlanlari.mock.calls[0][1]
    expect(fkCagriArg.birimSorumlusu).toBeUndefined()

    const gonderilenVeri = mocks.personnelUpdate.mock.calls[0][0].data
    expect(Object.prototype.hasOwnProperty.call(gonderilenVeri, 'birimSorumlusu')).toBe(false)
  })

  it('yanıt kullanıcıya "boş hücreler güncellenmedi" bilgisini içerir', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'p1', sicilNo: '1001', ikametAdresi: null })
    xlsxOkumasiniKur({})

    const res = await POST(istekOlustur())
    const json = await res.json()
    expect(json.bilgi).toContain('Boş bırakılan hücreler')
    expect(json.bilgi).toContain('mevcut kayıtlardaki değerleri değiştirmez')
  })
})

// ----------------------------------------------------------------------------
// Melih düzeltmesi (25.09.2026): boş hücre kuralı TEK NOKTADA.
// trim() sonrası boş kalan HER hücre = DOKUNMA. Eskiden " " ve "" metinde
// NULL, boolean'da false yazıyordu; ikisi de yanlıştı.
// ----------------------------------------------------------------------------
describe('POST /api/personnel/import — trim sonrası boş hücre = dokunma', () => {
  for (const [etiket, deger] of [['boşluk (" ")', ' '], ['boş metin ("")', ''], ['sekme ("\\t")', '\t']] as const) {
    it(`METİN alan ${etiket} ile gelirse mevcut değer KORUNUR, anahtar data'ya HİÇ eklenmez`, async () => {
      mocks.personnelFindUnique.mockResolvedValue({ id: 'p1', sicilNo: '1001', masrafMerkezi: 'MRK-100', ikametAdresi: null })
      xlsxOkumasiniKur({ 'MASRAF MERKEZİ': deger })

      const res = await POST(istekOlustur())
      expect(res.status).toBe(200)

      const veri = mocks.personnelUpdate.mock.calls[0][0].data
      expect(Object.prototype.hasOwnProperty.call(veri, 'masrafMerkezi')).toBe(false)
      expect(veri.masrafMerkezi).toBeUndefined()
    })

    it(`BOOLEAN alan ${etiket} ile gelirse mevcut true false'a SIFIRLANMAZ, anahtar data'ya HİÇ eklenmez`, async () => {
      mocks.personnelFindUnique.mockResolvedValue({ id: 'p1', sicilNo: '1001', emekli: true, ikametAdresi: null })
      xlsxOkumasiniKur({ 'EMEKLİ': deger })

      const res = await POST(istekOlustur())
      expect(res.status).toBe(200)

      const veri = mocks.personnelUpdate.mock.calls[0][0].data
      expect(Object.prototype.hasOwnProperty.call(veri, 'emekli')).toBe(false)
      expect(veri.emekli).toBeUndefined()
    })
  }

  it('DOLU hücre hâlâ yazılır ve kırpılır (regresyon yok)', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'p1', sicilNo: '1001', masrafMerkezi: 'ESKI', ikametAdresi: null })
    xlsxOkumasiniKur({ 'MASRAF MERKEZİ': '  MRK-200  ' })

    await POST(istekOlustur())
    expect(mocks.personnelUpdate.mock.calls[0][0].data.masrafMerkezi).toBe('MRK-200')
  })
})

// ----------------------------------------------------------------------------
// Melih düzeltmesi (25.09.2026): damga degisenAlanlar hesabına GİRSİN.
// Ders 76 — hem "var" hem "yok" tarafı assert ediliyor.
// ----------------------------------------------------------------------------
/** PERSONNEL_IMPORT_KAYIT izlerindeki degisenAlanlar'ı düzleştirir. */
function degisenAlanlariTopla(): string[] {
  return mocks.logAuditEvent.mock.calls
    .map(c => c[0] as { action?: string; details?: { degisenAlanlar?: string[] } })
    .filter(a => a.action === 'PERSONNEL_IMPORT_KAYIT')
    .flatMap(a => a.details?.degisenAlanlar ?? [])
}

describe('POST /api/personnel/import — damga denetim izinde (degisenAlanlar)', () => {
  it('damga ATILDIĞINDA ikametAdresiDegisimTarihi degisenAlanlar içinde VAR', async () => {
    mocks.personnelFindUnique.mockResolvedValue({
      id: 'p1', sicilNo: '1001', ikametAdresi: 'Eski Mah. 1', ikametAdresiDegisimTarihi: null,
    })
    xlsxOkumasiniKur({ 'İKAMET ADRESİ': 'Yeni Mah. 2' })

    const res = await POST(istekOlustur())
    expect(res.status).toBe(200)

    // Damga gerçekten yazıldı
    expect(mocks.personnelUpdate.mock.calls[0][0].data.ikametAdresiDegisimTarihi).toBeInstanceOf(Date)

    const iz = degisenAlanlariTopla()
    expect(iz).toContain('ikametAdresiDegisimTarihi')
  })

  it('damga ATILMADIĞINDA (adres aynı) degisenAlanlar içinde YOK', async () => {
    mocks.personnelFindUnique.mockResolvedValue({
      id: 'p1', sicilNo: '1001', ikametAdresi: 'Ayni Mah. 1', ikametAdresiDegisimTarihi: null,
    })
    xlsxOkumasiniKur({ 'İKAMET ADRESİ': 'Ayni Mah. 1' })

    const res = await POST(istekOlustur())
    expect(res.status).toBe(200)

    expect(mocks.personnelUpdate.mock.calls[0][0].data.ikametAdresiDegisimTarihi).toBeUndefined()

    const iz = degisenAlanlariTopla()
    expect(iz).not.toContain('ikametAdresiDegisimTarihi')
  })
})

// ----------------------------------------------------------------------------
// Melih düzeltmesi (25.09.2026): normalleştirme YALNIZ karşılaştırma için.
// DB'ye yazılan adres girdinin AYNISI olmalı — kırpma/büyütme uygulanmaz.
// ----------------------------------------------------------------------------
describe('POST /api/personnel/import — saklanan adres normalleştirilmez', () => {
  it('DB\'ye yazılan ikametAdresi, Excel hücresindeki değerin AYNISI (büyütülmez)', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'p1', sicilNo: '1001', ikametAdresi: 'Eski Cd. 1' })
    xlsxOkumasiniKur({ 'İKAMET ADRESİ': 'Atatürk Cd. 5' })

    await POST(istekOlustur())

    const veri = mocks.personnelUpdate.mock.calls[0][0].data
    expect(veri.ikametAdresi).toBe('Atatürk Cd. 5')
    // Karşılaştırma için kullanılan büyük harfli biçim DB'ye SIZMADI
    expect(veri.ikametAdresi).not.toBe('ATATÜRK CD. 5')
    // Gerçek değişiklik olduğu için damga da basıldı
    expect(veri.ikametAdresiDegisimTarihi).toBeInstanceOf(Date)
  })

  it('yalnız harf/boşluk farkında adres YAZILIR ama damga BASILMAZ', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'p1', sicilNo: '1001', ikametAdresi: 'Atatürk Cd. 5' })
    xlsxOkumasiniKur({ 'İKAMET ADRESİ': 'ATATÜRK  CD. 5' })

    await POST(istekOlustur())

    const veri = mocks.personnelUpdate.mock.calls[0][0].data
    expect(veri.ikametAdresi).toBe('ATATÜRK  CD. 5')
    expect(veri.ikametAdresiDegisimTarihi).toBeUndefined()
  })
})
