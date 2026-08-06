import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { format } from "date-fns";
import {
  generateKadroTalepPdfBuffer,
  type KadroTalepForPDF,
} from "@/lib/pdf/kadro-talep-pdf";

// GET .../personnel-requests/[id]/pdf — IV-FR-24 PDF çıktısı.
// Yetki: talebi oluşturan VEYA onay zincirindeki onaycı VEYA recruitment.admin/hr.admin.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession();
    if (error) return error; // oturumsuz → 401

    const { id } = await params;

    const pr = await prisma.personnelRequest.findUnique({
      where: { id },
      include: {
        approvals: {
          orderBy: { step: "asc" },
          include: { approver: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!pr) {
      return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
    }

    // Yetki (mevcut desen): admin / owner / onay zincirindeki onaycı. Client'ta hesaplanmaz.
    const perms = session.user.permissions ?? [];
    const isAdmin =
      perms.includes("recruitment.admin") || perms.includes("hr.admin");
    const userEmail = (session.user.email || "").toLowerCase();
    const isOwner = pr.requesterEmail.toLowerCase() === userEmail;
    const isApprover = pr.approvals.some(
      (a) => (a.approver?.email || "").toLowerCase() === userEmail
    );
    if (!isAdmin && !isOwner && !isApprover) {
      return NextResponse.json(
        { error: "Bu talebin PDF'ini görüntüleme yetkiniz yok" },
        { status: 403 }
      );
    }

    // İnsan Varlıkları onaycısının adı (ivOnayId düz String = userId).
    let ivOnayName: string | null = null;
    if (pr.ivOnayId) {
      const u = await prisma.user.findUnique({
        where: { id: pr.ivOnayId },
        select: { name: true },
      });
      ivOnayName = u?.name ?? null;
    }

    const data: KadroTalepForPDF = {
      requestNumber: pr.requestNumber,
      status: pr.status,
      department: pr.department,
      title: pr.title,
      headcount: pr.headcount,
      formHazirlanmaTarihi: pr.formHazirlanmaTarihi,
      ikTeslimTarihi: pr.ikTeslimTarihi,
      preferredStartDate: pr.preferredStartDate,
      responsibilities: pr.responsibilities,
      kisilikOzellikleri: pr.kisilikOzellikleri,
      egitimSeviyesi: pr.egitimSeviyesi,
      egitimDiger: pr.egitimDiger,
      tecrubeDurumu: pr.tecrubeDurumu,
      tecrubeSuresi: pr.tecrubeSuresi,
      yabanciDilGerekli: pr.yabanciDilGerekli,
      yabanciDiller: pr.yabanciDiller,
      bilgisayarBilgisi: pr.bilgisayarBilgisi,
      kaliteSistemBilgisi: pr.kaliteSistemBilgisi,
      ehliyetGerekli: pr.ehliyetGerekli,
      ehliyetSinifi: pr.ehliyetSinifi,
      digerBelgeIhtiyaci: pr.digerBelgeIhtiyaci,
      cinsiyetTercihi: pr.cinsiyetTercihi,
      yasAraligiMin: pr.yasAraligiMin,
      yasAraligiMax: pr.yasAraligiMax,
      askerlikGerekli: pr.askerlikGerekli,
      requestType: pr.requestType,
      ayrilanPersonelAdi: pr.ayrilanPersonelAdi,
      justification: pr.justification,
      adayKaynaklari: pr.adayKaynaklari,
      ilanPortallari: pr.ilanPortallari,
      adayKaynagiDiger: pr.adayKaynagiDiger,
      kadroDoldurulmaTarihi: pr.kadroDoldurulmaTarihi,
      iseBaslayanPersonelAdi: pr.iseBaslayanPersonelAdi,
      ivOnayName,
      ivOnayTarihi: pr.ivOnayTarihi,
      approvedByName: pr.approvedByName,
      approvedAt: pr.approvedAt,
      rejectedByName: pr.rejectedByName,
      rejectedAt: pr.rejectedAt,
      rejectionReason: pr.rejectionReason,
      approvals: pr.approvals.map((a) => ({
        step: a.step,
        kademe: a.kademe,
        role: a.role,
        approverName: a.approver?.name ?? null,
        decision: a.decision,
        comment: a.comment,
        decidedAt: a.decidedAt,
      })),
    };

    const buffer = generateKadroTalepPdfBuffer(data);
    const fileName = `IV-FR-24_${pr.requestNumber || pr.id}_${format(new Date(), "yyyyMMdd")}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error("Kadro talep PDF hatası:", err);
    return NextResponse.json(
      { error: "PDF oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
