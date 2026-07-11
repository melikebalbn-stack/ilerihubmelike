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

// GET — Time-to-Hire metrikleri (appliedAt → startDate) + Hedef Aşımı + pozisyon tablosu.
// Yalnız main verisi: JobApplication + Position. Sandbox tabloları okunmaz.
// JobOpening → Position navigation yok; positionId ile kod tarafında join edilir.
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const { isAdmin, canViewByDept } = recruitAccess(session);
  if (!isAdmin && !canViewByDept) {
    return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
  }

  const [basvurular, pozisyonlarDb] = await Promise.all([
    prisma.jobApplication.findMany({
      select: {
        appliedAt: true,
        startDate: true,
        jobOpening: { select: { positionId: true } },
      },
    }),
    prisma.position.findMany({
      select: { id: true, title: true, department: true, hedefTimeToHire: true },
    }),
  ]);

  const posById = new Map(pozisyonlarDb.map((p) => [p.id, p]));
  const simdi = Date.now();
  const gunFarki = (bitis: Date, baslangic: Date) =>
    Math.round((new Date(bitis).getTime() - new Date(baslangic).getTime()) / GUN);

  // (a) Ort. Time-to-Hire = ortalama(startDate − appliedAt), yalnız startDate dolu olanlar.
  const iseBaslayanGunler = basvurular
    .filter((b) => b.startDate)
    .map((b) => gunFarki(b.startDate as Date, b.appliedAt));
  const ortalamaTimeToHire = ortala(iseBaslayanGunler);

  // (b) Hedef Aşımı = startDate boş (devam eden) için (bugün − appliedAt) > pozisyon hedefi.
  // Hedefi NULL olan / pozisyonsuz başvurular aşımdan hariç.
  let hedefAsimiSayisi = 0;
  for (const b of basvurular) {
    if (b.startDate) continue;
    const pozId = b.jobOpening.positionId;
    const hedef = pozId ? posById.get(pozId)?.hedefTimeToHire : null;
    if (hedef == null) continue;
    if (Math.round((simdi - new Date(b.appliedAt).getTime()) / GUN) > hedef) hedefAsimiSayisi++;
  }

  // (c) Pozisyon-bazlı tablo: her Position → hedef vs o pozisyona başvuranların ort. gerçekleşen süresi.
  const acc = new Map<string, { gunler: number[]; basvuru: number }>();
  for (const b of basvurular) {
    const pozId = b.jobOpening.positionId;
    if (!pozId || !posById.has(pozId)) continue;
    let a = acc.get(pozId);
    if (!a) { a = { gunler: [], basvuru: 0 }; acc.set(pozId, a); }
    a.basvuru++;
    if (b.startDate) a.gunler.push(gunFarki(b.startDate as Date, b.appliedAt));
  }
  const pozisyonlar = [...acc.entries()].map(([id, a]) => {
    const p = posById.get(id)!;
    return {
      id,
      title: p.title,
      department: p.department,
      hedef: p.hedefTimeToHire ?? null,
      basvuru: a.basvuru,
      ortalamaTimeToHire: ortala(a.gunler),
    };
  });

  return NextResponse.json({
    ozet: { ortalamaTimeToHire, hedefAsimiSayisi },
    pozisyonlar,
  });
}
