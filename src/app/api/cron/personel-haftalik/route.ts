import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { logAuditEvent } from '@/lib/audit-log'
import { ileriHubUrl } from '@/lib/email-templates/akademi/_base'
import { getHaftalikPersonelRaporu } from '@/lib/personnel-weekly-report'
import { buildPersonnelWeeklyHtml, buildPersonnelWeeklyText } from '@/lib/email-templates/personnel-weekly'

export const dynamic = 'force-dynamic'

/**
 * Haftalık Personel Raporu — cron uç noktası.
 *
 * Zamanlama: her Pazartesi 08:00 Europe/Istanbul = 05:00 UTC
 * (bkz. scripts/cron/ilerihub-personel-haftalik.template). Kapsam: bir ÖNCEKİ
 * hafta, Pazartesi 00:00 – Pazar 23:59 TR.
 *
 * Auth: mesai performans cron'uyla aynı — x-cron-secret başlığı = CRON_SECRET.
 *
 * Parametreler:
 *   ?dryRun=1          → mail ATILMAZ; alıcılar + özet JSON döner (html=1 ile ham HTML)
 *   ?weekStart=YYYY-MM-DD → o haftayı rapor haftası kabul et (test); prod'da boş
 *   ?force=1           → aynı hafta daha önce gönderilmiş olsa da tekrar gönder
 *
 * İdempotency: aynı hafta için başarılı denetim kaydı varsa gönderim atlanır
 * (cron çift tetiklenirse ikinci mail gitmez).
 */

const AUDIT_ACTION = 'PERSONNEL_WEEKLY_REPORT_MAIL'
const AUDIT_ACTOR = 'cron:personel-haftalik'

/**
 * Alıcılar sicil numarasıyla tanımlı; e-posta ÇALIŞMA ANINDA Personnel → User
 * (AD hesabı) kaydından çözülür, elle yazılmaz. Kişi pasifse ya da AD hesabı
 * yoksa alıcı listesine girmez ve bu durum denetim kaydına yazılır.
 */
const ALICI_SICILLERI = [
  'ILR-0001', // Halit İleri
  'ILR-0002', // Gürhan Horbay
] as const
const CC_ADRESLERI = ['melih.dilben@ilerigroup.com'] as const

interface CozulenAlici { sicilNo: string; adSoyad: string; email: string | null; neden?: string }

async function alicilariCoz(): Promise<CozulenAlici[]> {
  const kisiler = await prisma.personnel.findMany({
    where: { sicilNo: { in: [...ALICI_SICILLERI] } },
    select: {
      sicilNo: true,
      adSoyad: true,
      aktif: true,
      azureAdEmail: true,
      user: { select: { email: true, isActive: true } },
    },
  })
  return ALICI_SICILLERI.map((sicil) => {
    const p = kisiler.find((k) => k.sicilNo === sicil)
    if (!p) return { sicilNo: sicil, adSoyad: '?', email: null, neden: 'Personnel kaydı yok' }
    if (!p.aktif) return { sicilNo: sicil, adSoyad: p.adSoyad, email: null, neden: 'personel pasif' }
    // Öncelik: hub kullanıcı hesabı (AD ile senkron) → Personnel.azureAdEmail.
    const email = (p.user?.isActive ? p.user.email : null) ?? p.azureAdEmail ?? null
    if (!email) return { sicilNo: sicil, adSoyad: p.adSoyad, email: null, neden: 'AD/kullanıcı e-postası yok' }
    return { sicilNo: sicil, adSoyad: p.adSoyad, email }
  })
}

function adGuzelle(adSoyad: string): string {
  // Personnel.adSoyad BÜYÜK harf tutuluyor; mail başlığında Ad Soyad biçimi.
  return adSoyad
    .toLocaleLowerCase('tr-TR')
    .split(/\s+/)
    .map((k) => k.charAt(0).toLocaleUpperCase('tr-TR') + k.slice(1))
    .join(' ')
}

