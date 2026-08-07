"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { JobApplicationStatus } from "@/generated/prisma"
import { STATUS_LABELS_TR } from "@/lib/recruitment/transitions"

// Başvuru statüsü rozeti — TEK KAYNAK.
// Etiket: STATUS_LABELS_TR (transitions.ts) — ayrı bir etiket haritası TUTULMAZ.
// Renk: aşağıdaki harita (eski detay sayfasındaki renklerden taşındı, tüm 18 statüyü kapsar).
//
// Record<JobApplicationStatus, ...> exhaustive: enum'a yeni statü eklenirse burada
// derleme hatası verir (renk atanması unutulmasın).
const STATUS_COLORS: Record<JobApplicationStatus, string> = {
  CONSENT_PENDING: "bg-gray-100 text-gray-700",
  HEALTH_PENDING: "bg-gray-100 text-gray-700",
  PENDING: "bg-yellow-100 text-yellow-800",
  REVIEWING: "bg-blue-100 text-blue-800",
  REVIEWED: "bg-blue-100 text-blue-800",
  SHORTLISTED: "bg-purple-100 text-purple-800",
  MUDUR_DEGERLENDIRME: "bg-amber-100 text-amber-800",
  MUDUR_MULAKATI: "bg-orange-100 text-orange-800",
  // Mavi yaka zinciri — onay kademesi yükseldikçe koyulaşan tek renk ailesi (amber→orange),
  // müdür kademesiyle akraba ama ayırt edilebilir kalsın diye rose ile taçlanır.
  DEGERLENDIRICI: "bg-amber-50 text-amber-700",
  URETIM_MUDUR_YRD: "bg-orange-100 text-orange-800",
  FABRIKA_MUDURU: "bg-rose-100 text-rose-800",
  INTERVIEW: "bg-indigo-100 text-indigo-800",
  SINAV: "bg-cyan-100 text-cyan-800",
  TELEFON_MULAKATI: "bg-sky-100 text-sky-800",
  IK_MULAKATI: "bg-indigo-100 text-indigo-800",
  TEKNIK_MULAKAT: "bg-teal-100 text-teal-800",
  TEKLIF: "bg-emerald-100 text-emerald-800",
  TEKLIF_KABUL: "bg-green-100 text-green-800",
  ISE_BASLADI: "bg-green-100 text-green-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
}

export function JobApplicationStatusBadge({
  status,
  className,
}: {
  status: JobApplicationStatus | string
  className?: string
}) {
  const known = status as JobApplicationStatus
  const color = STATUS_COLORS[known] ?? "bg-gray-100 text-gray-800"
  const label = STATUS_LABELS_TR[known] ?? status
  return <Badge className={cn(color, className)}>{label}</Badge>
}
