import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PersonnelRequestStatus } from "@/generated/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { kadroTalepErisimiCore, kadroTalepErisimYok, kadroTalepKapsamCoz } from "@/lib/kadro-talep/kadro-talep-yetki";
import {
  kadroTalepGorunurluk,
  kadroTalepGorebilirMi,
  maasAlanlariniAyikla,
} from "@/lib/kadro-talep/kadro-talep-gorunurluk";
import { resolveApprovers } from "@/lib/personnel-request-chain";
import { talepAlanlariSchema, tarihDon } from "@/lib/recruitment/personnel-request-alanlar";
import { sendPushToUser } from "@/lib/push-notifications";
import { sendEmail } from "@/lib/email";
import { escapeHtml, ileriHubUrl } from "@/lib/email-templates/akademi/_base";
import { renderEmailHtml, logoAttachments, p } from "@/lib/email-templates/layout";
import { resolveHRRecipients } from "@/lib/hr-notifications";
import { logAuditEvent } from "@/lib/audit-log";

type BildirimTuru = "SIRA" | "ONAYLANDI" | "REDDEDILDI";

// İK ekibine (İnsan Varlıkları departmanı) bilgi bildirimi — final onayda (İK Müdürü onayı).
// resolveHRRecipients mevcut İK alıcı çözümleme deseni. Best-effort.
async function notifyHrTeam(requestNumber: string, title: string) {
  try {
    const alicilar = await resolveHRRecipients();
    if (!alicilar.length) return;
    const mesaj = `${requestNumber} numaralı "${title}" personel talebi tüm onaylardan geçti (İK Müdürü onayı) ve APPROVED oldu.`;
    await sendEmail(
      alicilar.map((a) => ({ email: a.email ?? "", name: a.name ?? a.email ?? "" })).filter((a) => a.email),
      "Personel Talebi Onaylandı",
      mesaj,
      renderEmailHtml({
        module: "İnsan Varlıkları",
        title: "Personel talebi onaylandı",
        subtitle: `${requestNumber} · ${title}`,
        preheader: mesaj,
        bodyHtml: p(escapeHtml(mesaj)),
        infoRows: [
          { label: "Talep No", value: `<strong>${escapeHtml(requestNumber)}</strong>` },
          { label: "Başlık", value: escapeHtml(title) },
        ],
        cta: { label: "Kadro Taleplerine Git", url: ileriHubUrl("/strategic-hr/kadro-talep") },
      }),
      logoAttachments(),
    );
    for (const a of alicilar) {
      if (a.id) await sendPushToUser(prisma, a.id, { title: "Personel Talebi Onaylandı", body: mesaj, url: "/strategic-hr/kadro-talep", tag: `pr-approved-${requestNumber}` });
    }
  } catch {
    // İK bildirimi best-effort
  }
}

