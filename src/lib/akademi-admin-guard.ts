import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/has-permission";

/**
 * Akademi admin server guard.
 *
 * PR-Y5a: Eski isAkademiAdminRole(role) enum check yerine RBAC permission
 * kontrolü kullanılıyor. akademi.admin permission'ı olan rollere izin verilir
 * (Y5-PREP sonrası: super-admin, akademi-admin, hr-yoneticisi).
 *
 * İmza KORUNDU: 44 dosya / 105 çağrı `{ session, error }` destructure ediyor,
 * 2 dosya `session`'ı da kullanıyor (grade/route.ts, packages/[id]/sync/route.ts).
 *
 * Geriye dönük uyum: Eski enum-tabanlı ADMIN, IT_MANAGER kullanıcıları artık
 * Akademi admin'ine erişemez. Erişim gerekirse o user'lara akademi-admin slug'ı
 * /settings/kullanici-rolleri'nden atansın.
 */
export async function requireAkademiAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const allowed = await hasPermission("akademi.admin");
  if (!allowed) {
    return {
      session,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { session, error: null };
}
