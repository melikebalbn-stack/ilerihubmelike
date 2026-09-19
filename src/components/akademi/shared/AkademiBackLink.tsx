"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Akademi sayfalarında ortak "geri" bağlantısı (19.09.2026). Daha önce her sayfa
 * aynı Link+ArrowLeft kalıbını elle tekrarlıyordu (courses/[id] "Eğitimlere Dön",
 * exams/[id] "Sınavlara Dön", sonuç sayfası "Sınava Dön"); tek bileşende toplandı.
 */
export function AkademiBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm font-medium mb-5"
      style={{ color: "var(--ak-text-secondary)" }}
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </Link>
  );
}
