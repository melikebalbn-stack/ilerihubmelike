import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/email-templates/akademi/_base'
import { renderEmailHtml, logoAttachments, p, dataTable } from '@/lib/email-templates/layout'
import {
  DEACTIVATION_ABORT_LIMIT,
  adayOzet,
  deaktiveAyrilanPersonel,
} from '@/lib/offboarding/deaktive-ayrilan'
import { PASIF_KART_ABORT_LIMIT, pasifPersonelKartlariniKapat, type PasifSupurmeSonucu } from '@/lib/pdks/senkron'

export const dynamic = 'force-dynamic'

// POST /api/cron/deaktive-ayrilan-personel — ayrılmış personelin açık kalan
// portal hesaplarını kapatır. Gecelik cron (05:15), x-cron-secret korumalı
// (ipro/cron/ifs-personel-sync deseni). GET YOK — yazma yapan uç yalnız POST.
//
// Varsayılan DRY-RUN. Canlı kapatma için ?apply=1.
// Mantık src/lib/offboarding/deaktive-ayrilan.ts'te; CLI script'i de onu çağırır.
//
// MAIL (hr-data-quality deseni — söyleyecek bir şey yoksa mail ATMAZ):
//   - atlanan > 0            → İK + IT'ye liste (elle karar gerekiyor)
//   - güvenlik ağı tetiklendi → ayrı alarm maili
//   - normal kapatmalar       → yalnız log, mail yok
const HR_ALICI = 'insan.varliklari@ilerigroup.com'
const IT_ALICI = process.env.OFFBOARDING_ALERT_EMAIL || 'melih.dilben@ilerigroup.com'

