import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as XLSX from 'xlsx'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/audit-log', () => ({ logAuditEvent: vi.fn() }))

import {
  EXCEL_DOSYA_SINIRI_MESAJI, EXCEL_LIMITLERI as LIMITLER, EXCEL_MAKS_MB, EXCEL_SATIR_SINIRI_MESAJI,
} from './excel-atama-limitleri'
import { EXCEL_LIMITLERI as SUNUCU_LIMITLERI, SABLON_BASLIKLARI, ExcelAtamaHatasi, excelOku, sablonOlustur } from './excel-atama'

const KOK = join(__dirname, '..', '..', '..')
const oku = (g: string) => readFileSync(join(KOK, g), 'utf-8')

function xlsx(n: number): Buffer {
  const satirlar = Array.from({ length: n }, (_, i) => [`S${i}`, 'DARICA', '', 'SABAH_GIDIŞ', '2026-10-01'])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...SABLON_BASLIKLARI], ...satirlar]), 'Atama')
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer
}

describe('C5-2 — Excel satır/dosya sınırı: tek kaynak, 300 satır', () => {
  it('sınır 300 satır / 2 MB', () => {
    expect(LIMITLER).toEqual({ maksSatir: 300, maksDosyaBayt: 2 * 1024 * 1024 })
    expect(EXCEL_MAKS_MB).toBe(2)
  })

  it('🔴 sunucu sabiti, istemcinin okuduğu sabitle AYNI nesne (excel-atama.ts yeniden dışa aktarır; ikinci tanım yok)', () => {
    expect(SUNUCU_LIMITLERI).toBe(LIMITLER)
    // ikinci bir yerde sabit tanımlanmamış: sayfa ve uç iskeleti limit modülünden okur, 300/500/2*1024 yazmaz
    const sayfa = oku('src/app/(dashboard)/servis-yonetimi/personel-atama-excel/page.tsx')
    const ortak = oku('src/app/api/servis-yonetimi/personel-atama-excel/_ortak.ts')
    expect(sayfa).toContain("from '@/lib/servis-yonetimi/excel-atama-limitleri'")
    expect(ortak).toContain("from '@/lib/servis-yonetimi/excel-atama-limitleri'")
    expect(sayfa).not.toMatch(/maks\w*\s*[:=]\s*\d|\*\s*1024/i) // Tailwind sınıfları (red-300) etkilenmez
    expect(oku('src/lib/servis-yonetimi/excel-atama.ts')).not.toMatch(/maksSatir:\s*\d+/)
  })

  it('tam 300 satır kabul, 301 satır reddedilir; mesaj NET (sayı + "bölüp ayrı ayrı yükleyin")', () => {
    expect(excelOku(xlsx(300))).toHaveLength(300)
    let hata: unknown
    try { excelOku(xlsx(301)) } catch (e) { hata = e }
    expect(hata).toBeInstanceOf(ExcelAtamaHatasi)
    expect((hata as Error).message).toBe(EXCEL_SATIR_SINIRI_MESAJI)
    expect(EXCEL_SATIR_SINIRI_MESAJI).toBe('Dosyada en fazla 300 satır olabilir (başlık hariç). Dosyayı 300 satırlık parçalara bölüp ayrı ayrı yükleyin.')
  })

  it('dosya boyutu mesajı tek kaynaktan', () => {
    expect(EXCEL_DOSYA_SINIRI_MESAJI).toBe('Dosya çok büyük (en fazla 2 MB).')
    const dev = Buffer.concat([Buffer.from([0x50, 0x4b]), Buffer.alloc(LIMITLER.maksDosyaBayt)])
    expect(() => excelOku(dev)).toThrow(EXCEL_DOSYA_SINIRI_MESAJI)
  })

  it('şablon Açıklama sayfası güncel sınırı söyler', () => {
    const wb = XLSX.read(sablonOlustur({ guzergahlar: [], duraklar: [], dilimler: [] }), { type: 'buffer' })
    expect(JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets['Açıklama'], { header: 1 }))).toContain('en fazla 300 satır (başlık hariç) ve 2 MB')
  })
})
