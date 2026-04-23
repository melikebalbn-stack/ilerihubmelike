"use client";

import { useAkademiAuth } from "@/lib/akademi-auth";

/**
 * Client-side admin check hook.
 * useAkademiAuth zaten ham Role → "admin"/"user" map ediyor.
 * Bu hook onu adminability semantik etiketine sarar.
 */
export function useAkademiAdmin() {
  const { user, status } = useAkademiAuth();
  const isAdmin = user?.role === "admin";
  return { isAdmin, loading: status === "loading", user };
}

export { isAkademiAdminRole } from "@/lib/akademi-admin-roles";