async function handle(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const dryRun = searchParams.get('dryRun') === '1'
  const force = searchParams.get('force') === '1'
  const hamHtml = searchParams.get('html') === '1'
  const wsParam = searchParams.get('weekStart')

  // weekStart verilirse: o Pazartesi'nin HAFTASI raporlanır. oncekiHaftaAraligi
  // "referansın önceki haftası"nı döndürdüğü için referans = weekStart + 7 gün.
  let referans = new Date()
  if (wsParam && /^\d{4}-\d{2}-\d{2}$/.test(wsParam)) {
    referans = new Date(new Date(`${wsParam}T00:00:00.000Z`).getTime() + 7 * 86400000 + 12 * 3600000)
  }

  const veri = await getHaftalikPersonelRaporu(referans)
  const alicilar = await alicilariCoz()
  const gecerli = alicilar.filter((a): a is CozulenAlici & { email: string } => !!a.email)
  const atlanan = alicilar.filter((a) => !a.email)

  const baslik = 'Haftalık Personel Raporu'
  const konu = `${baslik} — ${veri.tarihMetni}`
  const opts = { baslik, sayfaUrl: ileriHubUrl('/personnel/reports'), bolumLimiti: 12 }
  const html = buildPersonnelWeeklyHtml(veri, opts)
  const text = buildPersonnelWeeklyText(veri, opts)

  const ozet = {
    hafta: veri.haftaAnahtari,
    tarihMetni: veri.tarihMetni,
    haftaBasi: veri.haftaBasi.toISOString(),
    haftaSonu: veri.haftaSonu.toISOString(),
    alicilar: gecerli.map((a) => ({ sicilNo: a.sicilNo, ad: adGuzelle(a.adSoyad), email: a.email })),
    atlanan: atlanan.map((a) => ({ sicilNo: a.sicilNo, ad: a.adSoyad, neden: a.neden })),
    cc: [...CC_ADRESLERI],
    kadro: veri.rapor.ozet,
    hareket: { giren: veri.girenler.length, cikan: veri.cikanlar.length },
  }

  if (dryRun) {
    if (hamHtml) return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    return NextResponse.json({ ok: true, dryRun: true, konu, ...ozet })
  }

  if (gecerli.length === 0) {
    await logAuditEvent({
      action: AUDIT_ACTION, actorId: AUDIT_ACTOR, targetType: 'PERSONNEL_WEEKLY_REPORT', targetId: veri.haftaAnahtari,
      details: { ...ozet, durum: 'ALICI_YOK' },
    })
    console.error(`[personel-haftalik] ${veri.haftaAnahtari}: çözülebilen alıcı yok`, atlanan)
    return NextResponse.json({ ok: false, ...ozet, durum: 'ALICI_YOK' }, { status: 422 })
  }

  // İdempotency: bu hafta için başarılı gönderim kaydı varsa tekrar atma.
  if (!force) {
    const onceki = await prisma.permissionAuditLog.findFirst({
      where: { action: AUDIT_ACTION, targetId: veri.haftaAnahtari, details: { path: ['durum'], equals: 'GONDERILDI' } },
      select: { id: true, createdAt: true },
    })
    if (onceki) {
      console.log(`[personel-haftalik] ${veri.haftaAnahtari}: zaten gönderilmiş (${onceki.createdAt.toISOString()}) — atlandı`)
      return NextResponse.json({ ok: true, ...ozet, durum: 'ZATEN_GONDERILDI', oncekiGonderim: onceki.createdAt })
    }
  }

  const sonuc = await sendEmail(
    gecerli.map((a) => ({ email: a.email, name: adGuzelle(a.adSoyad) })),
    konu,
    text,
    html,
    undefined,
    { cc: CC_ADRESLERI.map((email) => ({ email, name: email })) },
  )

  const durum = sonuc.success ? 'GONDERILDI' : 'HATA'
  await logAuditEvent({
    action: AUDIT_ACTION, actorId: AUDIT_ACTOR, targetType: 'PERSONNEL_WEEKLY_REPORT', targetId: veri.haftaAnahtari,
    details: { ...ozet, durum, messageId: sonuc.messageId ?? null, hata: sonuc.error ?? null, force },
  })
  console.log(`[personel-haftalik] ${veri.haftaAnahtari}: ${durum} alıcı=${gecerli.length} cc=${CC_ADRESLERI.length}${sonuc.messageId ? ' id=' + sonuc.messageId : ''}`)

  return NextResponse.json({ ok: sonuc.success, ...ozet, durum, messageId: sonuc.messageId ?? null }, { status: sonuc.success ? 200 : 502 })
}

export async function POST(req: NextRequest) { return handle(req) }
// Elle tetik / önizleme için GET de aynı koruma ile açık (curl -H "x-cron-secret: …").
export async function GET(req: NextRequest) { return handle(req) }
