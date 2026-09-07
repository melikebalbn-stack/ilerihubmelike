// Oturumdan aktörü çözer: userId + Personnel bağı + izinler.
// Zincir Personnel id'leriyle kurulu, oturum User id'si taşıyor — köprü burası.

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import type { Aktor } from "./deneme-yetki";
import type { NextResponse } from "next/server";

export async function aktoruCoz(): Promise<
  { aktor: Aktor; error: null } | { aktor: null; error: NextResponse }
> {
  const { session, userId, error } = await requireSession();
  if (error) return { aktor: null, error };
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, personnelId: true, email: true },
  });
  return {
    aktor: {
      userId,
      personnelId: u?.personnelId ?? null,
      permissions: session.user?.permissions ?? [],
      email: u?.email ?? session.user?.email ?? null,
    },
    error: null,
  };
}
