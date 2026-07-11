import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

// Recruitment modülünün mevcut yetki deseni (recruitAccess) — yeni izin icat edilmez.
function recruitAccess(session: {
  user: { permissions?: string[]; department?: string | null; email?: string | null };
}) {
  const perms = session.user.permissions ?? [];
  return {
    isAdmin: perms.includes("recruitment.admin"),
    canViewByDept: perms.includes("recruitment.view"),
  };
}

const GUN = 1000 * 60 * 60 * 24;
const ortala = (dizi: number[]): number | null =>
  dizi.length === 0 ? null : Math.round((dizi.reduce((x, y) => x + y, 0) / dizi.length) * 10) / 10;

// Pipeline sırası (görünüm sırası). Terminal aşamalar kuyruk sayılmaz.
const ASAMA_SIRA = [
  "CONSENT_PENDING",
  "HEALTH_PENDING",
  "PENDING",
  "REVIEWED",
  "REVIEWING",
  "SHORTLISTED",
  "INTERVIEW",
  "ACCEPTED",
  "REJECTED",
] as const;
const TERMINAL = new Set<string>(["ACCEPTED", "REJECTED"]);

// GET — Time-to-Hire + aşama-bazlı süre/darboğaz.
// Kaynak: PublicJobApplication + PublicJobApplicationStageLog (gerçek akış).
// JobApplication/Candidate/Position OKUNMAZ. Sandbox tabloları okunmaz.
// NOT: PublicJobApplication'ın Position FK'sı YOK → pozisyon-bazlı hedef karşılaştırması
// yapılamaz (bu sürümde çıkarıldı). Position.hedefTimeToHire schema'da korunur.
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const { isAdmin, canViewByDept } = recruitAccess(session);
  if (!isAdmin && !canViewByDept) {
    return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
  }

  const basvurular = await prisma.publicJobApplication.findMany({
    select: {
      status: true,
      createdAt: true,
      stageLogs: {
        select: { toStatus: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const simdi = Date.now();
  const gunFarki = (bitis: Date | number, baslangic: Date | number) =>
    Math.round((new Date(bitis).getTime() - new Date(baslangic).getTime()) / GUN);

  // (A) İşe alım süresi = ACCEPTED log tarihi − ilk (arrival) log tarihi. Yalnız ACCEPTED'a
  // ulaşanlar. ACCEPTED yoksa hesaplanmaz → null → panel "-". (0'a bölme yok.)
  const tthGunler: number[] = [];
  for (const b of basvurular) {
    const logs = b.stageLogs;
    if (logs.length === 0) continue;
    const arrival = logs[0].createdAt;
    const accepted = logs.find((l) => l.toStatus === "ACCEPTED");
    if (accepted) tthGunler.push(gunFarki(accepted.createdAt, arrival));
  }
  const ortalamaTimeToHire = ortala(tthGunler);

  // (B) Aşama-bazlı: (1) şu an bekleyen + ort. bekleme (girişten bugüne), (2) tamamlanmış
  // geçişlerde ort. o aşamada geçen gün (girişten çıkışa). Uydurma yok — log tarihleri.
  const bekleme = new Map<string, number[]>(); // current queue waiting-days (non-terminal)
  const gecis = new Map<string, number[]>(); // completed time-in-status

  for (const b of basvurular) {
    const logs = b.stageLogs;

    // (1) Şu anki (authoritative) status'a giriş anı = toStatus===status olan SON log satırı.
    //     Yoksa başvuru geliş anı (createdAt). Terminal statüler kuyruk sayılmaz.
    if (!TERMINAL.has(b.status)) {
      let girisLog: Date | null = null;
      for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].toStatus === b.status) { girisLog = logs[i].createdAt; break; }
      }
      const giris = girisLog ?? b.createdAt;
      const arr = bekleme.get(b.status) ?? [];
      arr.push(gunFarki(simdi, giris));
      bekleme.set(b.status, arr);
    }

    // (2) Tamamlanmış geçişler: ardışık log çiftleri → logs[i].toStatus aşamasında geçen süre.
    for (let i = 0; i < logs.length - 1; i++) {
      const asama = logs[i].toStatus;
      const sure = gunFarki(logs[i + 1].createdAt, logs[i].createdAt);
      const arr = gecis.get(asama) ?? [];
      arr.push(sure);
      gecis.set(asama, arr);
    }
  }

  const asamalar = ASAMA_SIRA.filter((s) => bekleme.has(s) || gecis.has(s)).map((s) => ({
    status: s,
    bekleyen: bekleme.get(s)?.length ?? 0,
    ortBekleme: ortala(bekleme.get(s) ?? []),
    ortGecis: ortala(gecis.get(s) ?? []),
  }));

  return NextResponse.json({
    ozet: {
      ortalamaTimeToHire,
      iseAlinanSayisi: tthGunler.length,
      toplamBasvuru: basvurular.length,
    },
    // Eşik: ort. bekleme > 30 gün darboğaz (panelde kırmızı).
    beklemeEsikGun: 30,
    asamalar,
  });
}
