import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push-notifications";
import { ileriHubUrl } from "@/lib/email-templates/akademi/_base";

export const dynamic = "force-dynamic";

// PR-2: Mesai onayı süre-aşımı hatırlatması.
// Bir onay adımı 5 dk'dır bekliyorsa (kararlı önceki adımın decidedAt'i / submit
// anından beri) atanmış onaylayıcıya 1 KEZ mail. Dedup: OvertimeApproval.reminderSentAt.
// Cron pattern (x-cron-secret) + sendEmail (mail-guard) reuse. PR-1 akışına dokunmaz.

const THRESHOLD_MS = 5 * 60 * 1000; // 5 dakika (hatırlatma eşiği)
// PR-3: 15 dk içinde onaylanmayan adım yedek onaycıya devredilir (tek seviye).
const ESCALATION_MS = 15 * 60 * 1000;

function buildReminderMail(input: {
  formNo: string;
  ownerName: string;
  dateStr: string;
  role: string;
  link: string;
}): { subject: string; text: string; html: string } {
  const { formNo, ownerName, dateStr, role, link } = input;
  const subject = "Mesai onayınız bekliyor";
  const text =
    `Mesai onayınız bekliyor.\n\n` +
    `Form No: ${formNo}\n` +
    `Oluşturan: ${ownerName}\n` +
    `Mesai Tarihi: ${dateStr}\n` +
    `Onay adımınız: ${role}\n\n` +
    `Forma git: ${link}\n\nİleri Group`;
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr><td bgcolor="#1B4F72" style="background:#1B4F72;padding:14px 24px;">
          <span style="color:#ffffff;font-size:15px;font-weight:700;">ILERIHub · Mesai Onayı</span>
        </td></tr>
        <tr><td style="padding:22px 24px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#1f2733;">Onayınız bekliyor</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">
            Aşağıdaki mesai formu <strong>${role}</strong> onay adımında sizi bekliyor.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;color:#334155;">
            <tr><td style="padding:2px 0;color:#64748b;">Form No</td><td style="padding:2px 0 2px 16px;font-weight:600;">${formNo}</td></tr>
            <tr><td style="padding:2px 0;color:#64748b;">Oluşturan</td><td style="padding:2px 0 2px 16px;font-weight:600;">${ownerName}</td></tr>
            <tr><td style="padding:2px 0;color:#64748b;">Mesai Tarihi</td><td style="padding:2px 0 2px 16px;font-weight:600;">${dateStr}</td></tr>
          </table>
          <div style="margin:20px 0 4px;">
            <a href="${link}" style="display:inline-block;background-color:#1B4F72;color:#ffffff;font-size:14px;font-weight:bold;line-height:44px;text-decoration:none;border-radius:6px;padding:0 26px;">&nbsp;Forma git&nbsp;</a>
          </div>
        </td></tr>
        <tr><td style="border-top:1px solid #e2e8f0;padding:14px 24px;background:#fbfcfd;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">Bu e-posta İleriHub tarafından otomatik gönderilmiştir.<br>© İleri Group</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}

