import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { logAuditEvent } from "@/lib/audit-log";

// org-chart/route.ts'teki checkAccess private (export edilmemiş) olduğu için
// import edilemiyor — diğer org-chart alt route'larında (vekil-ata, uye-ata,
// sorumluluk, pozisyon-ekle) yapıldığı gibi aynı rol listesiyle yerel bir kopya
// tutuyoruz.
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
  name: string;
}

// Verilen birimden başlayıp parentId zinciriyle en üst köke (parentId=null) çıkar —
// pozisyon-ekle/route.ts'teki aynı mantık (Tüm Firma/Yönetim koruması + revizyon
// hedefi için — dondurma/aktifleştirme kök departmanın revizyon geçmişine yazılır).
async function kokeCik(unitId: string): Promise<KokBilgisi | null> {
  const ilk = await prisma.orgUnit.findUnique({
    where: { id: unitId },
    select: { id: true, code: true, name: true, parentId: true },
  });
  if (!ilk) return null;

  let current = ilk;
  while (current.parentId) {
    const parent = await prisma.orgUnit.findUnique({
      where: { id: current.parentId },
      select: { id: true, code: true, name: true, parentId: true },
    });
    if (!parent) break;
    current = parent;
  }

  return { id: current.id, code: current.code, name: current.name };
}