// Onay zinciri bildirimi (best-effort — bildirim hatası ana akışı bozmaz). Mesai deseni.
async function notifyApprover(
  userId: string,
  requestNumber: string,
  title: string,
  tur: BildirimTuru,
) {
  try {
    const mesaj =
      tur === "SIRA"
        ? `${requestNumber} numaralı "${title}" personel talebi onayınızı bekliyor.`
        : tur === "ONAYLANDI"
          ? `${requestNumber} numaralı "${title}" personel talebiniz onaylandı.`
          : `${requestNumber} numaralı "${title}" personel talebiniz reddedildi.`;
    // 21.09.2026: in-app Notification + push (eskiden yalnız push → çan'da görünmüyordu).
    // Mesai emsali (gerceklesen-reminder): prisma.notification.create + sendPushToUser.
    // Ayrı try: bildirim yazılamazsa e-posta yine gitsin.
    try {
      await prisma.notification.create({
        data: { userId, title: "Personel Talebi Onayı", message: mesaj, type: tur === "SIRA" ? "REMINDER" : "INFO", link: "/strategic-hr/kadro-talep" },
      });
      await sendPushToUser(prisma, userId, {
        title: "Personel Talebi Onayı",
        body: mesaj,
        url: "/strategic-hr/kadro-talep",
        tag: `personnel-request-${requestNumber}`,
      });
    } catch (err) {
      console.error(`[kadro-talep] in-app/push bildirimi yazılamadı userId=${userId} ${requestNumber}:`, err instanceof Error ? err.message : err);
    }
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (u?.email) {
      const baslik =
        tur === "SIRA" ? "Personel talebi onayınızı bekliyor" : tur === "ONAYLANDI" ? "Personel talebiniz onaylandı" : "Personel talebiniz reddedildi";
      await sendEmail(
        [{ email: u.email, name: u.name || "" }],
        "Personel Talebi Onayı",
        mesaj,
        renderEmailHtml({
          module: "İnsan Varlıkları",
          title: baslik,
          subtitle: `${requestNumber} · ${title}`,
          preheader: mesaj,
          bodyHtml: p(escapeHtml(mesaj)),
          infoRows: [
            { label: "Talep No", value: `<strong>${escapeHtml(requestNumber)}</strong>` },
            { label: "Başlık", value: escapeHtml(title) },
          ],
          cta: { label: "Kadro Taleplerine Git", url: ileriHubUrl("/strategic-hr/kadro-talep") },
        }),
        logoAttachments(),
      );
    }
  } catch (err) {
    // bildirim best-effort — ama sessiz kalmasın (e-posta/push hatası izlenebilsin)
    console.error(`[kadro-talep] e-posta gönderilemedi (${tur}) userId=${userId} ${requestNumber}:`, err instanceof Error ? err.message : err);
  }
}

