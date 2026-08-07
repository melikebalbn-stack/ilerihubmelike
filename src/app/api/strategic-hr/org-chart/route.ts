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

// GET - Organizasyon birimleri listesi (flat — ağacı client kurar)
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (org chart herkese açık, hassas alanlar role'e göre kısıtlı)
    const { session, error } = await requireSession();
    if (error) return error;

    const { hasFullAccess } = await checkAccess(session);

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
      select: {
        id: true,
        code: true,
        name: true,
        shortName: true,
        description: true,
        parentId: true,
        level: true,
        sortOrder: true,
        unitType: true,
        managerId: true,
        managerName: true,
        managerPhoto: true,
        location: true,
        headcount: true,
        isActive: true,
        // --- F1 yapısal alanlar ---
        positionId: true,
        positionStatus: true,
        isExternal: true,
        gecerlilikBaslangic: true,
        gecerlilikBitis: true,
        _count: {
          select: { employees: true }
        },
        employees: {
          where: { isActive: true },
          select: {
            id: true,
            displayName: true,
            positionTitle: true,
            orgUnitId: true,
            reportsToId: true,
            employmentStatus: true,
            workLocation: true,
            photoUrl: true,
            isActive: true,
            personnelId: true, // --- F1 ---
            ...(hasFullAccess ? { email: true, phone: true, hireDate: true, title: true } : {}),
          },
        },
        // F1 — sorumlu tablosu (IV-LS-45): export'ta zaten açık, hasFullAccess gerekmez.
        sorumluluklar: {
          orderBy: { sira: "asc" },
          select: { id: true, sira: true, birinciSorumlu: true, yedekSorumlu: true },
        },
        ...(hasFullAccess
          ? {
              costCenter: true,
              approvedHeadcount: true,
              managerEmail: true,
              vekaletDurumu: true,
              vekilAdi: true,
              // F1 — pozisyon dondurma izi: yalnız Pozisyon Yönetimi panelini
              // kullanan hasFullAccess oturumlar görür.
              dondurmaGerekce: true,
              dondurmaTarihi: true,
              dondurmaYapan: true,
            }
          : {}),
      }
    });

    // F1 — Avatar için cinsiyet: OrgEmployee.personnelId gevşek referans (relation yok),
    // Prisma join yapamaz. Tüm personnelId'leri toplayıp TEK toplu sorguyla (N+1 yok)
    // Personnel.cinsiyet'i çekip employee'lere ekliyoruz. Personnel'e SADECE OKUMA.
    const personnelIdler = Array.from(
      new Set(
        units.flatMap((u) => u.employees.map((e) => e.personnelId).filter((id): id is string => !!id))
      )
    );

    // Personnel'den TEK toplu okuma: cinsiyet (avatar) + aktif (G1 filtre) + adSoyad (G3 canlı ad).
    const personnelMap = new Map<string, { aktif: boolean; adSoyad: string; cinsiyet: string }>();
    if (personnelIdler.length > 0) {
      const personeller = await prisma.personnel.findMany({
        where: { id: { in: personnelIdler } },
        select: { id: true, cinsiyet: true, aktif: true, adSoyad: true },
      });
      for (const p of personeller) {
        personnelMap.set(p.id, { aktif: p.aktif, adSoyad: p.adSoyad, cinsiyet: p.cinsiyet });
      }
    }

    const unitsWithCinsiyet = units.map((u) => ({
      ...u,
      employees: u.employees
        // G1 — bağlı Personnel PASİF ise (aktif=false) koltuk BOŞ görünsün: kişi çıkarılır,
        // pozisyon/kutu korunur (sayaçlar employees dizisinden türediği için otomatik güncellenir).
        // personnelId NULL veya Personnel kaydı bulunamayan koltuklar mevcut davranışını korur.
        .filter((e) => {
          if (!e.personnelId) return true;
          const p = personnelMap.get(e.personnelId);
          if (!p) return true;
          return p.aktif !== false;
        })
        .map((e) => {
          const p = e.personnelId ? personnelMap.get(e.personnelId) : null;
          return {
            ...e,
            // G3 — ad CANLI Personnel.adSoyad'dan (kopya bayat kalmasın); displayName yalnız
            // personnelId NULL koltuklarda yedek.
            displayName: p?.adSoyad ?? e.displayName,
            cinsiyet: p?.cinsiyet ?? null,
          };
        }),
    }));

    // Şemada yeri olmayan personel — koltuk açılamamış aktif kişiler görünür olsun,
    // İK elle bağlayabilsin. YALNIZ hasFullAccess (İK/admin): org-chart GET her
    // oturuma açık olduğundan, şemada GÖRÜNMEYEN kişilerin ad/bölüm/görev listesi
    // yetkisiz kullanıcıya YENİ bir PII yüzeyi açmasın.
    let koltuksuzPersonel: { id: string; sicilNo: string | null; adSoyad: string; bolum: string; gorev: string }[] = [];
    if (hasFullAccess) {
      const koltuklu = await prisma.orgEmployee.findMany({
        where: { isActive: true, personnelId: { not: null } },
        select: { personnelId: true },
      });
      const koltukluIds = [...new Set(koltuklu.map((k) => k.personnelId!))];
      koltuksuzPersonel = await prisma.personnel.findMany({
        where: { aktif: true, ...(koltukluIds.length ? { id: { notIn: koltukluIds } } : {}) },
        select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true },
        orderBy: [{ bolum: "asc" }, { adSoyad: "asc" }],
      });
    }

    // hasFullAccess SUNUCUDA hesaplanır (checkAccess) — client mükerrer hesaplamasın diye
    // yanıtta döner. Düzenleme butonlarının görünürlüğü bu bayrağa bağlanır (güvenlik yine 403).
    return NextResponse.json({
      units: unitsWithCinsiyet,
      hasFullAccess,
      koltuksuzPersonel,
      koltuksuzPersonelSayisi: koltuksuzPersonel.length,
    });
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
