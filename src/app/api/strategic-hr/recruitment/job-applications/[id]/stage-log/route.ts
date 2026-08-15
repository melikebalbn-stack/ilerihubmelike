import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { resolveTransitionRolesFull } from "@/lib/recruitment/resolve-roles";
import { otomatikAtamaOnizleme } from "@/lib/recruitment/otomatik-atama";
import {
  allowedTargetsForRoles,
  formGerektirenleriSuz,
  requiresAssignedManager,
  requiresRejectionReason,
  requiresAssessment,
} from "@/lib/recruitment/transitions";
import { bekleyenTaraf, kararSizdeMi, terminalMi, kullaniciAdi } from "@/lib/recruitment/bekleyen";
import { bayragaGoreSuz } from "@/lib/recruitment/adaya-geri-gonder";
import { ikiKademeSuz } from "@/lib/recruitment/teknik-mulakat-bayrak";
import { donusturSuz } from "@/lib/recruitment/personele-donustur-bayrak";

export const dynamic = "force-dynamic";

// GET — Başvuru aşama geçmişi (StageLog) + kullanıcının bu başvuru üzerindeki WORKFLOW bağlamı.
//
// Middleware /api/* KAPSAMAZ → route içi guard zorunlu (transition route ile aynı desen).
// Yetki: İK (recruitment.admin / hr.admin) VEYA atanan müdür. İkisi de değilse 403.
// İzin hesabı yalnız SUNUCUDA (resolveTransitionRoles + allowedTargetsForRoles) — client
// yetki hesaplamaz; butonlarını buradan dönen allowedTargets'tan türetir.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;

  // Başvuru + atanan müdür (rol belirleme için).
  const application = await prisma.publicJobApplication.findUnique({
    where: { id },
    select: { id: true, status: true, assignedManagerId: true },
  });
  if (!application) {
    return NextResponse.json({ error: "Başvuru bulunamadı" }, { status: 404 });
  }

  // Rol(ler) — TEK KAYNAK (transition route ile aynı helper).
  const roles = await resolveTransitionRolesFull({
    permissions: session.user.permissions,
    userId: session.user.id,
    assignedManagerId: application.assignedManagerId,
    // Faz 4: teknik mülakat rolleri bekleyen approval satırından çözülür.
    applicationId: id,
  });
  if (roles.length === 0) {
    return NextResponse.json({ error: "Bu başvuruyu görüntüleme yetkiniz yok" }, { status: 403 });
  }

  // StageLog kayıtları (createdAt ASC). changedBy düz String id (User relation'ı yok),
  // bu yüzden manuel join: id'leri topla → User adı/unvanı çek → eşle. Ham id dönmez.
  const rows = await prisma.publicJobApplicationStageLog.findMany({
    where: { applicationId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      createdAt: true,
      changedBy: true,
    },
  });

  // changedBy id'leri + atanan müdür TEK sorguda çözülür (ayrı fetch yok).
  const userIds = [
    ...new Set(
      [...rows.map((r) => r.changedBy), application.assignedManagerId].filter(
        (x): x is string => !!x,
      ),
    ),
  ];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, firstName: true, lastName: true, email: true, jobTitle: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const logs = rows.map((r) => {
    const u = r.changedBy ? userById.get(r.changedBy) : undefined;
    return {
      id: r.id,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      note: r.note,
      createdAt: r.createdAt,
      changedByName: kullaniciAdi(u),
      changedByTitle: u?.jobTitle ?? null,
    };
  });

  // Workflow bağlamı: bu durumdan rollerin geçebileceği hedefler + hangi hedef ek girdi ister.
  // Faz 1 bayrağı: RECRUITMENT_ADAYA_GERI_GONDER_ENABLED kapalıyken ADAYA_GERI_GONDERILDI
  // hedefi listeden DÜŞER → UI butonu hiç çizmez. Gerçek engelleme geçiş ucunda (403).
  // Faz 6 bayrağı da aynı zincire eklenir: kapalıyken EVRAK_HAZIRLIK butonu hiç çizilmez.
  // formGerektirenleriSuz: ISE_BASLADI genel geçiş butonu olarak ÇİZİLMEZ — o statüye
  // yalnız "Personele Dönüştür" formundan gidilir (transitions.ts · SADECE_FORMLA).
  const allowedTargets = formGerektirenleriSuz(
    donusturSuz(ikiKademeSuz(bayragaGoreSuz(allowedTargetsForRoles(application.status, roles)))),
  );
  const requiresManagerTargets = allowedTargets.filter(requiresAssignedManager);
  const requiresReasonTargets = allowedTargets.filter(requiresRejectionReason);
  const requiresAssessmentTargets = allowedTargets.filter(requiresAssessment);
  // Otomatik atamalı hedefler: modal kişi SORMAZ, bunun yerine kime gideceğini gösterir.
  // hazir=false → atama yapılamayacak (departman/kişi eksik); UI uyarır, geçiş 400 döner.
  const otomatikAtamaHedefleri = await otomatikAtamaOnizleme(allowedTargets);

  // "Kimde bekliyor" — kural src/lib/recruitment/bekleyen.ts (liste ucuyla TEK KAYNAK).
  // beri: son geçişin zamanı; terminal statüde bekleyen null döner (satır gösterilmez).
  const bekleyen = bekleyenTaraf(
    application.status,
    kullaniciAdi(application.assignedManagerId ? userById.get(application.assignedManagerId) : undefined),
  );
  const sonGecis = rows.length > 0 ? rows[rows.length - 1].createdAt : null;

  // FAZ 5 — "karar SENDE" bilgisi SUNUCUDA hesaplanır (client rol/statü kuralı yürütmez).
  // Kural bekleyen.ts'te matristen türer; müdür, teknik mülakatçı ve üst amiri birden kapsar.
  const kararSizde = kararSizdeMi(application.status, roles);

  // FAZ 4 — teknik mülakat onay zinciri görünümü: kim, hangi kademe, karar, yorum, tarih.
  // Onaycı adı manuel join (User relation'ı select'te alınıyor) — ham id dışa verilmez.
  const onaylar = await prisma.publicJobApplicationApproval.findMany({
    where: { applicationId: id },
    orderBy: { step: "asc" },
    select: {
      step: true,
      kademe: true,
      role: true,
      decision: true,
      comment: true,
      decidedAt: true,
      createdAt: true,
      approver: { select: { name: true, firstName: true, lastName: true, email: true } },
    },
  });
  const onayZinciri = onaylar.map((o) => ({
    step: o.step,
    kademe: o.kademe,
    role: o.role,
    onaycıAdi: kullaniciAdi(o.approver),
    decision: o.decision,
    comment: o.comment,
    decidedAt: o.decidedAt,
    createdAt: o.createdAt,
  }));

  return NextResponse.json({
    logs,
    onayZinciri,
    bekleyen: bekleyen ? { ...bekleyen, beri: sonGecis, siz: kararSizde } : null,
    workflow: {
      currentStatus: application.status,
      roles,
      allowedTargets,
      // isTerminal: "BU KULLANICININ yapabilecegi islem yok" (hedef listesi bos).
      // surecBitti: "SURECIN KENDISI bitti" — hicbir rolun cikisi yok (bekleyen.ts · terminalMi).
      // Faz 5'ten sonra müdür olumsuz görüş verip REVIEWING'e döndüğünde ilki TRUE, ikincisi
      // FALSE olur; ekran "başvuru sonuçlandı" DEMEMELİ — süreç İV'de devam ediyor.
      isTerminal: allowedTargets.length === 0,
      surecBitti: terminalMi(application.status),
      assignedManagerId: application.assignedManagerId,
      requiresManagerTargets,
      requiresReasonTargets,
      requiresAssessmentTargets,
      otomatikAtamaHedefleri,
    },
  });
}
