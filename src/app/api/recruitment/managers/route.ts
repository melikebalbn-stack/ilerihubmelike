import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

export const dynamic = "force-dynamic";

// Müdür atama dropdown'u için aday User listesi.
//
// YAPISAL NOT: DepartmentDefinition.mudurId / mudurYardimcisiId → PERSONNEL.id'dir
// (User değil). Ama PublicJobApplication.assignedManagerId → USER.id ister. Bu yüzden
// zincir: mudurId (Personnel.id) → User (User.personnelId = Personnel.id) → User.id.
// Personnel↔User bağı olmayan müdür (User hesabı yok) listeye giremez — atanamaz zaten.
//
// İki grup döner:
//   onerilenler: departman müdürü/yardımcısı olan aktif User'lar (öneri)
//   tumAktif:    tüm aktif User'lar (İK gerekirse başka birini de seçebilsin)

type ManagerOption = {
  id: string;
  name: string;
  departmentName: string | null;
  isDeputy: boolean;
};

function userName(u: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}): string {
  const composed = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return composed || u.name || u.email || "(isimsiz)";
}

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  // İK yetkisi şart.
  const perms = session.user.permissions ?? [];
  if (!perms.includes("recruitment.admin") && !perms.includes("hr.admin")) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  }

  // 1) Aktif departmanların müdür/yardımcı Personnel.id'leri + departman adı.
  const depts = await prisma.departmentDefinition.findMany({
    where: { isActive: true },
    select: { name: true, mudurId: true, mudurYardimcisiId: true },
  });

  // Personnel.id → { departman adı, isDeputy } (öneri meta'sı)
  const personnelMeta = new Map<string, { departmentName: string; isDeputy: boolean }>();
  for (const d of depts) {
    if (d.mudurId && !personnelMeta.has(d.mudurId)) {
      personnelMeta.set(d.mudurId, { departmentName: d.name, isDeputy: false });
    }
    if (d.mudurYardimcisiId && !personnelMeta.has(d.mudurYardimcisiId)) {
      personnelMeta.set(d.mudurYardimcisiId, { departmentName: d.name, isDeputy: true });
    }
  }

  // 2) Bu Personnel'lere bağlı aktif User'lar (öneri grubu).
  const onerilenler: ManagerOption[] = [];
  const oneriUserIds = new Set<string>();
  const matchedPersonnelIds = new Set<string>();
  if (personnelMeta.size > 0) {
    const users = await prisma.user.findMany({
      where: { isActive: true, personnelId: { in: [...personnelMeta.keys()] } },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        personnelId: true,
      },
    });
    for (const u of users) {
      const meta = u.personnelId ? personnelMeta.get(u.personnelId) : undefined;
      onerilenler.push({
        id: u.id,
        name: userName(u),
        departmentName: meta?.departmentName ?? null,
        isDeputy: meta?.isDeputy ?? false,
      });
      oneriUserIds.add(u.id);
      if (u.personnelId) matchedPersonnelIds.add(u.personnelId);
    }
    onerilenler.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }

  // 2b) User karşılığı OLMAYAN müdürler — sessizce düşmesin, İK eksik nedeni görsün.
  // (Şu an DB'de 0; veri değişirse — müdür Personnel'inin User hesabı yoksa — burada görünür.)
  const unmatchedPersonnelIds = [...personnelMeta.keys()].filter((pid) => !matchedPersonnelIds.has(pid));
  let unmatchedManagers: { personnelId: string; adSoyad: string | null; departmentName: string | null; isDeputy: boolean }[] = [];
  if (unmatchedPersonnelIds.length > 0) {
    const personeller = await prisma.personnel.findMany({
      where: { id: { in: unmatchedPersonnelIds } },
      select: { id: true, adSoyad: true },
    });
    const adByPid = new Map(personeller.map((p) => [p.id, p.adSoyad]));
    unmatchedManagers = unmatchedPersonnelIds.map((pid) => {
      const meta = personnelMeta.get(pid);
      return {
        personnelId: pid,
        adSoyad: adByPid.get(pid) ?? null,
        departmentName: meta?.departmentName ?? null,
        isDeputy: meta?.isDeputy ?? false,
      };
    });
  }

  // 3) Tüm aktif User'lar (ikinci grup — öneride olanlar hariç, dropdown'da tekrar olmasın).
  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, firstName: true, lastName: true, email: true },
    orderBy: { name: "asc" },
  });
  const tumAktif: ManagerOption[] = allUsers
    .filter((u) => !oneriUserIds.has(u.id))
    .map((u) => ({ id: u.id, name: userName(u), departmentName: null, isDeputy: false }));

  return NextResponse.json({ onerilenler, tumAktif, unmatchedManagers });
}
