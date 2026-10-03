import { NextResponse } from 'next/server'
import { excelOnizle } from '@/lib/servis-yonetimi/excel-atama'
import { excelIstegiOku, satirGorunumu } from '../_ortak'

export const dynamic = 'force-dynamic'

// dosya yükleme için view, operasyonel atama kaydı için edit — İKİSİ BİRDEN (AND)
const YETKILER = ['servis.view', 'servis.edit']

// POST .../personel-atama-excel/onizleme (multipart: dosya) — HİÇBİR KAYIT YAZMAZ.
// Özet (yeni / değişiklik / dilim ekleme / kapasite uyarısı / hatalı), satır tablosu, kapasite etkisi.
export async function POST(request: Request) {
  const girdi = await excelIstegiOku(request, YETKILER)
  if ('error' in girdi) return girdi.error
  try {
    const { _baglam, ...o } = await excelOnizle(girdi.satirlar, girdi.izinler)
    void _baglam
    return NextResponse.json({ ok: true, data: { ...o, satirlar: o.satirlar.map(satirGorunumu) } })
  } catch (err) {
    console.error('Excel atama önizleme hatası')
    void err
    return NextResponse.json({ ok: false, message: 'Önizleme hazırlanırken hata oluştu.' }, { status: 500 })
  }
}
