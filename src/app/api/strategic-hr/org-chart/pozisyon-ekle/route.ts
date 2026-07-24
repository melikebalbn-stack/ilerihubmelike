import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { logAuditEvent } from "@/lib/audit-log";

// org-chart/route.ts'teki checkAccess private (export edilmemiş) olduğu için
// import edilemiyor — diğer org-chart alt route'larında (vekil-ata, uye-ata,
// sorumluluk) yapıldığı gibi aynı rol listesiyle yerel bir kopya tutuyoruz.
function checkAccess(session: any) {
  const userRole = session?.user?.role;
  const userDepartment = session?.user?.department || "";

  const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
  const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
  const isHrDepartment = hrDepartments.some((dept) => userDepartment.toLowerCase().includes(dept));

  return {
    hasFullAccess: fullAccessRoles.includes(userRole) || isHrDepartment,
  };
}

interface KokBilgisi {
  id: string;
  code: string;
  unitType: string;
}

// Verilen birimden başlayıp parentId zinciriyle en üst köke (parentId=null) çıkar.
// Bir departmanın kökü her zaman kendi code'unu taşır (ör. "ORG-FB") — otomatik
// kod üretimi ve Tüm Firma/Yönetim koruması bu kök koda göre yapılır.
async function kokeCik(unitId: string): Promise<KokBilgisi | null> {
  const ilk = await prisma.orgUnit.findUnique({
    where: { id: unitId },
    select: { id: true, code: true, unitType: true, parentId: true },
  });
  if (!ilk) return null;

  let current = ilk;
  while (current.parentId) {
    const parent = await prisma.orgUnit.findUnique({
      where: { id: current.parentId },
      select: { id: true, code: true, unitType: true, parentId: true },
    });
    if (!parent) break;
    current = parent;
  }

  return { id: current.id, code: current.code, unitType: current.unitType };
}

// POST - Boş bir pozisyon kutusu ekler (otomatik kod, isimsiz/boş kadro — sarı görünür).
// vekil-ata/uye-ata/sorumluluk ile birebir aynı guard iskeleti. Personnel'e hiç
// dokunulmaz, OrgEmployee oluşturulmaz.
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hasFullAccess } = checkAccess(session);
  if (!hasFullAccess) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const body = await req.json();
  const { parentId, name, approvedHeadcount } = body;

  if (!parentId || typeof parentId !== "string") {
    return NextResponse.json({ error: "parentId zorunludur" }, { status: 400 });
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name zorunludur" }, { status: 400 });
  }

  const parent = await prisma.orgUnit.findUnique({
    where: { id: parentId },
    select: { id: true, level: true, unitType: true },
  });
  if (!parent) {
    return NextResponse.json({ error: "Üst birim bulunamadı" }, { status: 404 });
  }
  if (parent.unitType !== "DEPARTMENT" && parent.unitType !== "POSITION") {
    return NextResponse.json(
      { error: "Pozisyon yalnız departman veya pozisyon altına eklenebilir" },
      { status: 400 }
    );
  }

  const kok = await kokeCik(parentId);
  if (!kok) {
    return NextResponse.json({ error: "Kök birim bulunamadı" }, { status: 404 });
  }
  if (kok.code === "ORG-TF" || kok.code === "ORG-YN") {
    return NextResponse.json(
      { error: "Tüm Firma / Yönetim türetilmiş/özet kapsamdır — buraya pozisyon eklenemez" },
      { status: 400 }
    );
  }

  // Otomatik kod: kök departmanın mevcut "P" pozisyon kodları içinden en yükseği +1.
  // Genişlik (kaç haneli) mevcut kodlardan öğrenilir — sabit 2 hane varsayılmaz.
  const adaylar = await prisma.orgUnit.findMany({
    where: { code: { startsWith: `${kok.code}-P` } },
    select: { code: true },
  });
  const desen = new RegExp(`^${kok.code}-P(\\d+)$`);
  let maxNo = 0;
  let genislik = 2;
  for (const u of adaylar) {
    const eslesme = u.code.match(desen);
    if (!eslesme) continue;
    const no = parseInt(eslesme[1], 10);
    if (no > maxNo) maxNo = no;
    if (eslesme[1].length > genislik) genislik = eslesme[1].length;
  }

  let yeniNo = maxNo + 1;
  let yeniKod = `${kok.code}-P${String(yeniNo).padStart(genislik, "0")}`;
  // Çakışma kontrolü — beklenmez ama garanti altına al.
  while (await prisma.orgUnit.findUnique({ where: { code: yeniKod }, select: { id: true } })) {
    yeniNo++;
    yeniKod = `${kok.code}-P${String(yeniNo).padStart(genislik, "0")}`;
  }

  const sonKardes = await prisma.orgUnit.findFirst({
    where: { parentId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const yeniSortOrder = (sonKardes?.sortOrder ?? -1) + 1;

  const created = await prisma.orgUnit.create({
    data: {
      code: yeniKod,
      name: name.trim(),
      unitType: "POSITION",
      parentId,
      level: parent.level + 1,
      sortOrder: yeniSortOrder,
      approvedHeadcount: approvedHeadcount ?? 1,
      positionStatus: "AKTIF",
      isExternal: false,
      vekaletDurumu: false,
    },
    select: { id: true, code: true, name: true },
  });

  await logAuditEvent({
    action: "ORG_POZISYON_EKLE",
    actorId: session.user.id,
    targetType: "ORG_UNIT",
    targetId: created.code,
    details: { name: created.name, parentId },
  });

  return NextResponse.json(created);
}
