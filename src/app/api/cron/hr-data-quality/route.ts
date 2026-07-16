import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { runHrDataQualityAudit } from '@/lib/hr-data-quality'
import { buildHrDataQualityMailHtml, buildHrDataQualityMailText } from '@/lib/email-templates/hr-data-quality'

export const dynamic = 'force-dynamic'

// Haftalık İK veri kalitesi denetimi (Pazartesi 09:00 cron, x-cron-secret).
// SORUN VARSA insan.varliklari@ilerigroup.com'a HTML tablolu mail; sorun yoksa mail ATMAZ.
// NOT: alıcı NOKTALI (insan.varliklari@) — vardiya servis mailindeki insanvarliklari@'dan FARKLI.
const HR_ALICI = 'insan.varliklari@ilerigroup.com'

async function handle(req: NextRequest) {
  // Cron guard (perf-daily deseni)
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { kategoriler, toplamSorun } = await runHrDataQualityAudit()

    // Sorun yoksa mail ATMA
    if (toplamSorun === 0) {
      console.log('[hr-data-quality] sorun yok — mail atlanmadı')
      return NextResponse.json({ ok: true, sorun: 0, kategori: 0, mailAtildi: false })
    }

    const tarih = new Date().toLocaleDateString('tr-TR', {
      day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul',
    })
    const subject = `Personel Veri Kalitesi Raporu — ${tarih}`
    const html = buildHrDataQualityMailHtml(kategoriler)
    const text = buildHrDataQualityMailText(kategoriler)

    // sendEmail içinde MAIL_RECIPIENT_OVERRIDE guard'ı var (staging'de override, prod'da gerçek İK).
    const res = await sendEmail([{ email: HR_ALICI, name: 'İnsan Varlıkları' }], subject, text, html)
    if (!res.success) {
      console.error('[hr-data-quality] mail gönderilemedi:', res.error)
      return NextResponse.json({ ok: false, sorun: toplamSorun, kategori: kategoriler.length, mailAtildi: false, error: res.error }, { status: 500 })
    }

    console.log(`[hr-data-quality] ${toplamSorun} sorun / ${kategoriler.length} kategori → ${HR_ALICI} mail gönderildi`)
    return NextResponse.json({ ok: true, sorun: toplamSorun, kategori: kategoriler.length, mailAtildi: true })
  } catch (error) {
    console.error('[hr-data-quality] denetim hatası:', error)
    return NextResponse.json({ error: 'Denetim sırasında hata oluştu' }, { status: 500 })
  }
}

// Cron `-sX POST` ile çağırır; GET de destekli (manuel/tarayıcı tetik).
export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest) { return handle(req) }