const ALICILAR = [
  { email: HR_ALICI, name: 'İnsan Varlıkları' },
  { email: IT_ALICI, name: 'ILERIHub Alert' },
]

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const dryRun = req.nextUrl.searchParams.get('apply') !== '1'
    const sonuc = await deaktiveAyrilanPersonel(prisma, { dryRun })

    const etiket = sonuc.dryRun ? 'DRY-RUN' : 'APPLY'
    console.log(
      `[deaktive-ayrilan-personel] ${etiket} bulundu=${sonuc.bulundu} ` +
        `kapatildi=${sonuc.kapatildi} atlandi=${sonuc.atlananlar.length} ` +
        `abortedLimit=${sonuc.abortedLimit}`,
    )
    for (const a of sonuc.hedefler) {
      console.log(`[deaktive-ayrilan-personel] ${sonuc.dryRun ? 'kapatılacak' : 'kapatıldı'}: ${adayOzet(a)}`)
    }

    // ── Güvenlik ağı alarmı ──
    if (sonuc.abortedLimit) {
      console.error(
        `[deaktive-ayrilan-personel] GÜVENLİK AĞI: ${sonuc.hedefler.length} hesap kapatılacaktı ` +
          `(limit ${DEACTIVATION_ABORT_LIMIT}) — TÜMÜ İPTAL`,
      )
      try {
        await sendEmail(
          ALICILAR,
          'ILERIHub — ayrılan personel hesap kapatma İPTAL edildi (güvenlik ağı)',
          `Gecelik iş bu turda ${sonuc.hedefler.length} portal hesabını kapatacaktı ` +
            `(limit ${DEACTIVATION_ABORT_LIMIT}). Muhtemel hatalı toplu pasifleştirme ` +
            `(Personnel.aktif IFS personel senkronundan geliyor) — güvenlik ağı TÜM ` +
            `kapatmayı iptal etti, hiçbir hesaba dokunulmadı.\n\n` +
            `Hesaplar:\n${sonuc.hedefler.map((a) => `- ${adayOzet(a)}`).join('\n')}\n\n` +
            `Doğruysa elle koşturun: prisma/deaktive-ayrilan-personel.ts --db=ilerihub --apply`,
          renderEmailHtml({
            module: 'İnsan Varlıkları',
            title: 'Hesap kapatma iptal edildi (güvenlik ağı)',
            subtitle: `${sonuc.hedefler.length} hesap · limit ${DEACTIVATION_ABORT_LIMIT}`,
            preheader: `Ayrılan personel hesap kapatma İPTAL edildi — ${sonuc.hedefler.length} hesap`,
            bodyHtml:
              p(
                `Gecelik iş bu turda <strong>${sonuc.hedefler.length}</strong> portal hesabını kapatacaktı (limit ${DEACTIVATION_ABORT_LIMIT}). ` +
                  'Muhtemel hatalı toplu pasifleştirme (Personnel.aktif IFS personel senkronundan geliyor) — güvenlik ağı TÜM kapatmayı iptal etti, hiçbir hesaba dokunulmadı.',
              ),
            afterHtml:
              dataTable(['Hesap'], sonuc.hedefler.map((a) => [escapeHtml(adayOzet(a))])) +
              p(`Doğruysa elle koşturun: <code>prisma/deaktive-ayrilan-personel.ts --db=ilerihub --apply</code>`),
          }),
          logoAttachments(),
        )
      } catch (mailErr) {
        console.error('[deaktive-ayrilan-personel] güvenlik ağı maili gönderilemedi', mailErr)
      }
    }

    // ── Atlananlar: ayrılma sonrası girişi olanlar sessizce birikmesin ──
    if (sonuc.atlananlar.length > 0) {
      try {
        await sendEmail(
          ALICILAR,
          `ILERIHub — ayrılan personel hesabı: ${sonuc.atlananlar.length} kayıt elle karar bekliyor`,
          `Aşağıdaki hesaplar ayrılmış personele ait görünüyor ama personel PASİFE ` +
            `alındıktan SONRA giriş yapılmış. Otomatik kapatılmadılar.\n\n` +
            `Olası sebepler: ayrılma tarihi yanlış girilmiş, kişi hâlâ çalışıyor, ` +
            `ya da hesap başkası tarafından kullanılıyor.\n\n` +
            sonuc.atlananlar.map((a) => `- ${adayOzet(a)}`).join('\n'),
          renderEmailHtml({
            module: 'İnsan Varlıkları',
            title: 'Ayrılan personel hesabı: elle karar bekliyor',
            subtitle: `${sonuc.atlananlar.length} kayıt`,
            preheader: `${sonuc.atlananlar.length} ayrılan personel hesabı elle karar bekliyor`,
            bodyHtml:
              p(
                'Aşağıdaki hesaplar ayrılmış personele ait görünüyor ama personel PASİFE alındıktan SONRA giriş yapılmış. Otomatik kapatılmadılar.',
              ) +
              p(
                'Olası sebepler: ayrılma tarihi yanlış girilmiş, kişi hâlâ çalışıyor, ya da hesap başkası tarafından kullanılıyor.',
              ),
            afterHtml: dataTable(['Hesap'], sonuc.atlananlar.map((a) => [escapeHtml(adayOzet(a))])),
          }),
          logoAttachments(),
        )
      } catch (mailErr) {
        console.error('[deaktive-ayrilan-personel] atlanan listesi maili gönderilemedi', mailErr)
      }
    }

    // ── PDKS kancası (2026-09-26): pasif personelin AKTİF geçiş kartları PASİF + panelden
    //    SILINECEK. Aynı dry-run/apply bayrağına uyar; kendi güvenlik ağı var (limit
    //    PASIF_KART_ABORT_LIMIT). Hesap kapatmadan BAĞIMSIZ — biri hata verse diğeri sürer.
    let pdksKart: PasifSupurmeSonucu | { hata: string }
    try {
      pdksKart = await pasifPersonelKartlariniKapat(prisma, { dryRun })
      console.log(
        `[deaktive-ayrilan-personel] PDKS kart ${dryRun ? 'DRY-RUN' : 'APPLY'} adet=${pdksKart.adet} ` +
          `abortedLimit=${pdksKart.abortedLimit}${pdksKart.adet ? ` siciller=${pdksKart.siciller.join(',')}` : ''}`,
      )
      if (pdksKart.abortedLimit) {
        console.error(
          `[deaktive-ayrilan-personel] PDKS GÜVENLİK AĞI: ${pdksKart.adet} kart kapatılacaktı (limit ${PASIF_KART_ABORT_LIMIT}) — TÜMÜ İPTAL`,
        )
      }
    } catch (kartErr) {
      console.error('[deaktive-ayrilan-personel] PDKS kart süpürmesi hata', kartErr)
      pdksKart = { hata: (kartErr as Error)?.message ?? 'pdks kart hata' }
    }

    return NextResponse.json({
      pdksKart,
      ok: !sonuc.abortedLimit,
      dryRun: sonuc.dryRun,
      bulundu: sonuc.bulundu,
      kapatildi: sonuc.kapatildi,
      atlandi: sonuc.atlananlar.length,
      abortedLimit: sonuc.abortedLimit,
      ...(sonuc.abortedLimit
        ? { sebep: `güvenlik ağı: ${sonuc.hedefler.length} > limit ${DEACTIVATION_ABORT_LIMIT}` }
        : {}),
    })
  } catch (e) {
    console.error('[deaktive-ayrilan-personel] cron hata', e)
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message ?? 'cron hata' },
      { status: 500 },
    )
  }
}
