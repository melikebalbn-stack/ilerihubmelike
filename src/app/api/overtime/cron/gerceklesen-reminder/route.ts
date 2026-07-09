import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push-notifications'
import { ileriHubUrl } from '@/lib/email-templates/akademi/_base'

export const dynamic = 'force-dynamic'

// Bölüm adı normalize: workDepartment ↔ DepartmentDefinition.name (Türkçe upper + trim).
const normDept = (s?: string | null) => (s ?? '').trim().toLocaleUpperCase('tr-TR')

/**
 * POST /api/overtime/cron/gerceklesen-reminder
 * Ertesi sabah hatırlatması: DÜN mesai günü olan APPROVED formlarda, hedefAdet DOLU ama
 * gerceklesenAdet NULL olan satırların bölüm sorumlusuna/müdürüne (yoksa form sahibine)
 * "gerçekleşen üretim adedini girin" hatırlatması gönderir (in-app + push + mail).
 * Tek sefer: pencere (date=dün) → ertesi gün tarih kaydığı için tekrar göndermez (migration yok).
 * Guard: x-cron-secret (diğer cron'larla aynı).
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Tarih: test için ?date=YYYY-MM-DD; prod cron parametresiz → DÜN (UTC).
  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date')
  let dayStart: Date
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    dayStart = new Date(`${dateParam}T00:00:00.000Z`)
  } else {
    const now = new Date()
    dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
  }
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1)
  const dateStr = dayStart.toISOString().slice(0, 10)
  const tarihMetni = dayStart.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })

  // Dün mesai günü + onaylı formlar
  const forms = await prisma.overtimeForm.findMany({
    where: { status: 'APPROVED', date: { gte: dayStart, lte: dayEnd } },
    select: {
      id: true,
      formNo: true,
      createdById: true,
      personnel: { select: { hedefAdet: true, gerceklesenAdet: true, workDepartment: true } },
    },
  })
  if (forms.length === 0) {
    return NextResponse.json({ ok: true, dun: dateStr, form_sayisi: 0, bekleyen_form: 0, alici_sayisi: 0, gonderilen: 0 })
  }

  // Omurga: bölüm adı(normalize) → sorumlu/müdür personnelId (öncelik: s1→s2→s3→müd.yrd.→müdür)
  const depts = await prisma.departmentDefinition.findMany({
    select: { name: true, sorumlu1Id: true, sorumlu2Id: true, sorumlu3Id: true, sorumlu4Id: true, mudurYardimcisiId: true, mudurId: true },
  })
  const pidByDept = new Map<string, string>()
  for (const d of depts) {
    const pid = d.sorumlu1Id ?? d.sorumlu2Id ?? d.sorumlu3Id ?? d.sorumlu4Id ?? d.mudurYardimcisiId ?? d.mudurId
    if (pid) pidByDept.set(normDept(d.name), pid)
  }

  // personnelId → aktif User.id
  const neededPids = [...new Set([...pidByDept.values()])]
  const respUsers = neededPids.length
    ? await prisma.user.findMany({ where: { personnelId: { in: neededPids }, isActive: true }, select: { id: true, personnelId: true } })
    : []
  const uidByPid = new Map(respUsers.map((u) => [u.personnelId!, u.id]))

  // Alıcı başına birleştir: userId → { formNos, formIds }
  const byUser = new Map<string, { formNos: Set<string>; formIds: Set<string> }>()
  const add = (uid: string, formNo: string, formId: string) => {
    if (!byUser.has(uid)) byUser.set(uid, { formNos: new Set(), formIds: new Set() })
    const b = byUser.get(uid)!
    b.formNos.add(formNo)
    b.formIds.add(formId)
  }

  let bekleyenForm = 0
  for (const f of forms) {
    const pendingDepts = new Set(
      f.personnel.filter((p) => p.hedefAdet != null && p.gerceklesenAdet == null).map((p) => normDept(p.workDepartment)),
    )
    if (pendingDepts.size === 0) continue // hepsi girilmiş → bildirim yok
    bekleyenForm++
    for (const nd of pendingDepts) {
      const pid = pidByDept.get(nd)
      const uid = (pid && uidByPid.get(pid)) || f.createdById // omurga yoksa → creator fallback
      add(uid, f.formNo, f.id)
    }
  }

  if (byUser.size === 0) {
    return NextResponse.json({ ok: true, dun: dateStr, form_sayisi: forms.length, bekleyen_form: bekleyenForm, alici_sayisi: 0, gonderilen: 0 })
  }

  // Alıcı bilgileri
  const users = await prisma.user.findMany({
    where: { id: { in: [...byUser.keys()] }, isActive: true },
    select: { id: true, name: true, email: true },
  })
  const userById = new Map(users.map((u) => [u.id, u]))

  let gonderilen = 0
  for (const [uid, info] of byUser) {
    const u = userById.get(uid)
    if (!u) continue // pasif/silinmiş kullanıcı → atla
    const formNos = [...info.formNos].sort()
    const formIds = [...info.formIds]
    const link = formIds.length === 1 ? `/forms/overtime/${formIds[0]}` : '/forms/overtime'
    const title = 'Gerçekleşen Üretim Girişi Bekliyor'
    const message = `${tarihMetni} tarihli mesai formlarında gerçekleşen üretim adedi bekliyor: ${formNos.join(', ')}. Lütfen girin.`

    // in-app
    try {
      await prisma.notification.create({ data: { userId: uid, title, message, type: 'REMINDER', link } })
    } catch {
      // bildirim hatası akışı bozmaz
    }
    // push
    sendPushToUser(prisma, uid, { title, body: message, url: link, tag: `gerceklesen-reminder-${dateStr}` }).catch(() => {})
    // mail
    if (u.email) {
      const text =
        `${message}\n\n` +
        `Formlar: ${formNos.join(', ')}\n` +
        `Girmek için: ${ileriHubUrl(link)}\n\nİleri Group`
      const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr><td bgcolor="#1B4F72" style="background:#1B4F72;padding:14px 24px;">
          <span style="color:#ffffff;font-size:15px;font-weight:700;">ILERIHub · Mesai Üretim</span>
        </td></tr>
        <tr><td style="padding:22px 24px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#1f2733;">Gerçekleşen üretim adedi bekliyor</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">
            <strong>${tarihMetni}</strong> tarihli aşağıdaki onaylı mesai formlarında gerçekleşen üretim adedi henüz girilmedi.
            Lütfen sorumlu olduğunuz bölüm(ler) için girişi tamamlayın.
          </p>
          <p style="margin:0 0 16px;font-size:14px;color:#334155;"><strong>Formlar:</strong> ${formNos.join(', ')}</p>
          <div style="margin:20px 0 4px;">
            <a href="${ileriHubUrl(link)}" style="display:inline-block;background-color:#1B4F72;color:#ffffff;font-size:14px;font-weight:bold;line-height:44px;text-decoration:none;border-radius:6px;padding:0 26px;">&nbsp;Gerçekleşeni gir&nbsp;</a>
          </div>
        </td></tr>
        <tr><td style="border-top:1px solid #e2e8f0;padding:14px 24px;background:#fbfcfd;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">Bu e-posta İleriHub tarafından otomatik gönderilmiştir.<br>© İleri Group</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
      const res = await sendEmail([{ email: u.email, name: u.name ?? u.email }], `Gerçekleşen üretim girişi bekliyor — ${tarihMetni}`, text, html)
        .catch((e) => { console.error(`[gerceklesen-reminder] ${u.email}: mail hata`, e); return { success: false } })
      if (res.success) gonderilen++
    }
  }

  console.log(`[gerceklesen-reminder] ${dateStr}: form=${forms.length}, bekleyen=${bekleyenForm}, alıcı=${byUser.size}, mail=${gonderilen}`)
  return NextResponse.json({ ok: true, dun: dateStr, form_sayisi: forms.length, bekleyen_form: bekleyenForm, alici_sayisi: byUser.size, gonderilen })
}
