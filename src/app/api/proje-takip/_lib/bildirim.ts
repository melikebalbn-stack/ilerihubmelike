import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getMuhendislikEkibi, type MuhendislikKisi } from "./muhendislik-ekibi";

/**
 * Alıcı seçimi (2026-09-21'de kararlaştırıldı):
 * - proje.muhendislikSorumluId doluysa → SADECE o kişiye.
 * - boşsa → Mühendislik Müdürlüğü'ndeki (aktif, User hesabı olan) herkese.
 * 2 kanal: email + in-app notification (push yok, taslakta da yoktu).
 */

type ProjeOzet = {
  id: string;
  projeNo: string;
  ileriTanim: string;
  musteriFirma: string;
  muhendislikSorumluId: string | null;
};

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

function buildProjeAcildiEmailContent(
  proje: ProjeOzet,
  recipientName: string
): { subject: string; body: string; html: string } {
  const subject = `[ILERIHub] Yeni proje: ${proje.projeNo} — ${proje.ileriTanim}`;

  const body = `Merhaba ${recipientName},

${proje.projeNo} — ${proje.ileriTanim} (${proje.musteriFirma}) için plant parametrelerini doldurmanız gerekiyor.

Detaylar için ILERIHub'a giriş yapabilirsiniz.`;

  const html = `
    <p>Merhaba ${esc(recipientName)},</p>
    <p><strong>${esc(proje.projeNo)}</strong> — ${esc(proje.ileriTanim)} (${esc(proje.musteriFirma)}) için plant parametrelerini doldurmanız gerekiyor.</p>
    <p>Detaylar için ILERIHub'a giriş yapabilirsiniz.</p>
  `;

  return { subject, body, html };
}

async function sendProjeAcildiEmail(
  recipient: MuhendislikKisi,
  proje: ProjeOzet
): Promise<void> {
  const recipientName = recipient.name ?? recipient.email;
  const { subject, body, html } = buildProjeAcildiEmailContent(proje, recipientName);
  await sendEmail([{ name: recipientName, email: recipient.email }], subject, body, html);
}

async function createProjeAcildiInAppNotification(
  recipient: MuhendislikKisi,
  proje: ProjeOzet
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: recipient.id,
      title: "Yeni Proje Açıldı",
      message: `${proje.projeNo} — ${proje.ileriTanim} (${proje.musteriFirma}) için plant parametrelerini doldurmanız gerekiyor.`,
      type: "INFO",
      link: `/proje-takip/muhendislik/${proje.projeNo}`,
    },
  });
}

export async function projeAcildiBildirimGonder(proje: ProjeOzet) {
  let alicilar: MuhendislikKisi[];

  if (proje.muhendislikSorumluId) {
    const atanan = await prisma.user.findUnique({
      where: { id: proje.muhendislikSorumluId },
      select: { id: true, name: true, email: true },
    });
    alicilar = atanan ? [atanan] : [];
  } else {
    alicilar = await getMuhendislikEkibi();
  }

  if (alicilar.length === 0) {
    console.warn(`[proje-takip] ${proje.projeNo} için bildirim alıcısı bulunamadı`);
    await prisma.projeTakipLog.create({
      data: {
        projeTakipId: proje.id,
        islemTipi: "BILDIRIM_BEKLIYOR",
        yapanId: "SYSTEM",
        detay: `${proje.projeNo} için alıcı bulunamadı (atanan mühendis silinmiş/pasif ya da departmanda hesabı olan kimse yok).`,
      },
    });
    return;
  }

  const results = await Promise.allSettled(
    alicilar.flatMap((r) => [
      sendProjeAcildiEmail(r, proje),
      createProjeAcildiInAppNotification(r, proje),
    ])
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const alici = alicilar[Math.floor(i / 2)];
      const kanal = i % 2 === 0 ? "email" : "in-app";
      console.error(`[proje-takip] ${proje.projeNo} → ${alici.email} (${kanal}) bildirim hatası:`, r.reason);
    }
  });

  const hedef = proje.muhendislikSorumluId
    ? `atanan mühendis (${alicilar[0].email})`
    : `Mühendislik Müdürlüğü (${alicilar.length} kişi)`;

  await prisma.projeTakipLog.create({
    data: {
      projeTakipId: proje.id,
      islemTipi: "BILDIRIM_GONDERILDI",
      yapanId: "SYSTEM",
      detay: `${hedef} kişiye/kişilere bildirim ve e-posta gönderildi.`,
    },
  });
}
