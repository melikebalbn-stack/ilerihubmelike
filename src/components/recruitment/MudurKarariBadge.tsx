"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Müdür kararı rozeti — JobApplicationStatusBadge ile AYNI desen (Badge + renk haritası).
// Karar yoksa HİÇ çizilmez (null döner), sınav/mükerrer rozetleriyle aynı ilke.
//
// 2026-08: müdür kademesinden yalnız iki sonuç çıkar ve ikisi de başvuruyu İV'ye döndürür;
// statü artık kararı taşımadığı için rozet ayrı alandan (PublicJobApplication.mudurKarari) gelir.

export type MudurKarariDeger = "APPROVED" | "REJECTED" | null | undefined

const RENK: Record<"APPROVED" | "REJECTED", string> = {
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
}

const ETIKET: Record<"APPROVED" | "REJECTED", string> = {
  APPROVED: "Müdür: Olumlu",
  REJECTED: "Müdür: Olumsuz",
}

export function MudurKarariBadge({
  karar,
  className,
}: {
  karar: MudurKarariDeger
  className?: string
}) {
  if (karar !== "APPROVED" && karar !== "REJECTED") return null
  return (
    <Badge variant="secondary" className={cn(RENK[karar], "border-0", className)}>
      {ETIKET[karar]}
    </Badge>
  )
}
