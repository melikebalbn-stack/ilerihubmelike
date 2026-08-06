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

// Yetki çekirdeği — session'dan BAĞIMSIZ (userId + perms verilir). Hem API hem
// server-component (page) buradan besleniyor; DepartmentDefinition mudur/mudurYrd
// lookup + İK kontrolü TEK yerde. NextResponse döndürmez → page'de güvenle çağrılır.
export async function kadroTalepYetkisiCore(
  userId: string,
  perms: string[]
): Promise<KadroTalepYetki> {
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

  return { userId, personnelId, talepAcabilir, rol, ik };
}

// Page-safe boolean kısayolu (server component'te getServerSession sonrası çağrılır).
export async function talepAcabilirMi(
  userId: string,
  perms: string[]
): Promise<boolean> {
  const { talepAcabilir } = await kadroTalepYetkisiCore(userId, perms);
  return talepAcabilir;
}

export async function kadroTalepYetkisi(): Promise<Sonuc> {
  const { session, error } = await requireSession();
  if (error) return { yetki: null, error };

  const yetki = await kadroTalepYetkisiCore(
    session.user.id,
    session.user.permissions ?? []
  );

  return { yetki, error: null };
}

// Yetkisiz (403) — oturum var ama talep açma yetkisi yok.
export function kadroTalepYetkisiz() {
  return NextResponse.json(
    { error: "Personel kadro talebi açma yetkiniz yok." },
    { status: 403 }
  );
}
