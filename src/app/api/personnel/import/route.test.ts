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
