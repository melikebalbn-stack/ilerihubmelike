import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push-notifications'
import { ileriHubUrl, escapeHtml } from '@/lib/email-templates/akademi/_base'
import { renderEmail, logoAttachments, p } from '@/lib/email-templates/layout'

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
      // Satır bazlı: tekil OvertimePersonnel alanları yalnız 1. satırı temsil eder →
      // çok satırlı kayıtta yarım giriş hatırlatma üretmiyordu.
      personnel: { select: { workDepartment: true, uretimSatirlari: { select: { hedefAdet: true, gerceklesenAdet: true } } } },
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
      f.personnel
        // hedefAdet 0 → üretim beklenmiyor, gerçekleşen girilmesi de beklenmez → hatırlatma yok.
        .filter((p) => p.uretimSatirlari.some((u) => u.hedefAdet != null && u.hedefAdet > 0 && u.gerceklesenAdet == null))
        .map((p) => normDept(p.workDepartment)),
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
      const html = renderEmail({
        module: 'Mesai',
        title: 'Gerçekleşen üretim adedi bekliyor',
        subtitle: `${tarihMetni} · ${formNos.length} form`,
        preheader: message,
        bodyHtml: p(
          `<strong>${escapeHtml(tarihMetni)}</strong> tarihli aşağıdaki onaylı mesai formlarında gerçekleşen üretim adedi henüz girilmedi. ` +
            'Lütfen sorumlu olduğunuz bölüm(ler) için girişi tamamlayın.',
        ),
        infoRows: [{ label: 'Formlar', value: escapeHtml(formNos.join(', ')) }],
        cta: { label: 'Gerçekleşeni gir', url: ileriHubUrl(link) },
      })
      const res = await sendEmail([{ email: u.email, name: u.name ?? u.email }], `Gerçekleşen üretim girişi bekliyor — ${tarihMetni}`, text, html, logoAttachments())
        .catch((e) => { console.error(`[gerceklesen-reminder] ${u.email}: mail hata`, e); return { success: false } })
      if (res.success) gonderilen++
    }
  }

  console.log(`[gerceklesen-reminder] ${dateStr}: form=${forms.length}, bekleyen=${bekleyenForm}, alıcı=${byUser.size}, mail=${gonderilen}`)
  return NextResponse.json({ ok: true, dun: dateStr, form_sayisi: forms.length, bekleyen_form: bekleyenForm, alici_sayisi: byUser.size, gonderilen })
}
