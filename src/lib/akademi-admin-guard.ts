import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/has-permission";

/**
 * Akademi admin server guard.
 *
 * @deprecated PR-Y5b (2026-05-08) sonrası akademi backend endpoint'leri
 * direkt `requirePermission('akademi.X')` kullanıyor. Bu helper artık
 * tüketici tarafından çağrılmıyor (43 dosya granüler permission'a geçti).
 *
 * Y5c-CLEANUP'ta tamamen kaldırılacak. Şu an external import'lar varsa
 * build kırılmasın diye bırakıldı (içerik Y5a'dan permission tabanlı,
 * davranış değişmez).
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
