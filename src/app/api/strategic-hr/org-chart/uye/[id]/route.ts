import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { logAuditEvent } from "@/lib/audit-log";
import { orgYonetimYetkisi, raporlamaDongusuVarMi } from "@/lib/org/yonetim";

// PATCH - Koltuk guncelleme: reportsToId (raporlama hatti) ve/veya personnelId
// (personele baglama).
//
// personnelId NEDEN BURADA: mevcut uye-ata ucu bu isi YAPAMIYOR — o uc kutunun
// BOS olmasini sart kosuyor ve YENI OrgEmployee olusturuyor. Personelsiz koltukta
// ise kutu DOLU ve mevcut kaydin personnelId'si doldurulacak. Yeni uc acmak yerine
// bu uca minimal alan eklendi; guard/dogrulama/audit iskeleti aynen korundu.
//
// NOT: reportsToId kolonu OrgUnit'te DEGIL, OrgEmployee'de duruyor (sema teyit
// edildi). Yani raporlama KUTULAR arasinda degil KOLTUKLAR arasinda kuruluyor.
// Bu yuzden uc .../birim/{id} degil .../uye/{orgEmployeeId} altinda; sema
// degisikligi yapilmadi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hasFullAccess } = orgYonetimYetkisi(session);
  if (!hasFullAccess) return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const reportsToGonderildi = Object.prototype.hasOwnProperty.call(body, "reportsToId");
  const personnelGonderildi = Object.prototype.hasOwnProperty.call(body, "personnelId");
  if (!reportsToGonderildi && !personnelGonderildi) {
    return NextResponse.json({ error: "reportsToId veya personnelId gönderilmedi" }, { status: 400 });
  }
  // ── personele bağlama ────────────────────────────────────────────────────
  if (personnelGonderildi) {
    const pid = body.personnelId === null || body.personnelId === "" ? null : body.personnelId;
    if (pid !== null && typeof pid !== "string") {
      return NextResponse.json({ error: "personnelId geçersiz" }, { status: 400 });
    }
    const koltukP = await prisma.orgEmployee.findUnique({
      where: { id },
      select: { id: true, displayName: true, personnelId: true, orgUnit: { select: { code: true, name: true } } },
    });
    if (!koltukP) return NextResponse.json({ error: "Üye kaydı bulunamadı" }, { status: 404 });

    let personel: { id: string; sicilNo: string | null; adSoyad: string } | null = null;
    if (pid) {
      const p = await prisma.personnel.findUnique({
        where: { id: pid },
        select: { id: true, sicilNo: true, adSoyad: true, aktif: true },
      });
      if (!p || !p.aktif) {
        return NextResponse.json({ error: "Geçersiz veya pasif personel" }, { status: 400 });
      }
      personel = { id: p.id, sicilNo: p.sicilNo, adSoyad: p.adSoyad };
    }

    const guncelP = await prisma.orgEmployee.update({
      where: { id },
      data: { personnelId: pid, ...(personel ? { displayName: personel.adSoyad } : {}) },
      select: { id: true, displayName: true, personnelId: true },
    });

    await logAuditEvent({
      action: "ORG_UYE_PERSONEL_BAGLA",
      actorId: session.user.id,
      targetType: "ORG_UNIT",
      targetId: koltukP.orgUnit?.code ?? id,
      details: {
        orgEmployeeId: id,
        kutu: `${koltukP.orgUnit?.code ?? ""} ${koltukP.orgUnit?.name ?? ""}`.trim(),
        onceDisplayName: koltukP.displayName,
        oncePersonnelId: koltukP.personnelId,
        sonraPersonnelId: pid,
        sicilNo: personel?.sicilNo ?? null,
        adSoyad: personel?.adSoyad ?? null,
      },
    });

    if (!reportsToGonderildi) {
      return NextResponse.json({ ok: true, orgEmployeeId: guncelP.id, personnelId: guncelP.personnelId, displayName: guncelP.displayName });
    }
  }

  // ── raporlama hattı ──────────────────────────────────────────────────────
  const hedefId = body.reportsToId === null || body.reportsToId === "" ? null : body.reportsToId;
  if (hedefId !== null && typeof hedefId !== "string") {
    return NextResponse.json({ error: "reportsToId geçersiz" }, { status: 400 });
  }

  const koltuk = await prisma.orgEmployee.findUnique({
    where: { id },
    select: { id: true, displayName: true, reportsToId: true, personnelId: true, orgUnit: { select: { code: true, name: true } } },
  });
  if (!koltuk) return NextResponse.json({ error: "Üye kaydı bulunamadı" }, { status: 404 });

  if (hedefId === id) {
    return NextResponse.json({ error: "Bir üye kendine rapor veremez", kod: "DONGU" }, { status: 400 });
  }

  let hedef: { id: string; displayName: string } | null = null;
  if (hedefId) {
    hedef = await prisma.orgEmployee.findUnique({ where: { id: hedefId }, select: { id: true, displayName: true } });
    if (!hedef) return NextResponse.json({ error: "Rapor verilecek üye bulunamadı" }, { status: 404 });
    if (await raporlamaDongusuVarMi(id, hedefId)) {
      return NextResponse.json(
        { error: `Döngü oluşur: "${hedef.displayName}" zaten doğrudan ya da dolaylı olarak "${koltuk.displayName}" kişisine rapor veriyor`, kod: "DONGU" },
        { status: 400 },
      );
    }
  }

  if (koltuk.reportsToId === hedefId) {
    return NextResponse.json({ ok: true, message: "Değişiklik yok", orgEmployeeId: id, reportsToId: hedefId });
  }

  const guncel = await prisma.orgEmployee.update({
    where: { id },
    data: { reportsToId: hedefId },
    select: { id: true, displayName: true, reportsToId: true },
  });

  await logAuditEvent({
    action: "ORG_RAPORLAMA_DEGISTI",
    actorId: session.user.id,
    // uye-ata/uye-tasi ile ayni: koltuk islemleri de ORG_UNIT altinda loglanir
    // (AuditTargetType'da ORG_EMPLOYEE yok; koltugun kutusu hedef olarak yazilir).
    targetType: "ORG_UNIT",
    targetId: koltuk.orgUnit?.code ?? id,
    details: {
      orgEmployeeId: id,
      displayName: koltuk.displayName,
      kutu: `${koltuk.orgUnit?.code ?? ""} ${koltuk.orgUnit?.name ?? ""}`.trim(),
      once: koltuk.reportsToId,
      sonra: hedefId,
      hedefAd: hedef?.displayName ?? null,
    },
  });

  return NextResponse.json({ ok: true, orgEmployeeId: guncel.id, reportsToId: guncel.reportsToId });
}