// GET - Tek talep detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const { id } = await params;
    // ÖN KAPI (19.09.2026 erişim daraltma): admin ∨ view ∨ koltuk ∨ kadro.talep.ac; aksi 403.
    const erisim = await kadroTalepErisimiCore(session.user.id, session.user.permissions ?? []);
    if (!erisim.erisebilir) return kadroTalepErisimYok();
    // Kapsam TEK KAYNAK — liste/export ile aynı modül (kadro-talep-gorunurluk.ts).
    const kapsamCoz = await kadroTalepKapsamCoz(session.user.id, session.user.email || "", session.user.permissions ?? []);
    const kapsam = kadroTalepGorunurluk(session, undefined, { erisebilir: erisim.erisebilir, requesterIdler: kapsamCoz.requesterIdler });

    const personnelRequest = await prisma.personnelRequest.findUnique({
      where: { id },
      include: {
        jobOpening: {
          select: {
            id: true,
            title: true,
            code: true,
            status: true,
            _count: { select: { applications: true } },
          },
        },
        // Onay zinciri (görünüm) — onaycı adı, karar, tarih.
        approvals: {
          orderBy: { step: "asc" },
          include: { approver: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!personnelRequest || personnelRequest.silindiMi) {
      return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
    }

    // Kural liste `where`'inin kayıt bazlı karşılığı — TEK KAYNAK (kadroTalepGorebilirMi):
    // admin / sahibi / atanmış onaycı (herhangi adım) / talep sahibi koltuk kapsamında.
    if (!kadroTalepGorebilirMi(kapsam, personnelRequest)) {
      return NextResponse.json({ error: "Bu talebi görüntüleme yetkiniz yok" }, { status: 403 });
    }

    // Bütçe alanları yalnız admin'e — admin olmayanda anahtar HİÇ YOK.
    return NextResponse.json(
      kapsam.hasFullAccess ? personnelRequest : maasAlanlariniAyikla(personnelRequest),
    );
  } catch (error) {
    console.error("Talep detay hatası:", error);
    return NextResponse.json(
      { error: "Talep alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// PUT - Talep güncelle veya onay/red işlemi
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (approvedBy/rejectedBy = userId)
    const { session, userId, error } = await requireSession();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { action } = body; // "approve", "reject", "update", "submit", "cancel"

    const userEmail = (session.user.email || "").toLowerCase();

    // ÖN KAPI (19.09.2026): admin ∨ view ∨ koltuk ∨ kadro.talep.ac; İSTİSNA: bu talebin
    // onay zincirindeki onaycı (approve/reject kendi adımını verebilmeli — PDF ile aynı).
    const erisim = await kadroTalepErisimiCore(session.user.id, session.user.permissions ?? []);
    if (!erisim.erisebilir) {
      const onayci = await prisma.personnelRequestApproval.findFirst({ where: { personnelRequestId: id, approverId: userId }, select: { id: true } });
      if (!onayci) return kadroTalepErisimYok();
    }

    // PR-RECRUIT-RBAC: hasFullAccess=admin (onay/red için)
    const perms = session.user.permissions ?? [];
    const hasFullAccess = perms.includes("recruitment.admin");

    // Mevcut talebi al
    const existingRequest = await prisma.personnelRequest.findUnique({ where: { id } });

    if (!existingRequest || existingRequest.silindiMi) {
      return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
    }

    // İşlem türüne göre yetki kontrolü.
    // approve/reject: ARTIK admin değil — sıradaki adımın onaycısı (aşağıda per-step guard).
    if (action === "update" || action === "submit" || action === "cancel") {
      if (existingRequest.requesterEmail.toLowerCase() !== userEmail && !hasFullAccess) {
        return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
      }
    }

    // ---- SUBMIT: zincir kur (çözülemezse ENGELLE) ----
    if (action === "submit") {
      if (existingRequest.status !== "DRAFT") {
        return NextResponse.json({ error: "Sadece taslak talepler gönderilebilir" }, { status: 400 });
      }
      // Zincir: İK Müdürü → GMY → GM (hepsi ApprovalPosition kodundan; talep sahibinin
      // departmanı/personnelId'si GEREKMEZ → personnelId'siz kullanıcı da talep açabilir).
      // Zincir: Bölüm Müdürü → GMY → GM → İK Müdürü (Bölüm Müdürü için requesterId gerekli).
      const cozum = await resolveApprovers(prisma, existingRequest.requesterId);
      if (!cozum.ok) {
        // Sessiz boşta kalma YOK — talep PENDING'e geçmez, net hata döner.
        return NextResponse.json({ error: cozum.error }, { status: 400 });
      }
      // ZİNCİRSİZ PENDING İMKÂNSIZ OLSUN: `ok:true` iken bile adım listesi boş gelirse
      // aşağıdaki transaction statüyü PENDING yapar (createMany 0 satır yazar) ve hemen
      // ardından `cozum.adimlar[0]` patlar → talep TAM OLARAK düzeltmeye çalıştığımız
      // duruma düşer: PENDING ama zincirsiz, ekranda onay butonu yok, kurtarma yolu yok.
      // Bugün resolveApprovers'ın boş dönmesi beklenmiyor (self-approval elemesi sonrası
      // en az İK Müdürü adımı bırakılıyor), ama bu kapı varsayıma değil kontrole dayansın.
      if (cozum.adimlar.length === 0) {
        return NextResponse.json(
          { error: "Onay zinciri kurulamadı (uygun onaycı bulunamadı). Talep taslak olarak kaldı." },
          { status: 400 },
        );
      }
      await prisma.$transaction([
        prisma.personnelRequestApproval.deleteMany({ where: { personnelRequestId: id } }),
        prisma.personnelRequestApproval.createMany({
          data: cozum.adimlar.map((a) => ({
            personnelRequestId: id,
            step: a.step,
            kademe: a.kademe,
            role: a.role,
            approverId: a.approverId,
          })),
        }),
        prisma.personnelRequest.update({ where: { id }, data: { status: "PENDING" as PersonnelRequestStatus } }),
      ]);
      await notifyApprover(cozum.adimlar[0].approverId, existingRequest.requestNumber, existingRequest.title, "SIRA");
      return NextResponse.json({ ok: true, message: "Talep onaya gönderildi." });
    }

    // ---- APPROVE / REJECT: zincir ilerlet (per-step guard) ----
    if (action === "approve" || action === "reject") {
      if (existingRequest.status !== "PENDING") {
        return NextResponse.json({ error: "Sadece bekleyen talepler için onay işlemi yapılabilir" }, { status: 400 });
      }
      const approvals = await prisma.personnelRequestApproval.findMany({
        where: { personnelRequestId: id },
        orderBy: { step: "asc" },
      });
      const pending = approvals.find((a) => a.decision === null);
      if (!pending) {
        return NextResponse.json({ error: "Bu talebin onay zinciri yok (eski kayıt olabilir)." }, { status: 400 });
      }
      // PER-STEP GUARD: yalnız sıradaki adımın onaycısı karar verebilir (admin bile başkası adına onaylayamaz).
      if (pending.approverId !== userId) {
        return NextResponse.json({ error: "Bu adımın onayı sizde değil." }, { status: 403 });
      }

      if (action === "approve") {
        const isLast = pending.step === approvals.length;
        await prisma.$transaction(async (tx) => {
          await tx.personnelRequestApproval.update({
            where: { id: pending.id },
            data: { decision: "APPROVED", decidedAt: new Date(), comment: body.approvalNotes ?? null },
          });
          if (isLast) {
            await tx.personnelRequest.update({
              where: { id },
              data: {
                status: "APPROVED" as PersonnelRequestStatus,
                approvedById: userId,
                approvedByEmail: userEmail,
                approvedByName: session.user.name || "",
                approvedAt: new Date(),
                approvalNotes: body.approvalNotes ?? null,
              },
            });
          }
        });
        if (isLast) {
          // Son onay = İK Müdürü → talep APPROVED. Talep sahibine + İK EKİBİNE bilgi.
          await notifyApprover(existingRequest.requesterId, existingRequest.requestNumber, existingRequest.title, "ONAYLANDI");
          await notifyHrTeam(existingRequest.requestNumber, existingRequest.title);
        } else {
          const next = approvals.find((a) => a.step === pending.step + 1);
          if (next?.approverId) {
            await notifyApprover(next.approverId, existingRequest.requestNumber, existingRequest.title, "SIRA");
          }
        }
        return NextResponse.json({ ok: true, tamamlandi: isLast });
      }

      // reject
      if (!body.rejectionReason) {
        return NextResponse.json({ error: "Red gerekçesi zorunludur" }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        await tx.personnelRequestApproval.update({
          where: { id: pending.id },
          data: { decision: "REJECTED", decidedAt: new Date(), comment: body.rejectionReason },
        });
        await tx.personnelRequest.update({
          where: { id },
          data: {
            status: "REJECTED" as PersonnelRequestStatus,
            rejectedById: userId,
            rejectedByEmail: userEmail,
            rejectedByName: session.user.name || "",
            rejectedAt: new Date(),
            rejectionReason: body.rejectionReason,
          },
        });
      });
      await notifyApprover(existingRequest.requesterId, existingRequest.requestNumber, existingRequest.title, "REDDEDILDI");
      return NextResponse.json({ ok: true });
    }

    let updateData: any = {};

    switch (action) {
      case "cancel":
        if (!["DRAFT", "PENDING"].includes(existingRequest.status)) {
          return NextResponse.json({ error: "Bu talep iptal edilemez" }, { status: 400 });
        }
        updateData = {
          status: "CANCELLED" as PersonnelRequestStatus
        };
        break;

      case "update":
        // Sadece DRAFT durumundaki talepler güncellenebilir
        if (existingRequest.status !== "DRAFT" && !hasFullAccess) {
          return NextResponse.json({ error: "Sadece taslak talepler güncellenebilir" }, { status: 400 });
        }
        // IV-FR-24 alan doğrulama (yaş min<=max dahil). Şemadaki yeni alanları kapsar.
        const upKontrol = talepAlanlariSchema.safeParse(body);
        if (!upKontrol.success) {
          return NextResponse.json(
            { error: upKontrol.error.issues[0]?.message || "Geçersiz alan." },
            { status: 400 }
          );
        }
        // yardımcı: undefined ise mevcut değeri koru
        const koru = (yeni: unknown, mevcut: unknown) => (yeni !== undefined ? yeni : mevcut);
        // İV kapanış bölümü İK tarafından dolduruldu mu? (onay damgası için)
        const ivKapanisGonderildi =
          hasFullAccess &&
          ["adayKaynaklari", "ilanPortallari", "adayKaynagiDiger", "kadroDoldurulmaTarihi", "iseBaslayanPersonelAdi"].some(
            (k) => body[k] !== undefined
          );
        updateData = {
          title: body.title ?? existingRequest.title,
          // Pozisyon kaynağı (07.10.2026): yalnız `title` ile birlikte gönderilirse
          // güncellenir; tek başına gönderilen kod yoksayılır (metinle çelişmesin).
          // "Şemada yok" işareti kodu DAİMA siler — iki alan birbirini dışlar.
          ...(body.title !== undefined
            ? body.pozisyonSemadaYok === true
              ? { pozisyonOrgKodu: null, pozisyonSemadaYok: true }
              : body.pozisyonOrgKodu !== undefined
                ? { pozisyonOrgKodu: body.pozisyonOrgKodu || null, pozisyonSemadaYok: false }
                : {}
            : {}),
          requestType: body.requestType ?? existingRequest.requestType,
          headcount: body.headcount ?? existingRequest.headcount,
          employmentType: body.employmentType ?? existingRequest.employmentType,
          justification: body.justification ?? existingRequest.justification,
          responsibilities: body.responsibilities !== undefined ? body.responsibilities : existingRequest.responsibilities,
          requirements: body.requirements !== undefined ? body.requirements : existingRequest.requirements,
          preferredStartDate: body.preferredStartDate !== undefined
            ? (body.preferredStartDate ? new Date(body.preferredStartDate) : null)
            : existingRequest.preferredStartDate,
          location: body.location !== undefined ? body.location : existingRequest.location,
          workModel: body.workModel !== undefined ? body.workModel : existingRequest.workModel,
          // Maaş/bütçe YALNIZ recruitment.admin (İK) tarafından güncellenir. Talep sahibi
          // (birim müdürü) body'de gönderse bile YOKSAYILIR (mevcut değer korunur).
          salaryMin: hasFullAccess && body.salaryMin !== undefined ? body.salaryMin : existingRequest.salaryMin,
          salaryMax: hasFullAccess && body.salaryMax !== undefined ? body.salaryMax : existingRequest.salaryMax,
          hasBudget: hasFullAccess && body.hasBudget !== undefined ? body.hasBudget : existingRequest.hasBudget,
          priority: body.priority ?? existingRequest.priority,
          // ── IV-FR-24 talep eden alanları (undefined ise mevcut korunur) ──
          formHazirlanmaTarihi: body.formHazirlanmaTarihi !== undefined ? tarihDon(body.formHazirlanmaTarihi) : existingRequest.formHazirlanmaTarihi,
          ikTeslimTarihi: body.ikTeslimTarihi !== undefined ? tarihDon(body.ikTeslimTarihi) : existingRequest.ikTeslimTarihi,
          kisilikOzellikleri: koru(body.kisilikOzellikleri, existingRequest.kisilikOzellikleri),
          egitimSeviyesi: koru(body.egitimSeviyesi, existingRequest.egitimSeviyesi),
          egitimDiger: koru(body.egitimDiger, existingRequest.egitimDiger),
          tecrubeDurumu: koru(body.tecrubeDurumu, existingRequest.tecrubeDurumu),
          tecrubeSuresi: koru(body.tecrubeSuresi, existingRequest.tecrubeSuresi),
          yabanciDilGerekli: koru(body.yabanciDilGerekli, existingRequest.yabanciDilGerekli),
          yabanciDiller: koru(body.yabanciDiller, existingRequest.yabanciDiller),
          bilgisayarBilgisi: koru(body.bilgisayarBilgisi, existingRequest.bilgisayarBilgisi),
          kaliteSistemBilgisi: koru(body.kaliteSistemBilgisi, existingRequest.kaliteSistemBilgisi),
          ehliyetGerekli: koru(body.ehliyetGerekli, existingRequest.ehliyetGerekli),
          ehliyetSinifi: koru(body.ehliyetSinifi, existingRequest.ehliyetSinifi),
          digerBelgeIhtiyaci: koru(body.digerBelgeIhtiyaci, existingRequest.digerBelgeIhtiyaci),
          cinsiyetTercihi: koru(body.cinsiyetTercihi, existingRequest.cinsiyetTercihi),
          yasAraligiMin: koru(body.yasAraligiMin, existingRequest.yasAraligiMin),
          yasAraligiMax: koru(body.yasAraligiMax, existingRequest.yasAraligiMax),
          askerlikGerekli: koru(body.askerlikGerekli, existingRequest.askerlikGerekli),
          ayrilanPersonelAdi: koru(body.ayrilanPersonelAdi, existingRequest.ayrilanPersonelAdi),
          // ── İnsan Varlıkları KAPANIŞ alanları — YALNIZ recruitment.admin (İK). Talep
          //    eden (birim müdürü) body'de gönderse bile YOKSAYILIR (mevcut değer korunur). ──
          adayKaynaklari: hasFullAccess && body.adayKaynaklari !== undefined ? body.adayKaynaklari : existingRequest.adayKaynaklari,
          ilanPortallari: hasFullAccess && body.ilanPortallari !== undefined ? body.ilanPortallari : existingRequest.ilanPortallari,
          adayKaynagiDiger: hasFullAccess && body.adayKaynagiDiger !== undefined ? body.adayKaynagiDiger : existingRequest.adayKaynagiDiger,
          kadroDoldurulmaTarihi: hasFullAccess && body.kadroDoldurulmaTarihi !== undefined ? tarihDon(body.kadroDoldurulmaTarihi) : existingRequest.kadroDoldurulmaTarihi,
          iseBaslayanPersonelAdi: hasFullAccess && body.iseBaslayanPersonelAdi !== undefined ? body.iseBaslayanPersonelAdi : existingRequest.iseBaslayanPersonelAdi,
          // ivOnay: İV kapanışını dolduran İK kullanıcısı SUNUCU tarafında damgalanır.
          // Kimlik client'tan ALINMAZ (body.ivOnayId yoksayılır) — userId + server saati.
          ivOnayId: ivKapanisGonderildi ? userId : existingRequest.ivOnayId,
          ivOnayTarihi: ivKapanisGonderildi ? new Date() : existingRequest.ivOnayTarihi,
        };
        break;

      case "create_opening":
        // Onaylanan talepten ilan oluştur
        if (!hasFullAccess) {
          return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
        }
        if (existingRequest.status !== "APPROVED") {
          return NextResponse.json({ error: "Sadece onaylanan taleplerden ilan oluşturulabilir" }, { status: 400 });
        }

        // İlan kodu oluştur
        const year = new Date().getFullYear();
        const codePrefix = `JOB-${year}-`;
        const lastOpening = await prisma.jobOpening.findFirst({
          where: { code: { startsWith: codePrefix } },
          orderBy: { code: "desc" }
        });
        let nextNum = 1;
        if (lastOpening) {
          const lastNum = parseInt(lastOpening.code.replace(codePrefix, ""), 10);
          nextNum = lastNum + 1;
        }
        const jobCode = `${codePrefix}${nextNum.toString().padStart(3, "0")}`;

        // İlanı oluştur
        // ⚠️ AYRIMCILIK KORUMASI: cinsiyetTercihi, yasAraligiMin, yasAraligiMax alanları
        // BİLİNÇLİ OLARAK taşınmaz. Bunlar yalnız İÇ kadro planlaması içindir; iş ilanına
        // (JobOpening) çıkarsa ayrımcı ilan olur. SONRADAN buraya EKLEMEYİN.
        const jobOpening = await prisma.jobOpening.create({
          data: {
            code: jobCode,
            title: existingRequest.title,
            department: existingRequest.department,
            location: existingRequest.location,
            employmentType: existingRequest.employmentType,
            description: existingRequest.justification,
            responsibilities: existingRequest.responsibilities,
            requirements: existingRequest.requirements,
            salaryMin: existingRequest.salaryMin,
            salaryMax: existingRequest.salaryMax,
            headcount: existingRequest.headcount,
            priority: existingRequest.priority,
            status: "DRAFT",
            hiringManagerEmail: existingRequest.requesterEmail,
            hiringManagerName: existingRequest.requesterName,
            createdBy: userId,
            createdByName: session.user.name || ""
          }
        });

        // Talebi güncelle
        updateData = {
          status: "IN_PROGRESS" as PersonnelRequestStatus,
          jobOpeningId: jobOpening.id
        };
        break;

      default:
        return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
    }

    const updatedRequest = await prisma.personnelRequest.update({
      where: { id },
      data: updateData,
      include: {
        jobOpening: {
          select: {
            id: true,
            title: true,
            code: true,
            status: true
          }
        }
      }
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error("Talep güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Talep güncellenirken hata oluştu" },
      { status: 500 }
    );
  }
}

// DELETE - Talebi sil (SOFT DELETE, 22.09.2026)
//
// Yetki: recruitment.admin izni VEYA SUPER_ADMIN rolü. Talep sahibi/DRAFT
// istisnası KALKTI — silme yalnız yönetici işlemi (Melih kararı).
// Kural: bağlı işe alım kaydı varsa REDDET (409) — ilan (jobOpeningId), ilana
// başvuru, ya da İV kapanış bölümünde işe başlayan kişi/kadro doldurulma tarihi.
// Satır silinmez: silindiMi=true + silenId + silinmeTarihi; listeler/detay/export/
// pdf silindiMi=false süzer. Onay satırları (PersonnelRequestApproval) yerinde
// kalır (iz). Denetim: PERSONNEL_REQUEST / PERSONNEL_REQUEST_SOFT_DELETE.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const { id } = await params;
    const perms = session.user.permissions ?? [];
    const yetkili = perms.includes("recruitment.admin") || session.user.role === "SUPER_ADMIN";
    if (!yetkili) {
      return NextResponse.json({ error: "Talep silme yalnız İşe Alım yöneticisi / süper yönetici yetkisindedir" }, { status: 403 });
    }

    const existingRequest = await prisma.personnelRequest.findUnique({
      where: { id },
      include: { jobOpening: { select: { id: true, code: true, title: true, _count: { select: { applications: true } } } } },
    });

    if (!existingRequest || existingRequest.silindiMi) {
      return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
    }

    // Bağ kontrolü — sebep kullanıcıya gösterilir.
    const engeller: string[] = [];
    if (existingRequest.jobOpening) {
      const basvuru = existingRequest.jobOpening._count.applications;
      engeller.push(
        `Talebe bağlı iş ilanı var (${existingRequest.jobOpening.code ?? existingRequest.jobOpening.title})` +
          (basvuru > 0 ? ` ve ilana ${basvuru} başvuru bağlı` : ""),
      );
    }
    if (existingRequest.iseBaslayanPersonelAdi || existingRequest.kadroDoldurulmaTarihi) {
      engeller.push("İV kapanış bölümünde işe başlayan personel / kadro doldurulma tarihi kayıtlı");
    }
    if (engeller.length > 0) {
      return NextResponse.json(
        { error: "Bu talep silinemez: " + engeller.join("; ") + ". Önce bağlı işe alım kaydını kaldırın.", engeller },
        { status: 409 },
      );
    }

    const simdi = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.personnelRequest.update({
        where: { id },
        data: { silindiMi: true, silenId: session.user.id, silinmeTarihi: simdi },
      });
      await logAuditEvent({
        tx,
        actorId: session.user.id,
        action: "PERSONNEL_REQUEST_SOFT_DELETE",
        targetType: "PERSONNEL_REQUEST",
        targetId: id,
        details: {
          requestNumber: existingRequest.requestNumber,
          status: existingRequest.status,
          department: existingRequest.department,
          title: existingRequest.title,
          requesterEmail: existingRequest.requesterEmail,
          silinmeTarihi: simdi.toISOString(),
        },
      });
    });

    return NextResponse.json({ message: "Talep silindi", id, silinmeTarihi: simdi.toISOString() });
  } catch (error) {
    console.error("Talep silme hatası:", error);
    return NextResponse.json(
      { error: "Talep silinirken hata oluştu" },
      { status: 500 }
    );
  }
}