// PR-3: yedek onaycıya eskalasyon maili (devredildi bilgisi).
function buildEscalationMail(input: {
  formNo: string;
  ownerName: string;
  dateStr: string;
  role: string;
  minutes: number;
  link: string;
}): { subject: string; text: string; html: string } {
  const { formNo, ownerName, dateStr, role, minutes, link } = input;
  const subject = "Mesai onayı size devredildi";
  const text =
    `${formNo} mesai formu onayı ${minutes} dk içinde verilmediği için size yönlendirildi.\n\n` +
    `Form No: ${formNo}\n` +
    `Oluşturan: ${ownerName}\n` +
    `Mesai Tarihi: ${dateStr}\n` +
    `Onay adımı: ${role}\n\n` +
    `Forma git: ${link}\n\nİleri Group`;
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr><td bgcolor="#1B4F72" style="background:#1B4F72;padding:14px 24px;">
          <span style="color:#ffffff;font-size:15px;font-weight:700;">ILERIHub · Mesai Onayı</span>
        </td></tr>
        <tr><td style="padding:22px 24px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#1f2733;">Onay size devredildi</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">
            Aşağıdaki mesai formu <strong>${role}</strong> adımında ${minutes} dk içinde onaylanmadığı için
            yedek onaycı olarak <strong>size</strong> yönlendirildi.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;color:#334155;">
            <tr><td style="padding:2px 0;color:#64748b;">Form No</td><td style="padding:2px 0 2px 16px;font-weight:600;">${formNo}</td></tr>
            <tr><td style="padding:2px 0;color:#64748b;">Oluşturan</td><td style="padding:2px 0 2px 16px;font-weight:600;">${ownerName}</td></tr>
            <tr><td style="padding:2px 0;color:#64748b;">Mesai Tarihi</td><td style="padding:2px 0 2px 16px;font-weight:600;">${dateStr}</td></tr>
          </table>
          <div style="margin:20px 0 4px;">
            <a href="${link}" style="display:inline-block;background-color:#1B4F72;color:#ffffff;font-size:14px;font-weight:bold;line-height:44px;text-decoration:none;border-radius:6px;padding:0 26px;">&nbsp;Forma git&nbsp;</a>
          </div>
        </td></tr>
        <tr><td style="border-top:1px solid #e2e8f0;padding:14px 24px;background:#fbfcfd;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">Bu e-posta İleriHub tarafından otomatik gönderilmiştir.<br>© İleri Group</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const forms = await prisma.overtimeForm.findMany({
    where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
    select: {
      id: true,
      formNo: true,
      date: true,
      createdBy: { select: { name: true, email: true } },
      approvals: {
        orderBy: { step: "asc" },
        select: {
          id: true,
          step: true,
          role: true,
          approverId: true,
          decision: true,
          decidedAt: true,
          createdAt: true,
          reminderSentAt: true,
          escalatedAt: true,
        },
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  let escalated = 0;

  for (const form of forms) {
    // Aktif bekleyen adım = en düşük step'li decision===null
    const pending = form.approvals.find((a) => a.decision === null);
    if (!pending) continue;

    // Bekleme-başı = kararlı adımların MAX(decidedAt); escalatedAt set ise onu da aday
    // al (eskalasyon sonrası saat yedek için yeniden başlar); yoksa pending.createdAt.
    const decidedTimes = form.approvals
      .filter((a) => a.decision !== null && a.decidedAt)
      .map((a) => a.decidedAt!.getTime());
    const candidates = [...decidedTimes];
    if (pending.escalatedAt) candidates.push(pending.escalatedAt.getTime());
    const waitingSince = candidates.length
      ? new Date(Math.max(...candidates))
      : pending.createdAt;
    const elapsedMs = now.getTime() - waitingSince.getTime();

    // === ESKALASYON (PR-3): 15 dk + henüz eskale edilmemiş (tek seviye) ===
    // Hatırlatma dedup'ından ÖNCE: 5dk reminder gitmiş olsa bile 15dk'da eskale edilmeli.
    if (elapsedMs >= ESCALATION_MS && pending.escalatedAt == null && pending.approverId) {
      // Adımın yedek onaycısı (ApprovalPosition.sortOrder = step) — adım-bazlı opt-in.
      const pos = await prisma.approvalPosition.findFirst({
        where: { sortOrder: pending.step },
        select: { backupUserId: true },
      });
      const backupId = pos?.backupUserId ?? null;
      if (backupId && backupId !== pending.approverId) {
        // Devret + işaretle (reminderSentAt=null → yedek için hatırlatma penceresi sıfırla).
        await prisma.overtimeApproval.update({
          where: { id: pending.id },
          data: {
            approverId: backupId,
            escalatedAt: now,
            escalatedToId: backupId,
            reminderSentAt: null,
          },
        });
        const minutes = Math.round(elapsedMs / 60000);
        const link = `/forms/overtime/${form.id}`;
        const message = `${form.formNo} mesai formu onayı ${minutes} dk içinde verilmediği için size yönlendirildi.`;
        // Yedeğe bildirim: in-app + push + mail (mail-guard) — overtime'ın 3 primitifi.
        try {
          await prisma.notification.create({
            data: {
              userId: backupId,
              title: "Mesai Onayı Size Devredildi",
              message,
              type: "REMINDER",
              link,
            },
          });
        } catch {
          // bildirim hatası eskalasyonu bozmaz
        }
        sendPushToUser(prisma, backupId, {
          title: "Mesai Onayı Size Devredildi",
          body: message,
          url: link,
          tag: `overtime-escalate-${form.id}`,
        }).catch(() => {});
        const backup = await prisma.user.findUnique({
          where: { id: backupId },
          select: { name: true, email: true },
        });
        if (backup?.email) {
          const mail = buildEscalationMail({
            formNo: form.formNo,
            ownerName: form.createdBy?.name ?? form.createdBy?.email ?? "—",
            dateStr: form.date.toLocaleDateString("tr-TR"),
            role: pending.role || "Onay",
            minutes,
            link: ileriHubUrl(link),
          });
          await sendEmail(
            [{ email: backup.email, name: backup.name ?? backup.email }],
            mail.subject,
            mail.text,
            mail.html
          ).catch((e) =>
            console.error(`[overtime-escalate] ${form.formNo}: mail hata`, e)
          );
        } else {
          console.warn(
            `[overtime-escalate] ${form.formNo}: yedek email yok (backupId=${backupId})`
          );
        }
        escalated++;
        continue; // bu turda hatırlatma atma; yedek kendi 5dk penceresine girer
      }
      // backupUserId yok veya kendine eskalasyon → eskale etme, hatırlatma mantığına düş
    }

    // === HATIRLATMA (PR-2, 5 dk) — değişmedi ===
    if (pending.reminderSentAt) {
      skipped++; // DEDUP: zaten gönderildi
      continue;
    }
    if (elapsedMs <= THRESHOLD_MS) {
      continue; // eşik altı — henüz hatırlatma yok
    }

    if (!pending.approverId) {
      skipped++;
      continue;
    }
    const approver = await prisma.user.findUnique({
      where: { id: pending.approverId },
      select: { name: true, email: true },
    });
    if (!approver?.email) {
      console.warn(
        `[overtime-overdue] ${form.formNo} step ${pending.step}: approver email yok (approverId=${pending.approverId})`
      );
      skipped++;
      continue;
    }

    // Mail → başarılıysa reminderSentAt yaz (mail başarısızsa YAZMA → sonraki tarama
    // tekrar dener). sendEmail SMTP yan-etkisi olduğundan DB $transaction içine
    // alınmaz; sıralama: önce gönder, başarıda işaretle.
    try {
      const { subject, text, html } = buildReminderMail({
        formNo: form.formNo,
        ownerName: form.createdBy?.name ?? form.createdBy?.email ?? "—",
        dateStr: form.date.toLocaleDateString("tr-TR"),
        role: pending.role || "Onay",
        link: ileriHubUrl(`/forms/overtime/${form.id}`),
      });
      const res = await sendEmail(
        [{ email: approver.email, name: approver.name ?? approver.email }],
        subject,
        text,
        html
      );
      if (!res.success) {
        console.error(
          `[overtime-overdue] ${form.formNo}: mail başarısız (${res.error ?? "?"}) — reminderSentAt yazılmadı`
        );
        skipped++;
        continue;
      }
      await prisma.overtimeApproval.update({
        where: { id: pending.id },
        data: { reminderSentAt: now },
      });
      sent++;
    } catch (e) {
      console.error(`[overtime-overdue] ${form.formNo}: hata`, e);
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, scanned: forms.length, sent, skipped, escalated });
}
