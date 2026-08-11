import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requireSession } from '@/lib/auth/require-session'
import { canManageUygunsuzluk } from '@/lib/quality/uygunsuzluk-access'
import {
  IMPORT_COLS,
  MAX_SATIR,
  KARAR_GECERLI_DEGERLER,
} from '@/lib/quality/uygunsuzluk-excel'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quality/uygunsuzluk/import-sablon — boş import şablonu (.xlsx).
 * Auth: canManageUygunsuzluk. Yalnız import'ta kullanılan kolonlar + 2 örnek satır +
 * ayrı "Açıklama" sayfası.
 */
export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageUygunsuzluk(session)) {
    return NextResponse.json({ error: 'Şablon indirme yetkiniz yok' }, { status: 403 })
  }

  const C = IMPORT_COLS
  const headers = Object.values(C)

  // İki örnek satır AYNI üçlüyü paylaşıyor → tek başlık, iki satır olur.
  const ornek1: Record<string, string | number> = {
    [C.tarih]: '10.08.2026',
    [C.mamulUrunKodu]: 'MAM-001',
    [C.yariMamulKodu]: 'YM-101',
    [C.malzemeAdi]: 'Gövde sacı',
    [C.isEmriNo]: '2191753',
    [C.isEmriAdeti]: 500,
    [C.redAdeti]: 12,
    [C.reworkAdedi]: 4,
    [C.tespitEdenBolum]: 1050,
    [C.olusanBolum]: 450,
    [C.hataKodu]: 474,
    [C.hataDetayi]: 'Büküm açısı toleransı aşıldı',
    [C.karar]: 'Tamir',
    [C.kokNeden]: 'Kalıp ayarı kaymış',
    [C.duzelticiFaaliyet]: 'Kalıp yeniden ayarlandı, ilk parça onayı eklendi',
    [C.sorumlu]: '1234',
    [C.termin]: '20.08.2026',
    [C.kapanisTarihi]: '',
  }
  const ornek2: Record<string, string | number> = {
    [C.tarih]: '10.08.2026',
    [C.mamulUrunKodu]: 'MAM-001',
    [C.yariMamulKodu]: 'YM-102',
    [C.malzemeAdi]: 'Kapak',
    [C.isEmriNo]: '2191753',
    [C.isEmriAdeti]: 500,
    [C.redAdeti]: 3,
    [C.reworkAdedi]: '',
    [C.tespitEdenBolum]: 1050,
    [C.olusanBolum]: 500,
    [C.hataKodu]: 512,
    [C.hataDetayi]: 'Kaynak boyu kısa',
    [C.karar]: 'Hurda',
    [C.kokNeden]: '',
    [C.duzelticiFaaliyet]: '',
    [C.sorumlu]: '',
    [C.termin]: '',
    [C.kapanisTarihi]: '',
  }
  const ws = XLSX.utils.json_to_sheet([ornek1, ornek2], { header: headers as string[] })
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(12, Math.min(34, String(h).length + 4)) }))

  const aciklama = [
    ['UYGUNSUZLUK İÇE AKTARIM — AÇIKLAMA'],
    [''],
    ['GENEL'],
    ['• Başlık satırı ZORUNLU. Kolon sırası önemsiz, isimle eşleşir.'],
    ['• Birden çok sekme varsa: adı salt rakam olan sekme (ör. "2026") okunur;'],
    ['  yoksa ilk sekme. Belirli bir sekme için ?sayfa=<ad> kullanılabilir.'],
    [`• Tek dosyada en fazla ${MAX_SATIR} satır aktarılabilir.`],
    ['• Aktarım YALNIZ EKLER; mevcut kaydı güncellemez, silmez.'],
    ['• Önizlemede hata çıkarsa hiçbir şey yazılmaz; tek bir hata bile aktarımı durdurur.'],
    [''],
    ['BAŞLIK GRUPLAMA — ÖNEMLİ'],
    ['• GRUP kolonu YOKTUR. Aynı TARİH + İŞ EMRİ NO + MAMUL ÜRÜN KODU üçlüsüne sahip'],
    ['  satırlar TEK bir uygunsuzluk kaydına toplanır; her satır o kaydın ürün satırı olur.'],
    ['• Örnek: 2191753 iş emri beş satırda tekrar ediyorsa, beş ayrı kayıt değil,'],
    ['  beş satırlı TEK kayıt oluşur.'],
    ['• Satırların alt alta olması GEREKMEZ — aynı iş emri dosyanın herhangi bir'],
    ['  yerinde olabilir, hepsi aynı kayda toplanır.'],
    ['• Başlık alanları (KÖK NEDEN, DÜZELTİCİ FAALİYET, SORUMLU, TERMİN,'],
    ['  KAPANIŞ TARİHİ, İŞ EMRİ ADETİ, TESPİT EDEN BÖLÜM) aynı gruptaki satırlarda'],
    ['  farklı doldurulmuşsa İLK satırdaki değer kullanılır; fark önizlemede UYARI'],
    ['  olarak listelenir (hata değildir, aktarımı durdurmaz).'],
    [''],
    ['BÖLÜM VE HATA KODU SÜTUNLARI'],
    ['• TESPİT EDEN BÖLÜM ve HATANIN OLUŞTUĞU BÖLÜM: KOD ya da AD yazılabilir.'],
    ['  Örn. 450 ya da "Pres" — ikisi de kabul edilir.'],
    ['• HATA KODU: yalnız KOD yazılır (ad kabul edilmez), ve bir hata kodu olmalıdır'],
    ['  — bölüm kodu yazılırsa hata verir.'],
    ['• Karşılığı bulunamayan ya da türü uymayan değer, o satır için hata üretir.'],
    [''],
    ['KARAR'],
    [`• Geçerli değerler: ${KARAR_GECERLI_DEGERLER}`],
    ['• Boş bırakılabilir.'],
    [''],
    ['TARİH FORMATLARI'],
    ['• Kabul edilen: Excel tarih hücresi, GG.AA.YYYY, GG/AA/YYYY, YYYY-AA-GG (ISO).'],
    ['• TARİH zorunlu; TERMİN ve KAPANIŞ TARİHİ boş bırakılabilir.'],
    [''],
    ['ZORUNLU ALANLAR'],
    ['• TARİH, MAMUL ÜRÜN KODU, İŞ EMRİ NO, RED ADETİ (≥ 1).'],
    ['• REWORK ADEDİ, RED ADETİ değerini aşamaz.'],
    [''],
    ['SORUMLU'],
    ['• SORUMLU sütununa sicil numarası YA DA ad soyad yazılabilir.'],
    ['• Karşılığı bulunamazsa hata üretir; boş bırakılabilir.'],
    [''],
    ['RED ORANI'],
    ['• Şablonda YOKTUR — sistem hesaplar (red adeti / iş emri adeti).'],
    ['• İş emri adeti boşsa oran gösterilmez.'],
  ]
  const wsAciklama = XLSX.utils.aoa_to_sheet(aciklama)
  wsAciklama['!cols'] = [{ wch: 88 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Uygunsuzluk-Import')
  XLSX.utils.book_append_sheet(wb, wsAciklama, 'Açıklama')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Uygunsuzluk-Import-Sablon.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
