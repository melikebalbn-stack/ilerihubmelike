import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PersonnelRequestStatus } from "@/generated/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { resolveApprovers } from "@/lib/personnel-request-chain";
import { sendPushToUser } from "@/lib/push-notifications";
import { sendEmail } from "@/lib/email";

type BildirimTuru = "SIRA" | "ONAYLANDI" | "REDDEDILDI";

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
        ? `${requestNumber} numaralı "${title}" eleman talebi onayınızı bekliyor.`
        : tur === "ONAYLANDI"
          ? `${requestNumber} numaralı "${title}" eleman talebiniz onaylandı.`
          : `${requestNumber} numaralı "${title}" eleman talebiniz reddedildi.`;
    await sendPushToUser(prisma, userId, {
      title: "Eleman Talebi Onayı",
      body: mesaj,
      url: "/strategic-hr/recruitment",
      tag: `personnel-request-${requestNumber}`,
    });
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (u?.email) {
      await sendEmail([{ email: u.email, name: u.name || "" }], "Eleman Talebi Onayı", mesaj, `<p>${mesaj}</p>`);
    }
  } catch {
    // bildirim best-effort
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
    const perms = session.user.permissions ?? [];
    const isAdmin = perms.includes("recruitment.admin");
    const canViewByDept = perms.includes("recruitment.view");
    const userEmail = (session.user.email || "").toLowerCase();
    const userDepartment = session.user.department || "";

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

    if (!personnelRequest) {
      return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
    }

    // PR-RECRUIT-RBAC: admin herşeyi; departman müdürü kendi dept VEYA owner;
    // hiçbir yetkisi yoksa sadece kendi açtığı talep
    const isOwner = personnelRequest.requesterEmail.toLowerCase() === userEmail;
    const deptMatch = canViewByDept && personnelRequest.department === userDepartment;
    if (!isAdmin && !isOwner && !deptMatch) {
      return NextResponse.json({ error: "Bu talebi görüntüleme yetkiniz yok" }, { status: 403 });
    }

    return NextResponse.json(personnelRequest);
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

    // PR-RECRUIT-RBAC: hasFullAccess=admin (onay/red için)
    const perms = session.user.permissions ?? [];
    const hasFullAccess = perms.includes("recruitment.admin");

    // Mevcut talebi al
    const existingRequest = await prisma.personnelRequest.findUnique({ where: { id } });

    if (!existingRequest) {
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
      const cozum = await resolveApprovers(prisma);
      if (!cozum.ok) {
        // Sessiz boşta kalma YOK — talep PENDING'e geçmez, net hata döner.
        return NextResponse.json({ error: cozum.error }, { status: 400 });
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
          await notifyApprover(existingRequest.requesterId, existingRequest.requestNumber, existingRequest.title, "ONAYLANDI");
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
        updateData = {
          title: body.title ?? existingRequest.title,
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
          priority: body.priority ?? existingRequest.priority
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

// DELETE - Talebi sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (role/department/email session'dan)
    const { session, error } = await requireSession();
    if (error) return error;

    const { id } = await params;
    const userEmail = (session.user.email || "").toLowerCase();

    // PR-RECRUIT-RBAC: silme — admin veya talep sahibi
    const hasFullAccess = session.user.permissions?.includes("recruitment.admin") ?? false;

    const existingRequest = await prisma.personnelRequest.findUnique({ where: { id } });

    if (!existingRequest) {
      return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
    }

    // Sadece taslak talepler silinebilir
    if (existingRequest.status !== "DRAFT") {
      return NextResponse.json({ error: "Sadece taslak talepler silinebilir" }, { status: 400 });
    }

    // Yetki kontrolü - sadece talep sahibi veya admin silebilir
    if (existingRequest.requesterEmail.toLowerCase() !== userEmail && !hasFullAccess) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    await prisma.personnelRequest.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Talep başarıyla silindi" });
  } catch (error) {
    console.error("Talep silme hatası:", error);
    return NextResponse.json(
      { error: "Talep silinirken hata oluştu" },
      { status: 500 }
    );
  }
}
