"use client";

import { useAkademiAuth } from "@/lib/akademi-auth";

/**
 * Client-side admin check hook.
 * useAkademiAuth zaten permission tabanlı admin/user map ediyor (PR-Y5a).
 * Bu hook onu adminability semantik etiketine sarar.
 */
export function useAkademiAdmin() {
  const { user, status } = useAkademiAuth();
  const isAdmin = user?.role === "admin";
  return { isAdmin, loading: status === "loading", user };
}
