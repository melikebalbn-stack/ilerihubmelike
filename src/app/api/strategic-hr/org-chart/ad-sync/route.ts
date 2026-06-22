import { NextRequest, NextResponse } from "next/server";
import { getAllOUs, getOUHierarchy, clearOUCache, getAllLDAPUsers, ADOrgTree } from "@/lib/ldap";
import { requireSession } from "@/lib/auth/require-session";

// GET - AD'den organizasyon şemasını çek
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (basit auth gate)
    const { error } = await requireSession();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "flat"; // flat veya hierarchy
    const refresh = searchParams.get("refresh") === "true";

    // Cache'i temizle (refresh istendiyse)
    if (refresh) {
      clearOUCache();
    }

    if (format === "hierarchy") {
      // Hiyerarşik yapıda döndür
      const hierarchy = await getOUHierarchy();
      return NextResponse.json({
        type: "hierarchy",
        data: hierarchy,
        timestamp: new Date().toISOString()
      });
    } else {
      // Düz liste olarak döndür
      const ous = await getAllOUs();
      return NextResponse.json({
        type: "flat",
        data: ous,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error("AD org şeması hatası:", error);
    return NextResponse.json(
      { error: "AD organizasyon şeması alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - AD'den OrgUnit tablosuna senkronize et
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (admin role check)
    const { session, error } = await requireSession();
    if (error) return error;

    // Yetki kontrolü - sadece admin
    const userRole = session.user.role;
    if (!["SUPER_ADMIN", "ADMIN", "IT_MANAGER"].includes(userRole)) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    // AD'den verileri çek
    clearOUCache(); // Taze veri için cache temizle
    const adOUs = await getAllOUs();
    const allUsers = await getAllLDAPUsers();

    // Departman bazlı çalışan sayıları (department attribute'dan)
    const deptCounts = new Map<string, number>();
    for (const user of allUsers) {
      if (user.department) {
        deptCounts.set(user.department, (deptCounts.get(user.department) || 0) + 1);
      }
    }

    // Senkronizasyon sonucu
    const result = {
      totalOUs: adOUs.length,
      totalUsers: allUsers.length,
      departments: Array.from(deptCounts.entries()).map(([name, count]) => ({
        name,
        employeeCount: count
      })),
      ous: adOUs.map(ou => ({
        name: ou.name,
        path: ou.path,
        employeeCount: ou.employeeCount,
        managerName: ou.managerName
      })),
      syncedAt: new Date().toISOString()
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error("AD senkronizasyon hatası:", error);
    return NextResponse.json(
      { error: "AD senkronizasyonu sırasında hata oluştu" },
      { status: 500 }
    );
  }
}
