import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { requireSession } from "@/lib/auth/require-session";

type GuardResult =
  | { session: Session; isAdmin: boolean; error: null }
  | { session: null; isAdmin: false; error: NextResponse };

// İşe alım sınav (assessment) API'leri için ortak yetki kontrolü.
// Recruitment modülünün mevcut deseni: requireSession + recruitAccess (recruitment.admin/view).
// Yeni izin icat edilmez; sınav tanımı/atama admin, görüntüleme view iznine bağlıdır.
export async function assessmentGuard(opts?: { requireAdmin?: boolean }): Promise<GuardResult> {
  const { session, error } = await requireSession();
  if (error) return { session: null, isAdmin: false, error };

  const perms = session.user.permissions ?? [];
  const isAdmin = perms.includes("recruitment.admin");
  const canView = perms.includes("recruitment.view");

  const allowed = opts?.requireAdmin ? isAdmin : isAdmin || canView;
  if (!allowed) {
    return {
      session: null,
      isAdmin: false,
      error: NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 }),
    };
  }
  return { session, isAdmin, error: null };
}
