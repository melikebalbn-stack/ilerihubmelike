import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requireSession } from '@/lib/auth/require-session'
import { canManageRma } from '@/lib/quality/rma-access'
import {
  IMPORT_COLS,
  TIP_GECERLI_DEGERLER,
  IADE_TURU_GECERLI_DEGERLER,
  KARAR_GECERLI_DEGERLER,
} from '@/lib/quality/rma-excel'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quality/rma/import-sablon — boş import şablonu (KAL-KYT-16, PR-3).
 * Auth: canManageRma. Yalnız import'ta kullanılan kolonlar + 2 örnek satır +
 * ikinci sayfada kısa açıklama.
 */
export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageRma(session)) {
    return NextResponse.json({ error: 'Şablon indirme yetkiniz yok' }, { status: 403 })
  }

  const C = IMPORT_COLS
  const ornek1: Record<string, string | number> = {
    [C.grup]: 'A',
    [C.tip]: 'RMA',
    [C.urunGelisTarihi]: '03.02.2025',
    [C.irsaliyeTarihi]: '05.02.2025',
    [C.irsaliyeNo]: 'IRS-1001',
    [C.musteriKodu]: 'MS00104',
    [C.iadeTuru]: 'Müşteri Şikayeti',
    [C.sorumluSicilNo]: '12345',
    [C.termin]: '20.02.2025',
    [C.urunKodu]: 'ABC-12',
    [C.lotNo]: 'LOT-77',
    [C.iadeMiktari]: 10,
    [C.musteriIadeSebebi]: 'Yüzey çizik',
    [C.ilkIncelemeSonucu]: 'Kozmetik hata doğrulandı',
    [C.karar]: 'Rework',
    [C.kararAciklama]: 'Yeniden işlenecek',
    [C.hurdaAdedi]: 2,
    [C.reworkAdedi]: 8,
    [C.kokNeden]: 'Taşıma hasarı',
    [C.aksiyon]: 'Ambalaj güçlendirildi',
  }
  // Aynı GRUP değeri → aynı kayıt: ikinci örnek satır, birinci ile AYNI grup (A) altında ikinci ürün satırı.
  const ornek2: Record<string, string | number> = {
    [C.grup]: 'A',
    [C.tip]: 'RMA',
    [C.urunGelisTarihi]: '03.02.2025',
    [C.irsaliyeTarihi]: '05.02.2025',
    [C.irsaliyeNo]: 'IRS-1001',
    [C.musteriKodu]: 'MS00104',
    [C.iadeTuru]: 'Müşteri Şikayeti',
    [C.sorumluSicilNo]: '12345',
    [C.termin]: '20.02.2025',
    [C.urunKodu]: 'XYZ-99',
    [C.lotNo]: '',
    [C.iadeMiktari]: 5,
    [C.musteriIadeSebebi]: 'Ölçü dışı',
    [C.ilkIncelemeSonucu]: '',
    [C.karar]: 'Hurda',
    [C.kararAciklama]: '',
    [C.hurdaAdedi]: 5,
    [C.reworkAdedi]: 0,
    [C.kokNeden]: '',
    [C.aksiyon]: '',
  }

  const headers = Object.values(C)
  const ws = XLSX.utils.json_to_sheet([ornek1, ornek2], { header: headers as string[] })
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(12, Math.min(32, h.length + 4)) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'RMA-Import')

  // İkinci sayfa — kısa açıklama.
  const aciklama = [
    ['RMA/SMA İçe Aktarma — Açıklama'],
    [''],
    ['• GRUP: Aynı GRUP değerindeki satırlar TEK kayda ait ürün satırları olur.'],
    ['  (Örnekte iki satır da "A" → tek RMA kaydı, iki ürün satırı.)'],
    ['• Zorunlu alanlar: GRUP, TİP, MÜŞTERİ KODU, ÜRÜN KODU, İADE MİKTARI (>=1), MÜŞTERİ İADE SEBEBİ.'],
    ['• MÜŞTERİ KODU: Müşteri KODU yazılır (isim değil). Kod, RMA listesinde müşteri seçicide görünür'],
    ['  (örn. MS00104). Kod sistemde kayıtlı ve aktif olmalıdır.'],
    ['• NO kolonu yazsanız bile YOK SAYILIR — numara sistemde otomatik üretilir.'],
    [`• TİP geçerli değerler: ${TIP_GECERLI_DEGERLER}.`],
    [`• İADE TÜRÜ (opsiyonel) geçerli değerler: ${IADE_TURU_GECERLI_DEGERLER}.`],
    [`• KARAR (opsiyonel) geçerli değerler: ${KARAR_GECERLI_DEGERLER}.`],
    ['• SORUMLU SİCİL NO (opsiyonel): personel sicil numarası; boş bırakılabilir.'],
    ['• HURDA ADEDİ + REWORK ADEDİ, İADE MİKTARI değerini aşamaz.'],
    ['• Tarih biçimi: GG.AA.YYYY (örn. 05.02.2025).'],
    ['• En fazla 500 satır aktarılabilir.'],
    [''],
    ['Önce "Önizle" ile kontrol edin; hata yoksa "Yükle" ile kaydedin. Hata varsa hiçbir kayıt yazılmaz.'],
  ]
  const wsAciklama = XLSX.utils.aoa_to_sheet(aciklama)
  wsAciklama['!cols'] = [{ wch: 90 }]
  XLSX.utils.book_append_sheet(wb, wsAciklama, 'Açıklama')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="RMA-Import-Sablonu.xlsx"',
    },
  })
}
