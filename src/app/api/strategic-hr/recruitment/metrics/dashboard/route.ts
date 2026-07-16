import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

function recruitAccess(session: { user: { permissions?: string[] } }) {
  const perms = session.user.permissions ?? [];
  return { isAdmin: perms.includes("recruitment.admin"), canView: perms.includes("recruitment.view") };
}

const GUN = 1000 * 60 * 60 * 24;
const ortala = (d: number[]): number | null => (d.length ? Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 10) / 10 : null);
const r2 = (n: number) => Math.round(n * 100) / 100;

// Form-öncesi (taslak) ve terminal durumlar
const TASLAK = new Set(["CONSENT_PENDING", "HEALTH_PENDING"]);
const ISE_ALINDI = new Set(["ACCEPTED", "TEKLIF_KABUL", "ISE_BASLADI"]);
const TERMINAL = new Set(["ACCEPTED", "REJECTED", "TEKLIF_KABUL", "ISE_BASLADI"]);
// Huni sırası (form tamamlanan → işe başladı). Terminal REJECTED ayrı.
const HUNI_SIRA = ["PENDING", "REVIEWING", "SHORTLISTED", "SINAV", "TELEFON_MULAKATI", "IK_MULAKATI", "TEKNIK_MULAKAT", "INTERVIEW", "TEKLIF", "TEKLIF_KABUL", "ISE_BASLADI"];
const KATEGORI_ETIKET: Record<string, string> = {
  TEKLIF_REDDI: "Teklif Reddi (aday kaynaklı)",
  ISE_ALMAMA: "İşe Almama (şirket kaynaklı)",
  SUREC_KAYBI: "Süreç Kaybı",
};

// GET — Tek sayfa dashboard verisi (tek istek). Yalnız PublicJobApplication + RecruitmentCost +
// RejectionReason. JobApplication (ölü tablo) okunmaz.
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;
  const { isAdmin, canView } = recruitAccess(session);
  if (!isAdmin && !canView) return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });

  const basvurular = await prisma.publicJobApplication.findMany({
    select: {
      status: true,
      // Kaynak artık sözlükten (referralSourceId → ReferralSourceDef.name). Bağı olmayan → "Belirtilmemiş".
      referralSourceDef: { select: { name: true } },
      requestedPosition: true,
      createdAt: true,
      rejectionReason: { select: { name: true, category: true } },
      stageLogs: { select: { toStatus: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });

  const now = Date.now();
  const gf = (a: Date | number, b: Date | number) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / GUN);
  const tamam = basvurular.filter((b) => !TASLAK.has(b.status)); // form tamamlanan

  // ---- 8 KPI ----
  const toplamBasvuru = tamam.length;
  const iseBaslayan = tamam.filter((b) => ISE_ALINDI.has(b.status)).length;
  const surecte = tamam.filter((b) => !TERMINAL.has(b.status) && b.status !== "REJECTED").length;

  // Time to Hire: arrival log → işe alım log tarihi
  const tthGun: number[] = [];
  for (const b of tamam) {
    const l = b.stageLogs;
    if (!l.length) continue;
    const acc = l.find((x) => ISE_ALINDI.has(x.toStatus));
    if (acc) tthGun.push(gf(acc.createdAt, l[0].createdAt));
  }
  const ortTimeToHire = ortala(tthGun);

  const kayitlar = await prisma.recruitmentCost.findMany({ select: { amount: true } });
  const toplamMaliyet = r2(kayitlar.reduce((a, k) => a + k.amount, 0));
  const costPerHire = iseBaslayan > 0 ? r2(toplamMaliyet / iseBaslayan) : null;

  const kpi = {
    toplamBasvuru,
    surecte,
    iseBaslayan,
    hedefAsimi: null as number | null, // başvuru↔pozisyon bağı yok → hesaplanamaz "-"
    ortTimeToHire, // gün (yoksa null)
    ortTimeToFill: null as number | null, // ilan↔başvuru bağı yok → hesaplanamaz "-"
    toplamMaliyet,
    costPerHire, // null → "-"
  };

  // ---- İşe Alım Hunisi (aşama bazlı, mevcut status dağılımı) ----
  const sayimByStatus = new Map<string, number>();
  for (const b of tamam) sayimByStatus.set(b.status, (sayimByStatus.get(b.status) ?? 0) + 1);
  const huni = HUNI_SIRA.filter((s) => sayimByStatus.has(s)).map((s) => ({
    status: s,
    count: sayimByStatus.get(s) ?? 0,
    yuzde: toplamBasvuru > 0 ? Math.round(((sayimByStatus.get(s) ?? 0) / toplamBasvuru) * 100) : 0,
  }));
  const reddedilen = sayimByStatus.get("REJECTED") ?? 0;

  // ---- Kök Neden Pareto (ret nedenleri, azalan) ----
  const nedenMap = new Map<string, { count: number; category: string }>();
  for (const b of tamam) {
    if (b.status === "REJECTED" && b.rejectionReason) {
      const k = b.rejectionReason.name;
      const e = nedenMap.get(k) ?? { count: 0, category: b.rejectionReason.category };
      e.count++; nedenMap.set(k, e);
    }
  }
  const pareto = [...nedenMap.entries()]
    .map(([name, v]) => ({ name, category: v.category, categoryLabel: KATEGORI_ETIKET[v.category] ?? v.category, count: v.count }))
    .sort((a, b) => b.count - a.count);

  // ---- Pozisyon Bazlı tablo (requestedPosition serbest metin gruplaması — KABA) ----
  const posMap = new Map<string, { basvuru: number; tthGun: number[] }>();
  for (const b of tamam) {
    const p = (b.requestedPosition ?? "").trim() || "(belirtilmemiş)";
    const e = posMap.get(p) ?? { basvuru: 0, tthGun: [] };
    e.basvuru++;
    const l = b.stageLogs;
    const acc = l.find((x) => ISE_ALINDI.has(x.toStatus));
    if (acc && l.length) e.tthGun.push(gf(acc.createdAt, l[0].createdAt));
    posMap.set(p, e);
  }
  const pozisyonlar = [...posMap.entries()]
    .map(([position, v]) => ({ position, basvuru: v.basvuru, ortTimeToHire: ortala(v.tthGun), costPerHire: null as number | null }))
    .sort((a, b) => b.basvuru - a.basvuru);

  // ---- Kaynak Kırılımı (sözlükten: referralSourceDef.name; bağı yok → "Belirtilmemiş") ----
  const kaynakMap = new Map<string, { basvuru: number; iseAlinan: number }>();
  for (const b of tamam) {
    const k = b.referralSourceDef?.name ?? "Belirtilmemiş";
    const e = kaynakMap.get(k) ?? { basvuru: 0, iseAlinan: 0 };
    e.basvuru++; if (ISE_ALINDI.has(b.status)) e.iseAlinan++;
    kaynakMap.set(k, e);
  }
  const kaynaklar = [...kaynakMap.entries()]
    .map(([source, v]) => ({ source, basvuru: v.basvuru, iseAlinan: v.iseAlinan, donusum: v.basvuru ? Math.round((v.iseAlinan / v.basvuru) * 1000) / 10 : 0 }))
    .sort((a, b) => (a.source === "Belirtilmemiş" ? 1 : b.source === "Belirtilmemiş" ? -1 : b.basvuru - a.basvuru));

  return NextResponse.json({
    kpi,
    huni,
    reddedilen,
    pareto,
    pozisyonlar,
    kaynaklar,
    hesaplanamayan: ["ortTimeToFill", "hedefAsimi"], // başvuru↔ilan/pozisyon bağı yok
  });
}
