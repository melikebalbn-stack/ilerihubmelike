/**
 * Toplantı bildirim mailleri — ÖNİZLEME üretici / test göndericisi.
 *
 * Gövdeler kullanıcıya gidenle BİREBİR AYNI: içerik üreticileri
 * (davetIcerigi / kararIcerigi / ozetIcerigi / gecikmeIcerigi) doğrudan
 * çağrılır, kopya şablon YOKTUR. Gönderim fonksiyonları (…Gonder) ÇAĞRILMAZ —
 * bu yüzden gerçek katılımcılara hiçbir şey gitmez, in-app bildirim de oluşmaz.
 *
 *   npx tsx scripts/toplanti-bildirim-onizleme.ts <TPL-NO>            → yalnız HTML
 *   npx tsx scripts/toplanti-bildirim-onizleme.ts <TPL-NO> --gonder <e-posta>
 *
 * KVKK: çıktı HTML'i kişi adı içerir → <repo>/uploads/ altına, 600 hakla.
 */
import 'dotenv/config'
import { chmodSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'

const CIKTI_DIZIN = path.join(process.cwd(), 'uploads', 'toplanti-bildirim-onizleme')

async function main() {
  const args = process.argv.slice(2)
  const tplNo = args[0]
  if (!tplNo || !tplNo.startsWith('TPL-')) {
    console.error('Kullanım: npx tsx scripts/toplanti-bildirim-onizleme.ts <TPL-2026-0007> [--gonder <e-posta>]')
    process.exit(1)
  }
  const gonderIdx = args.indexOf('--gonder')
  const hedef = gonderIdx >= 0 ? args[gonderIdx + 1] : null
  if (gonderIdx >= 0 && (!hedef || !hedef.includes('@'))) {
    console.error('--gonder için hedef e-posta adresi gerekli.')
    process.exit(1)
  }

  // Env'e YÜKLEME ANINDA bakan modüller dinamik alınır (prisma Pool, mail taşıyıcı).
  const { prisma } = await import('../src/lib/prisma')
  const bildirim = await import('../src/lib/meetings/toplanti-bildirim')
  const { sendEmail } = await import('../src/lib/email')
  const { logoAttachments } = await import('../src/lib/email-templates/layout')

  const m = await prisma.meeting.findFirst({
    where: { meetingNumber: tplNo },
    select: {
      id: true, meetingNumber: true, title: true, status: true,
      _count: { select: { attendees: true, agendaItems: true, decisions: true } },
      decisions: { orderBy: { decisionNumber: 'asc' }, take: 1, select: { id: true, decisionNumber: true, title: true, dueDate: true, priority: true } },
    },
  })
  if (!m) { console.error(`${tplNo} bulunamadı.`); process.exit(1) }

  console.log('Toplantı :', `${m.meetingNumber} · ${m.title} (${m.status})`)
  console.log('Kapsam   :', `${m._count.attendees} katılımcı · ${m._count.agendaItems} gündem · ${m._count.decisions} karar`)

  const ilkKarar = m.decisions[0]
  if (!ilkKarar) { console.error('Toplantıda karar yok — karar/gecikme önizlemesi üretilemez.'); process.exit(1) }

  const link = `${process.env.NEXTAUTH_URL || 'https://hub.ilerigroup.com'}/meetings/${m.id}`

  // Gecikme gövdesi son tarihi GEÇMİŞ bir karar varsayar; gerçek kararın dueDate'i
  // boş olabilir — önizlemede 7 gün öncesi kullanılır. DB'ye YAZILMAZ.
  const gecikmeKarari = {
    decisionNumber: ilkKarar.decisionNumber,
    title: ilkKarar.title,
    dueDate: ilkKarar.dueDate ?? new Date(Date.now() - 7 * 86400000),
    priority: ilkKarar.priority,
    meeting: { meetingNumber: m.meetingNumber, title: m.title },
  }

  const parcalar = [
    { ad: 'davet', icerik: await bildirim.davetIcerigi(m.id) },
    { ad: 'karar', icerik: await bildirim.kararIcerigi(ilkKarar.id) },
    { ad: 'tutanak', icerik: await bildirim.ozetIcerigi(m.id) },
    { ad: 'gecikme', icerik: bildirim.gecikmeIcerigi(gecikmeKarari, link) },
  ]

  mkdirSync(CIKTI_DIZIN, { recursive: true })
  const yollar: string[] = []
  parcalar.forEach((p, i) => {
    if (!p.icerik) { console.error(`${p.ad}: içerik üretilemedi`); return }
    const yol = path.join(CIKTI_DIZIN, `${i + 1}-${p.ad}.html`)
    writeFileSync(yol, p.icerik.html, 'utf8')
    chmodSync(yol, 0o600)
    yollar.push(yol)
    console.log(`  ${i + 1}/4 ${p.ad.padEnd(8)} → ${yol}`)
    console.log(`        konu: ${p.icerik.konu}`)
    console.log(`        hub-mail-v1 damgası: ${p.icerik.html.includes('<!-- hub-mail-v1 -->') ? 'VAR' : 'YOK'}`)
  })

  if (!hedef) {
    console.log('\nGönderim YAPILMADI (--gonder verilmedi).')
    await prisma.$disconnect()
    return
  }

  for (let i = 0; i < parcalar.length; i++) {
    const p = parcalar[i]
    if (!p.icerik) continue
    const konu = `[TOPLANTI-ONIZLEME ${i + 1}/4] ${p.icerik.konu}`
    const r = await sendEmail([{ name: hedef, email: hedef }], konu, p.icerik.text, p.icerik.html, logoAttachments())
    console.log(`  ${i + 1}/4 ${p.ad.padEnd(8)} → ${hedef}  ${r.success ? 'OK' : 'HATA: ' + r.error}  ${r.messageId ?? ''}`)
    if (!r.success) process.exitCode = 1
  }
  console.log('\nAlıcı YALNIZ', hedef, '— gerçek katılımcılara gönderim YOK, in-app bildirim OLUŞTURULMADI.')
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
