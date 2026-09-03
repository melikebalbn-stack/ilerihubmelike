import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { AZAMI_TOPLU_KAPANIS, ALARM_EPOSTASI, ITIRAZ_SURESI_GUN } from '@/lib/tickets/cozum'

export const dynamic = 'force-dynamic'

/**
 * IT Ticket — OTOMATİK KAPANMA (Faz 1).
 *
 * Çözüldü işaretlenmiş ve itiraz süresi dolmuş talepleri CLOSED'a çeker.
 * Aday ölçütü: status = RESOLVED VE autoCloseAt <= now().
 *
 * autoCloseAt NULL olanlar KAPSAM DIŞI — bu bilinçli: alan Faz 1'de eklendi,
 * ondan önce çözülmüş talepler (geçişte 4 kayıt) NULL doğdu ve backfill
 * yapılmadı. Onlara dokunmuyoruz; IT elle kapatır.
 *
 * GÜVENLİK AĞI: tek turda AZAMI_TOPLU_KAPANIS'ten fazla aday varsa HİÇBİRİ
 * kapatılmaz, alarm maili gider ve uç 200 döner (cron hata olarak görmesin,
 * ama log'da görünsün). Gerekçe `deaktive-ayrilan-personel` ile aynı: toplu
 * kapanma sessizce olursa fark edilmesi günler alır. Normal günlük hacim tek
 * haneli; eşiğin aşılması bir hata sinyalidir (ör. autoCloseAt'in yanlış
 * hesaplanması), meşru bir yığılma değil.
 *
 * Auth: x-cron-secret (check-sla / check-mail ile birebir aynı desen).
 * Kuru koşu: ?dryRun=1 → hiçbir şey yazılmaz, adaylar raporlanır.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1'
  const simdi = new Date()

  try {
    const adaylar = await prisma.ticket.findMany({
      where: {
        isActive: true,
        status: 'RESOLVED',
        autoCloseAt: { not: null, lte: simdi },
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        resolvedAt: true,
        autoCloseAt: true,
        requesterEmail: true,
      },
      orderBy: { autoCloseAt: 'asc' },
    })

    // ── GÜVENLİK AĞI ────────────────────────────────────────────────────
    if (adaylar.length > AZAMI_TOPLU_KAPANIS) {
      const ozet = adaylar
        .slice(0, 20)
        .map((t) => `${t.ticketNumber} — ${t.subject}`)
        .join('\n')
      console.error(
        `[ticket-otokapanma] GÜVENLİK AĞI: ${adaylar.length} aday > ${AZAMI_TOPLU_KAPANIS} — hiçbiri kapatılmadı`,
      )
      try {
        await sendEmail(
          [{ name: 'ILERIHub', email: ALARM_EPOSTASI }],
          `[ILERIHub] Ticket otomatik kapanma DURDURULDU — ${adaylar.length} aday`,
          `Otomatik kapanma turu, tek turda ${AZAMI_TOPLU_KAPANIS} sınırının üzerinde ` +
            `(${adaylar.length}) aday bulduğu için HİÇBİR talebi kapatmadı.\n\n` +
            `Bu normal bir yığılma değil, bir hata sinyali olabilir (ör. autoCloseAt ` +
            `yanlış hesaplanmış olabilir). Kontrol edilene kadar tur boşa dönmeye devam eder.\n\n` +
            `İlk ${Math.min(20, adaylar.length)} aday:\n${ozet}\n\nİleri Group`,
        )
      } catch (err) {
        console.error('[ticket-otokapanma] alarm maili gönderilemedi:', err)
      }

      return NextResponse.json({
        ok: true,
        durduruldu: true,
        sebep: `aday sayısı ${adaylar.length} > ${AZAMI_TOPLU_KAPANIS}`,
        aday: adaylar.length,
        kapatilan: 0,
        checkedAt: simdi.toISOString(),
      })
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        aday: adaylar.length,
        kapatilan: 0,
        talepler: adaylar.map((t) => ({ ticketNumber: t.ticketNumber, autoCloseAt: t.autoCloseAt })),
        checkedAt: simdi.toISOString(),
      })
    }

    const kapatilan: string[] = []
    const hatalar: string[] = []

    for (const t of adaylar) {
      try {
        // Kapanış + timeline tek işlemde. Kapanış BİLDİRİMİ GÖNDERİLMİYOR:
        // kullanıcı çözüm anında zaten "3 gün içinde itiraz edin" maili aldı;
        // sessiz kalarak onayladığı bir kapanışı ikinci kez haber vermek
        // gürültü olur. Puanlama daveti de bu yüzden burada tetiklenmiyor —
        // kullanıcı isterse talebe girip puanlar (pencere closedAt'ten işler).
        await prisma.$transaction([
          prisma.ticket.update({
            where: { id: t.id },
            data: {
              status: 'CLOSED',
              closedAt: simdi,
              autoClosed: true,
              autoCloseAt: null,
            },
          }),
          prisma.ticketTimeline.create({
            data: {
              ticketId: t.id,
              action: 'status_changed',
              description: `İtiraz süresi (${ITIRAZ_SURESI_GUN} gün) doldu, talep otomatik kapandı`,
              oldValue: 'RESOLVED',
              newValue: 'CLOSED',
              performedBy: 'system',
              performedByName: 'Sistem',
            },
          }),
        ])
        kapatilan.push(t.ticketNumber)
      } catch (err) {
        const mesaj = err instanceof Error ? err.message : String(err)
        console.error('[ticket-otokapanma]', t.ticketNumber, mesaj)
        hatalar.push(`${t.ticketNumber}: ${mesaj}`)
      }
    }

    return NextResponse.json({
      ok: true,
      aday: adaylar.length,
      kapatilan: kapatilan.length,
      talepler: kapatilan,
      ...(hatalar.length > 0 ? { hatalar } : {}),
      checkedAt: simdi.toISOString(),
    })
  } catch (error) {
    console.error('[ticket-otokapanma] tur başarısız:', error)
    return NextResponse.json({ ok: false, error: 'İşlem başarısız' }, { status: 500 })
  }
}