// POST - Bir pozisyonu dondurur (positionStatus="DONDURULDU") veya geri aktifleştirir.
// Silme YOK — Personnel/OrgEmployee'ye hiç dokunulmaz, yalnız durum alanı değişir.
// vekil-ata/uye-ata/sorumluluk/pozisyon-ekle ile birebir aynı guard iskeleti.
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hasFullAccess } = checkAccess(session);
  if (!hasFullAccess) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const body = await req.json();
  const { orgUnitId, aktifEt, gerekce } = body;

  if (!orgUnitId || typeof orgUnitId !== "string") {
    return NextResponse.json({ error: "orgUnitId zorunludur" }, { status: 400 });
  }

  const unit = await prisma.orgUnit.findUnique({
    where: { id: orgUnitId },
    select: { id: true, name: true, unitType: true, positionStatus: true },
  });
  if (!unit) {
    return NextResponse.json({ error: "Birim bulunamadı" }, { status: 404 });
  }
  if (unit.unitType !== "POSITION") {
    return NextResponse.json({ error: "Yalnız pozisyon dondurulabilir/aktifleştirilebilir" }, { status: 400 });
  }

  // Audit/revizyonda kullanılan kimlik — RevizyonPanel'in "yapan" varsayılanıyla aynı desen.
  const kimlik = session.user.name || session.user.email || "Bilinmiyor";

  // ── Geri al (aktifleştir) — yaprak/M kontrolü gerekmez, serbest. Dondurma
  // izini temizler, revizyona da yazar (denetim izi tam olsun). ──────────────
  if (aktifEt === true) {
    const kok = await kokeCik(orgUnitId);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.orgUnit.update({
        where: { id: orgUnitId },
        data: {
          positionStatus: "AKTIF",
          dondurmaGerekce: null,
          dondurmaTarihi: null,
          dondurmaYapan: null,
        },
        select: { id: true, positionStatus: true },
      });

      if (kok) {
        const kokTam = await tx.orgUnit.findUnique({
          where: { id: kok.id },
          include: { bolumMeta: true },
        });

        if (kokTam) {
          const maxAgg = await tx.orgRevizyon.aggregate({
            where: { orgUnitId: kok.id },
            _max: { revNo: true },
          });
          let yeniRevNo: number;
          if (maxAgg._max.revNo != null) {
            yeniRevNo = maxAgg._max.revNo + 1;
          } else {
            const mevcutRevNo = kokTam.bolumMeta?.revNo ? parseInt(kokTam.bolumMeta.revNo, 10) : 0;
            yeniRevNo = (Number.isNaN(mevcutRevNo) ? 0 : mevcutRevNo) + 1;
          }

          await tx.orgRevizyon.create({
            data: {
              orgUnitId: kok.id,
              revNo: yeniRevNo,
              tarih: new Date(),
              aciklama: `Pozisyon yeniden aktifleştirildi: ${unit.name}`,
              degisiklikYeri: kok.name,
              yapan: kimlik,
              yapanUserId: session.user.id,
            },
          });

          if (kokTam.bolumMeta) {
            await tx.orgBolumMeta.update({
              where: { orgUnitId: kok.id },
              data: { revNo: String(yeniRevNo) },
            });
          }
        }
      }

      return updated;
    });

    await logAuditEvent({
      action: "ORG_POZISYON_AKTIFET",
      actorId: session.user.id,
      targetType: "ORG_UNIT",
      targetId: orgUnitId,
      details: {},
    });

    return NextResponse.json(result);
  }

  // ── Dondur — gerekçe zorunlu + yalnız yaprak (çocuksuz) + boş (M=0) + Tüm Firma/Yönetim dışı ──
  if (!gerekce || typeof gerekce !== "string" || !gerekce.trim()) {
    return NextResponse.json({ error: "Dondurma gerekçesi zorunludur" }, { status: 400 });
  }

  const cocukSayisi = await prisma.orgUnit.count({ where: { parentId: orgUnitId } });
  if (cocukSayisi > 0) {
    return NextResponse.json(
      { error: "Alt pozisyonu olan kutu dondurulamaz — önce alt pozisyonları çıkarın" },
      { status: 400 }
    );
  }

  const doluKoltukSayisi = await prisma.orgEmployee.count({
    where: { orgUnitId, isActive: true },
  });
  if (doluKoltukSayisi > 0) {
    return NextResponse.json({ error: "Dolu kadro dondurulamaz" }, { status: 400 });
  }

  const kok = await kokeCik(orgUnitId);
  // NOT: eskiden kökü ORG-TF/ORG-YN olan pozisyonun dondurulması yasaktı
  // ("türetilmiş/özet kapsam"). Şema temizliğinden sonra ORG-TF ANA AĞAÇ oldu ve
  // ORG-YN silindi; yasak kalsaydı hiçbir pozisyon dondurulamazdı. Kaldırıldı.
  // "Dolu kadro dondurulamaz" koruması yukarıda yerinde duruyor.

  const gerekceMetni = gerekce.trim();

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.orgUnit.update({
      where: { id: orgUnitId },
      data: {
        positionStatus: "DONDURULDU",
        dondurmaGerekce: gerekceMetni,
        dondurmaTarihi: new Date(),
        dondurmaYapan: kimlik,
      },
      select: { id: true, positionStatus: true },
    });

    if (kok) {
      const kokTam = await tx.orgUnit.findUnique({
        where: { id: kok.id },
        include: { bolumMeta: true },
      });

      if (kokTam) {
        const maxAgg = await tx.orgRevizyon.aggregate({
          where: { orgUnitId: kok.id },
          _max: { revNo: true },
        });
        let yeniRevNo: number;
        if (maxAgg._max.revNo != null) {
          yeniRevNo = maxAgg._max.revNo + 1;
        } else {
          const mevcutRevNo = kokTam.bolumMeta?.revNo ? parseInt(kokTam.bolumMeta.revNo, 10) : 0;
          yeniRevNo = (Number.isNaN(mevcutRevNo) ? 0 : mevcutRevNo) + 1;
        }

        await tx.orgRevizyon.create({
          data: {
            orgUnitId: kok.id,
            revNo: yeniRevNo,
            tarih: new Date(),
            aciklama: `Pozisyon donduruldu: ${unit.name} — Gerekçe: ${gerekceMetni}`,
            degisiklikYeri: kok.name,
            yapan: kimlik,
            yapanUserId: session.user.id,
          },
        });

        if (kokTam.bolumMeta) {
          await tx.orgBolumMeta.update({
            where: { orgUnitId: kok.id },
            data: { revNo: String(yeniRevNo) },
          });
        }
      }
    }

    return updated;
  });

  await logAuditEvent({
    action: "ORG_POZISYON_DONDUR",
    actorId: session.user.id,
    targetType: "ORG_UNIT",
    targetId: orgUnitId,
    details: { gerekce: gerekceMetni },
  });

  return NextResponse.json(result);
}
