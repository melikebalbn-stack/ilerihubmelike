import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";

// Envanter yetki çözümleme — TEK KAYNAK. MEVCUT permission'lara bağlıdır (yeni permission
// UYDURULMAZ): 'envanter.view' (görüntüle) + 'envanter.admin' (yönet). Canlı envanter
// route'larındaki `session.user.permissions.includes('envanter.view'/'admin')` deseniyle
// birebir aynı; Parça 2'de taşınan sandbox route'ları bu helper'a bağlanacak (sandboxGuard yerine).
//
//   goruntule: envanter.view VEYA envanter.admin (yöneten zaten görüntüler)
//   yonet:     envanter.admin

const P_VIEW = "envanter.view";
const P_ADMIN = "envanter.admin";

export interface EnvanterRol {
  userId: string;
  goruntule: boolean;
  yonet: boolean;
}

type EnvanterRolSonuc = { rol: EnvanterRol; error: null } | { rol: null; error: NextResponse };

export async function envanterRolCozumle(): Promise<EnvanterRolSonuc> {
  const { session, error } = await requireSession();
  if (error) return { rol: null, error };

  const perms = session.user.permissions ?? [];
  const yonet = perms.includes(P_ADMIN);
  const goruntule = yonet || perms.includes(P_VIEW);

  return { rol: { userId: session.user.id, goruntule, yonet }, error: null };
}

// Yetkisiz (403) — oturum var ama gerekli envanter izni yok.
export function envanterYetkisiz() {
  return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
}
