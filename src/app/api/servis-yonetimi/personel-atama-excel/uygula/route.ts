import { NextResponse } from 'next/server'
import { ExcelAtamaHatasi, excelUygula } from '@/lib/servis-yonetimi/excel-atama'
import { atamaDilimHataYaniti } from '@/lib/servis-yonetimi/atama-dilim-http'
import { AtamaDilimHatasi } from '@/lib/servis-yonetimi/kapasite-asim'
import { excelIstegiOku } from '../_ortak'

export const dynamic = 'force-dynamic'

// dosya yükleme için view, operasyonel atama kaydı için edit — İKİSİ BİRDEN (AND)
const YETKILER = ['servis.view', 'servis.edit']

// POST .../personel-atama-excel/uygula (multipart: dosya, asimOnayi, beklenenGecerli, beklenenHatali)
// Dosya YENİDEN okunup doğrulanır; yalnız geçerli satırlar TEK transaction'da uygulanır (ortak
// topluIslemId, her kayıt için ayrı tarihçe). Kapasite aşımı onaysız UYGULANMAZ (409).
export async function POST(request: Request) {
  const girdi = await excelIstegiOku(request, YETKILER)
  if ('error' in girdi) return girdi.error
  const sayi = (v: FormDataEntryValue | null) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null)
  const gecerli = sayi(girdi.form.get('beklenenGecerli'))
  const hatali = sayi(girdi.form.get('beklenenHatali'))
  try {
    const data = await excelUygula(
      girdi.satirlar,
      {
        asimOnayi: girdi.form.get('asimOnayi') === 'true',
        beklenen: gecerli !== null && hatali !== null ? { gecerli, hatali } : undefined,
      },
      girdi.userId,
      girdi.izinler,
    )
    return NextResponse.json({ ok: true, message: `${data.yeni + data.degisiklik + data.dilimEkle} satır uygulandı.`, data })
  } catch (err) {
    if (err instanceof AtamaDilimHatasi) return atamaDilimHataYaniti(err, 'Atamalar uygulanamadı.')
    if (err instanceof ExcelAtamaHatasi) return NextResponse.json({ ok: false, message: err.message }, { status: 400 })
    console.error('Excel atama uygulama hatası')
    return NextResponse.json({ ok: false, message: 'Atamalar uygulanırken hata oluştu; hiçbir kayıt yazılmadı.' }, { status: 500 })
  }
}
