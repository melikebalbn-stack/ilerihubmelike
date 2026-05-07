import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrgUnitType } from "@/generated/prisma";
import { requireSession } from "@/lib/auth/require-session";

// Yetki kontrolü helper
async function checkAccess(session: any) {
  const userRole = session?.user?.role;
  const userDepartment = session?.user?.department || "";

  const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
  const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
  const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept));

  return {
    hasFullAccess: fullAccessRoles.includes(userRole) || isHrDepartment,
    isDeptHead: userRole === "DEPT_HEAD",
    userDepartment
  };
}

// GET - Organizasyon birimleri listesi
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (org chart herkese açık)
    const { error } = await requireSession();
    if (error) return error;

    // Org chart herkese açık olabilir
    const { searchParams } = new URL(request.url);
    const unitType = searchParams.get("unitType") as OrgUnitType | null;
    const parentId = searchParams.get("parentId");
    const isActive = searchParams.get("isActive");
    const flat = searchParams.get("flat"); // Hiyerarşisiz düz liste

    const where: any = {};

    if (unitType) {
      where.unitType = unitType;
    }

    if (parentId) {
      where.parentId = parentId;
    } else if (parentId === "null" || !flat) {
      // Root seviye birimler
      where.parentId = null;
    }

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    const units = await prisma.orgUnit.findMany({
      where,
      orderBy: [
        { level: "asc" },
        { sortOrder: "asc" },
        { name: "asc" }
      ],
      include: {
        children: {
          where: { isActive: true },
          orderBy: [
            { sortOrder: "asc" },
            { name: "asc" }
          ],
          include: {
            children: {
              where: { isActive: true },
              orderBy: [
                { sortOrder: "asc" },
                { name: "asc" }
              ],
              include: {
                _count: {
                  select: { employees: true }
                }
              }
            },
            _count: {
              select: { employees: true }
            }
          }
        },
        _count: {
          select: { employees: true }
        }
      }
    });

    return NextResponse.json(units);
  } catch (error) {
    console.error("Organizasyon birimleri listesi hatası:", error);
    return NextResponse.json(
      { error: "Organizasyon birimleri alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - Yeni organizasyon birimi oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (checkAccess session okuyor)
    const { session, error } = await requireSession();
    if (error) return error;

    const { hasFullAccess } = await checkAccess(session);

    if (!hasFullAccess) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const body = await request.json();
    const {
      code,
      name,
      shortName,
      description,
      parentId,
      level,
      sortOrder,
      unitType,
      managerId,
      managerEmail,
      managerName,
      location,
      costCenter,
      approvedHeadcount
    } = body;

    if (!code || !name || !unitType) {
      return NextResponse.json(
        { error: "Kod, ad ve birim tipi zorunludur" },
        { status: 400 }
      );
    }

    // Kod benzersizlik kontrolü
    const existingUnit = await prisma.orgUnit.findUnique({
      where: { code }
    });

    if (existingUnit) {
      return NextResponse.json(
        { error: "Bu kod zaten kullanılıyor" },
        { status: 400 }
      );
    }

    // Üst birimi kontrol et ve seviye hesapla
    let calculatedLevel = level || 0;
    if (parentId) {
      const parent = await prisma.orgUnit.findUnique({
        where: { id: parentId }
      });
      if (parent) {
        calculatedLevel = parent.level + 1;
      }
    }

    const unit = await prisma.orgUnit.create({
      data: {
        code: code.toUpperCase(),
        name,
        shortName,
        description,
        parentId,
        level: calculatedLevel,
        sortOrder: sortOrder || 0,
        unitType: unitType as OrgUnitType,
        managerId,
        managerEmail: typeof managerEmail === "string" ? managerEmail.toLowerCase() : managerEmail,
        managerName,
        location,
        costCenter,
        approvedHeadcount,
        isActive: true
      },
      include: {
        parent: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json(unit, { status: 201 });
  } catch (error) {
    console.error("Organizasyon birimi oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Organizasyon birimi oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
