import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EmploymentStatus } from "@/generated/prisma";
import { requireSession } from "@/lib/auth/require-session";

// GET - Organizasyon çalışanları listesi
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (read-only; PII alanları hasFullAccess'e kısıtlı)
    const { session, error } = await requireSession();
    if (error) return error;
    const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
    const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
    const userRole = session?.user?.role;
    const userDept = (session?.user?.department || "").toLowerCase();
    const hasFullAccess = fullAccessRoles.includes(userRole) || hrDepartments.some(d => userDept.includes(d));
    // Beyaz liste — email/phone/hireDate/title/userId/lastSyncedAt sadece tam yetkiliye
    const employeeFields = {
      id: true, displayName: true, positionTitle: true, positionLevel: true,
      orgUnitId: true, reportsToId: true, employmentStatus: true,
      workLocation: true, officeLocation: true, photoUrl: true, isActive: true,
      createdAt: true, updatedAt: true,
      ...(hasFullAccess ? { email: true, phone: true, hireDate: true, title: true, userId: true, lastSyncedAt: true } : {}),
    };
    // Nested (yönetici/astlar) — email/title bypass'ını da kapat
    const relEmployeeFields = {
      id: true, displayName: true,
      ...(hasFullAccess ? { email: true, title: true } : {}),
    };

    const { searchParams } = new URL(request.url);
    const orgUnitId = searchParams.get("orgUnitId");
    const reportsToId = searchParams.get("reportsToId");
    const employmentStatus = searchParams.get("employmentStatus") as EmploymentStatus | null;
    const search = searchParams.get("search");

    const where: any = {};

    if (orgUnitId) {
      where.orgUnitId = orgUnitId;
    }

    if (reportsToId) {
      where.reportsToId = reportsToId;
    }

    if (employmentStatus) {
      where.employmentStatus = employmentStatus;
    }

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } }
      ];
    }

    const employees = await prisma.orgEmployee.findMany({
      where,
      orderBy: [
        { displayName: "asc" }
      ],
      select: {
        ...employeeFields,
        orgUnit: {
          select: { id: true, code: true, name: true, unitType: true }
        },
        reportsTo: { select: relEmployeeFields },
        directReports: { select: relEmployeeFields },
        _count: { select: { directReports: true } }
      }
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error("Organizasyon çalışanları listesi hatası:", error);
    return NextResponse.json(
      { error: "Organizasyon çalışanları alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - Manuel personel veya boş pozisyon ekle
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (role/department session'dan)
    const { session, error } = await requireSession();
    if (error) return error;

    const userRole = session.user.role;
    const userDepartment = session.user.department || "";
    const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
    const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
    const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept));

    if (!fullAccessRoles.includes(userRole) && !isHrDepartment) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const body = await request.json();
    const {
      // Bulk sync modu
      employees,
      // Tekil ekleme modu
      displayName,
      email,
      title,
      orgUnitId,
      positionTitle,
      employmentStatus,
      photoUrl,
      reportsToId,
      hireDate,
      phone,
      workLocation
    } = body;

    // Bulk sync modu (AD'den)
    if (employees && Array.isArray(employees)) {
      let created = 0;
      let updated = 0;
      let errors: string[] = [];

      for (const emp of employees) {
        try {
          const empEmail = typeof emp.email === "string" ? emp.email.toLowerCase() : null;
          const existingEmployee = empEmail ? await prisma.orgEmployee.findFirst({
            where: { email: empEmail }
          }) : null;

          if (existingEmployee) {
            await prisma.orgEmployee.update({
              where: { id: existingEmployee.id },
              data: {
                displayName: emp.displayName,
                title: emp.title,
                positionTitle: emp.positionTitle || emp.title,
                phone: emp.phone,
                workLocation: emp.workLocation,
                officeLocation: emp.officeLocation,
                photoUrl: emp.photoUrl,
                lastSyncedAt: new Date()
              }
            });
            updated++;
          } else {
            let orgUnit = await prisma.orgUnit.findFirst({
              where: {
                OR: [
                  { name: { contains: emp.department || "Genel", mode: "insensitive" } },
                  { code: emp.department?.toUpperCase().replace(/\s+/g, "") || "GENERAL" }
                ]
              }
            });

            if (!orgUnit) {
              orgUnit = await prisma.orgUnit.create({
                data: {
                  code: emp.department?.toUpperCase().replace(/\s+/g, "") || "GENERAL",
                  name: emp.department || "Genel",
                  unitType: "DEPARTMENT",
                  level: 1,
                  isActive: true
                }
              });
            }

            await prisma.orgEmployee.create({
              data: {
                userId: emp.userId || empEmail || null,
                email: empEmail || null,
                displayName: emp.displayName,
                title: emp.title,
                orgUnitId: orgUnit.id,
                positionTitle: emp.positionTitle || emp.title,
                hireDate: emp.hireDate ? new Date(emp.hireDate) : null,
                employmentStatus: emp.employmentStatus || "ACTIVE",
                workLocation: emp.workLocation,
                phone: emp.phone,
                officeLocation: emp.officeLocation,
                photoUrl: emp.photoUrl,
                lastSyncedAt: new Date(),
                isActive: true
              }
            });
            created++;
          }
        } catch (err: any) {
          errors.push(`${emp.email || emp.displayName}: ${err.message}`);
        }
      }

      // Headcount güncelle
      await updateHeadcounts();

      return NextResponse.json({
        success: true,
        created,
        updated,
        errors: errors.length > 0 ? errors : undefined
      });
    }

    // Tekil ekleme modu
    if (!displayName || !orgUnitId) {
      return NextResponse.json(
        { error: "İsim ve birim zorunludur" },
        { status: 400 }
      );
    }

    // Birim kontrolü
    const orgUnit = await prisma.orgUnit.findUnique({
      where: { id: orgUnitId }
    });

    if (!orgUnit) {
      return NextResponse.json(
        { error: "Birim bulunamadı" },
        { status: 404 }
      );
    }

    // Personel oluştur
    const normalizedEmail = typeof email === "string" ? email.toLowerCase() : null;
    const employee = await prisma.orgEmployee.create({
      data: {
        userId: normalizedEmail || null,
        email: normalizedEmail || null,
        displayName,
        title,
        orgUnitId,
        positionTitle: positionTitle || title,
        employmentStatus: (employmentStatus as EmploymentStatus) || "ACTIVE",
        photoUrl,
        reportsToId: reportsToId || null,
        hireDate: hireDate ? new Date(hireDate) : null,
        phone,
        workLocation,
        isActive: true
      },
      include: {
        orgUnit: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        reportsTo: {
          select: {
            id: true,
            displayName: true
          }
        }
      }
    });

    // Headcount güncelle
    await updateHeadcounts();

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("Personel ekleme hatası:", error);
    return NextResponse.json(
      { error: "Personel eklenirken hata oluştu" },
      { status: 500 }
    );
  }
}

// Headcount güncelleme helper
async function updateHeadcounts() {
  const units = await prisma.orgUnit.findMany();
  for (const unit of units) {
    const count = await prisma.orgEmployee.count({
      where: {
        orgUnitId: unit.id,
        isActive: true,
        employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] }
      }
    });
    await prisma.orgUnit.update({
      where: { id: unit.id },
      data: { headcount: count }
    });
  }
}
