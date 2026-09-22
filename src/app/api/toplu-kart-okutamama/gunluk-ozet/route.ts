import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { renderEmail, dataTable, logoAttachments } from '@/lib/email-templates/layout'

export const dynamic = 'force-dynamic'

// Toplu Kart Okutamama — GÜNLÜK ÖZET cron (x-cron-secret; önerilen 07:30).
// Önceki günün (00:00–23:59, tarih alanı) kayıtlarını çeker; kayıt varsa
// KART_OKUTAMAMA_HR_EMAIL'e TEK özet mail atar. Kayıt yoksa mail ATMAZ.
// SMTP hatasında 500 DÖNMEZ (cron retry fırtınası olmasın) — loglanır,
// mail helper'ın kendi koruması (NOTIFY_TEST_MODE / RECIPIENT_OVERRIDE) geçerli.

interface OzetSatir {
  sicilNo: string | null
  adSoyad: string
  bolum: string | null
  girisSaati: string | null
  cikisSaati: string | null
}

// Europe/Istanbul takvim günü sınırlarını @db.Date karşılaştırması için üretir.
// tarih değerleri UTC gece-yarısı DATE olarak saklandığından, gün sınırlarını
// UTC gece-yarısı olarak kurmak doğru eşleşmeyi verir.
function oncekiGunAraligi(): { baslangic: Date; bitis: Date; etiket: string } {
  const bugunStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  const [y, m, d] = bugunStr.split('-').map(Number)
  const bugunUtc = new Date(Date.UTC(y, m - 1, d))
  const dun = new Date(bugunUtc)
  dun.setUTCDate(dun.getUTCDate() - 1)
  const etiket = new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(dun)
  return { baslangic: dun, bitis: bugunUtc, etiket }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildHtml(etiket: string, satirlar: OzetSatir[]): string {
  const { html } = renderEmail({
    module: 'İnsan Varlıkları',
    title: 'Toplu Kart Okutamama — Günlük Özet',
    subtitle: `${etiket} · ${satirlar.length} kayıt`,
    afterHtml: dataTable(
      ['Sicil No', 'Ad Soyad', 'Bölüm', 'Giriş', 'Çıkış'],
      satirlar.map((r) => [
        esc(r.sicilNo || '-'),
        esc(r.adSoyad),
        esc(r.bolum || '-'),
        esc(r.girisSaati || '-'),
        esc(r.cikisSaati || '-'),
      ]),
    ),
    width: 800,
  })
  return html
}

function buildText(etiket: string, satirlar: OzetSatir[]): string {
  const rows = satirlar
    .map((r) => `${r.sicilNo || '-'} | ${r.adSoyad} | ${r.bolum || '-'} | ${r.girisSaati || '-'} | ${r.cikisSaati || '-'}`)
    .join('\n')
  return (
    `Toplu Kart Okutamama — Günlük Özet\nTarih: ${etiket} | Toplam: ${satirlar.length} kayıt\n\n` +
    `Sicil No | Ad Soyad | Bölüm | Giriş | Çıkış\n${rows}\n`
  )
}

async function handle(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { baslangic, bitis, etiket } = oncekiGunAraligi()

    const records = await prisma.bulkCardScanFailure.findMany({
      where: { tarih: { gte: baslangic, lt: bitis } },
      include: { personnel: { select: { bolum: true } } },
      orderBy: [{ adSoyad: 'asc' }],
    })

    // Kayıt yoksa mail ATMA.
    if (records.length === 0) {
      console.log(`[kart-okutamama-ozet] ${etiket}: kayıt yok — mail atlanmadı`)
      return NextResponse.json({ sent: false, count: 0 })
    }

    const hrEmail = process.env.KART_OKUTAMAMA_HR_EMAIL
    if (!hrEmail) {
      console.warn(
        `[kart-okutamama-ozet] KART_OKUTAMAMA_HR_EMAIL tanımlı değil — ${records.length} kayıtlı özet maili atlandı (${etiket}).`
      )
      return NextResponse.json({ sent: false, reason: 'no-recipient', count: records.length })
    }

    const satirlar: OzetSatir[] = records.map((r) => ({
      sicilNo: r.sicilNo,
      adSoyad: r.adSoyad,
      bolum: r.personnel?.bolum ?? null,
      girisSaati: r.girisSaati,
      cikisSaati: r.cikisSaati,
    }))

    const subject = `Toplu Kart Okutamama Günlük Özet — ${etiket} (${records.length} kayıt)`
    const text = buildText(etiket, satirlar)
    const html = buildHtml(etiket, satirlar)

    // sendEmail içinde NOTIFY_TEST_MODE / MAIL_RECIPIENT_OVERRIDE korumaları geçerli.
    const res = await sendEmail([{ email: hrEmail, name: 'İK' }], subject, text, html, logoAttachments())

    // SMTP hatasında 500 DÖNME — cron retry fırtınasını önlemek için loglanır,
    // 200 ile { sent:false } döner. Mail helper kendi backoff/koruması ne yapıyorsa o geçerli.
    if (!res.success) {
      console.error(`[kart-okutamama-ozet] ${etiket}: mail gönderilemedi:`, res.error)
      return NextResponse.json({ sent: false, reason: 'smtp-error', count: records.length, error: res.error })
    }

    console.log(`[kart-okutamama-ozet] ${etiket}: ${records.length} kayıt → ${hrEmail} özet maili gönderildi`)
    return NextResponse.json({ sent: true, count: records.length })
  } catch (error) {
    console.error('[kart-okutamama-ozet] özet üretim hatası:', error)
    return NextResponse.json({ error: 'Özet üretilirken hata oluştu' }, { status: 500 })
  }
}

// Cron `-X POST` ile çağırır; GET de destekli (manuel/tarayıcı tetik).
export async function POST(req: NextRequest) {
  return handle(req)
}
export async function GET(req: NextRequest) {
  return handle(req)
}
