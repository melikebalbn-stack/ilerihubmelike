import { prisma } from "@/lib/prisma";
import { siniflandirDurum, type AtamaDurum } from "./atama-model";
import { normalizeTr } from "@/lib/normalize-tr";

export type KursKisi = {
  userAssignmentId: string;
  userId: string;
  ad: string;
  departman: string;
  yaka: string | null;
  atandi: string;
  dueDate: string | null;
  ilerleme: number;
  durum: AtamaDurum;
};

export type KisiFiltre = {
  search?: string;
  durum?: string; // all | BASLAMADI | ...
  departman?: string; // all | <ad>
  yaka?: string; // all | MAVI | ...
};

/**
 * Bir kursun atanmış kişileri + durum sınıflaması, filtrelenmiş (sayfalama YOK).
 * kişiler API'si sayfalar; Excel export tam listeyi kullanır. Kurs seçilmeden çağrılmaz.
 */
export async function kursKisileri(
  courseId: string,
  filtre: KisiFiltre,
  now: Date = new Date()
): Promise<{
  hepsi: KursKisi[];
  filtreli: KursKisi[];
  durumSayilar: Record<string, number>;
  departmanlar: string[];
  yakalar: string[];
}> {
  const containers = await prisma.courseAssignment.findMany({ where: { courseId }, select: { id: true } });
  if (!containers.length) {
    return { hepsi: [], filtreli: [], durumSayilar: { all: 0 }, departmanlar: [], yakalar: [] };
  }

  const uca = await prisma.userCourseAssignment.findMany({
    where: { assignmentId: { in: containers.map((c) => c.id) } },
    select: {
      id: true,
      userId: true,
      dueDate: true,
      assignedAt: true,
      user: {
        select: {
          name: true,
          email: true,
          department: true,
          personnel: { select: { adSoyad: true, bolum: true, yakaRengi: true } },
        },
      },
    },
  });

  const progress = await prisma.courseProgress.findMany({
    where: { courseId, userId: { in: uca.map((a) => a.userId) } },
    select: { userId: true, percentage: true, completedAt: true },
  });
  const progMap = new Map(progress.map((p) => [p.userId, p]));

  const hepsi: KursKisi[] = uca.map((a) => {
    const p = progMap.get(a.userId);
    const ilerleme = p?.percentage ?? 0;
    const isCompleted = Boolean(p?.completedAt);
    return {
      userAssignmentId: a.id,
      userId: a.userId,
      ad: a.user.personnel?.adSoyad ?? a.user.name ?? a.user.email ?? "—",
      departman: a.user.personnel?.bolum ?? a.user.department ?? "—",
      yaka: a.user.personnel?.yakaRengi ?? null,
      atandi: a.assignedAt.toISOString(),
      dueDate: a.dueDate ? a.dueDate.toISOString() : null,
      ilerleme: Math.round(ilerleme),
      durum: siniflandirDurum({ progressPercent: ilerleme, isCompleted, dueDate: a.dueDate }, now),
    };
  });

  const departmanlar = [...new Set(hepsi.map((k) => k.departman))].filter((d) => d !== "—").sort((a, b) => a.localeCompare(b, "tr"));
  const yakalar = [...new Set(hepsi.map((k) => k.yaka).filter(Boolean))] as string[];
  const durumSayilar: Record<string, number> = { all: hepsi.length, BASLAMADI: 0, DEVAM: 0, BITTI: 0, GECIKTI: 0 };
  for (const k of hepsi) durumSayilar[k.durum]++;

  const q = normalizeTr(filtre.search ?? "");
  let filtreli = hepsi;
  if (filtre.durum && filtre.durum !== "all") filtreli = filtreli.filter((k) => k.durum === filtre.durum);
  if (filtre.departman && filtre.departman !== "all") filtreli = filtreli.filter((k) => k.departman === filtre.departman);
  if (filtre.yaka && filtre.yaka !== "all") filtreli = filtreli.filter((k) => k.yaka === filtre.yaka);
  if (q) filtreli = filtreli.filter((k) => normalizeTr(`${k.ad} ${k.departman}`).includes(q));

  return { hepsi, filtreli, durumSayilar, departmanlar, yakalar };
}
