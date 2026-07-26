import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";

// İş Analizi rol çözümleme — TEK KAYNAK. sandboxGuard'ın yerini alır.
// Middleware /api/* kapsamaz → her uçta bu çağrılır; güvenlik yalnız route'ta.
//
//   calisan: oturumu olan herkes (kendi formunu doldurur) — her zaman true
//   amir:    en az bir ia_is_analizi kaydında amirPersonnelId = kullanıcının personnelId'si
//   ik:      recruitment.admin VEYA hr.admin permission (recruitment resolve-roles ile aynı)

export interface IaRol {
  userId: string;
  personnelId: string | null;
  calisan: boolean;
  amir: boolean;
  ik: boolean;
}

type IaRolSonuc = { rol: IaRol; error: null } | { rol: null; error: NextResponse };

export async function iaRolCozumle(): Promise<IaRolSonuc> {
  const { session, error } = await requireSession();
  if (error) return { rol: null, error };

  const userId = session.user.id;
  const perms = session.user.permissions ?? [];
  const ik = perms.includes("recruitment.admin") || perms.includes("hr.admin");

  const u = await prisma.user.findUnique({ where: { id: userId }, select: { personnelId: true } });
  const personnelId = u?.personnelId ?? null;

  let amir = false;
  if (personnelId) {
    amir = (await prisma.iaIsAnalizi.count({ where: { amirPersonnelId: personnelId } })) > 0;
  }

  return { rol: { userId, personnelId, calisan: true, amir, ik }, error: null };
}

// Yetkisiz (403) — oturum var ama gerekli rol yok.
export function iaYetkisiz() {
  return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
}
