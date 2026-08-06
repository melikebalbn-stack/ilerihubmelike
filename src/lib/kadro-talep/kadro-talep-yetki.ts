import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";

// Kadro (personel) talep açma yetkisi — TEK KAYNAK.
// Kim talep açabilir:
//   - Bir departmanın MÜDÜRÜ (DepartmentDefinition.mudurId = kullanıcının personnelId'si)
//   - Bir departmanın MÜDÜR YARDIMCISI (DepartmentDefinition.mudurYardimcisiId = personnelId)
//   - İK (recruitment.admin VEYA hr.admin) — İK adına talep girebilir
// Bunların dışındaki herkes: talepAcabilir = false.
//
// Personnel → User eşlemesi: user.personnelId ile DepartmentDefinition'da mudur/mudurYrd araması
// (resolveApprovers ve ia-yetki ile aynı desen). LDAP department/rol string'i KULLANILMAZ.

export type KadroTalepRol = "MUDUR" | "MUDUR_YRD" | null;

export interface KadroTalepYetki {
  userId: string;
  personnelId: string | null;
  talepAcabilir: boolean;
  rol: KadroTalepRol; // departman rolü (İK-only ise null olabilir ama talepAcabilir true)
  ik: boolean;
}

type Sonuc =
  | { yetki: KadroTalepYetki; error: null }
  | { yetki: null; error: NextResponse };

export async function kadroTalepYetkisi(): Promise<Sonuc> {
  const { session, error } = await requireSession();
  if (error) return { yetki: null, error };

  const userId = session.user.id;
  const perms = session.user.permissions ?? [];
  const ik = perms.includes("recruitment.admin") || perms.includes("hr.admin");

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { personnelId: true },
  });
  const personnelId = u?.personnelId ?? null;

  // Departman rolü: personnelId müdür mü / müdür yardımcısı mı?
  let rol: KadroTalepRol = null;
  if (personnelId) {
    const dept = await prisma.departmentDefinition.findFirst({
      where: {
        OR: [{ mudurId: personnelId }, { mudurYardimcisiId: personnelId }],
      },
      select: { mudurId: true, mudurYardimcisiId: true },
    });
    if (dept?.mudurId === personnelId) rol = "MUDUR";
    else if (dept?.mudurYardimcisiId === personnelId) rol = "MUDUR_YRD";
  }

  const talepAcabilir = ik || rol !== null;

  return {
    yetki: { userId, personnelId, talepAcabilir, rol, ik },
    error: null,
  };
}

// Yetkisiz (403) — oturum var ama talep açma yetkisi yok.
export function kadroTalepYetkisiz() {
  return NextResponse.json(
    { error: "Personel kadro talebi açma yetkiniz yok." },
    { status: 403 }
  );
}
