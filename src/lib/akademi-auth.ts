"use client";

import { useSession, signOut } from "next-auth/react";

/**
 * Akademi yetki client hook.
 *
 * PR-Y5a: Eski enum-bazlı role check yerine session.user.permissions üzerinden
 * akademi.admin kontrolü yapılır. auth.ts session callback'i JWT token'daki
 * permissions array'ini session'a aktarır (5dk cache, PR-Y2).
 *
 * Return shape KORUNDU ({ user, token, logout, status }) — 18 tüketici
 * etkilenmedi. user.role hâlâ "admin" | "user" string — courses/page.tsx
 * gibi yerlerdeki `user?.role === 'admin'` kontrolü aynı şekilde çalışır.
 */
interface SessionUserLike {
  id?: string;
  name?: string | null;
  email?: string | null;
  username?: string;
  role?: string;
  department?: string | null;
  permissions?: string[];
}

export interface AkademiUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  department?: string | null;
  avatarInitials: string;
}

export function useAkademiAuth() {
  const { data: session, status } = useSession();
  const u = session?.user as SessionUserLike | undefined;

  const isAkademiAdmin = u?.permissions?.includes("akademi.admin") ?? false;

  const user: AkademiUser | null = u
    ? {
        id: u.id ?? "",
        name: u.name ?? u.username ?? u.email ?? "Kullanıcı",
        email: u.email ?? "",
        role: isAkademiAdmin ? "admin" : "user",
        department: u.department ?? null,
        avatarInitials: getInitials(u.name ?? u.username ?? u.email ?? ""),
      }
    : null;

  return {
    user,
    token: status === "authenticated" ? "nextauth" : null,
    logout: () => signOut({ callbackUrl: "/login" }),
    status,
  };
}

function getInitials(name: string): string {
  return name
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
