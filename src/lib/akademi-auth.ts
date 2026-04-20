"use client";

import { useSession, signOut } from "next-auth/react";

const AKADEMI_ADMIN_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "HR_MANAGER",
  "IT_MANAGER",
] as const;

interface SessionUserLike {
  id?: string;
  name?: string | null;
  email?: string | null;
  username?: string;
  role?: string;
  department?: string | null;
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

  const user: AkademiUser | null = u
    ? {
        id: u.id ?? "",
        name: u.name ?? u.username ?? u.email ?? "Kullanıcı",
        email: u.email ?? "",
        role: (AKADEMI_ADMIN_ROLES as readonly string[]).includes(u.role ?? "")
          ? "admin"
          : "user",
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
