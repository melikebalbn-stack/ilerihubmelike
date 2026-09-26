"use client";

import { useRouter } from "next/navigation";
import { SplitBadge } from "@/components/akademi/SplitBadge";
import type { CourseCardModel } from "@/lib/akademi/course-card-model";

const TAG_BG: Record<"red" | "green" | "orange", string> = {
  red: "bg-[#dc2626]",
  green: "bg-[#16a34a]",
  orange: "bg-[#f97316]",
};

/**
 * Eğitim kartı. Tüm kart tıklanabilir (onClick → kurs); aksiyon rozeti ayrı bir
 * link (nested <a> olmasın diye kök <a> değil, div + onClick). Rozet tıklaması
 * kendi href'ine gider (stopPropagation).
 */
export function CourseCard({ model }: { model: CourseCardModel }) {
  const router = useRouter();
  const coverStyle = model.coverImage
    ? {
        backgroundImage: `url(${model.coverImage})`,
        backgroundSize: "cover" as const,
        backgroundPosition: "center" as const,
      }
    : { background: model.coverGradient };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(model.href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(model.href);
      }}
      className="cursor-pointer overflow-hidden rounded-[14px] border border-[#e5e9f0] bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)] transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5AA0]"
    >
      {/* Kapak */}
      <div className="relative h-[150px]" style={coverStyle}>
        {model.tag && (
          <span
            className={`absolute left-3 top-3 rounded-full px-[9px] py-1 text-[11px] font-semibold text-white ${TAG_BG[model.tag.color]}`}
          >
            {model.tag.label}
          </span>
        )}
        <div className="absolute bottom-3 left-3 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[rgba(15,23,42,.75)]">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        {model.durationLabel && (
          <span className="absolute bottom-[14px] right-3 rounded-md bg-[rgba(15,23,42,.75)] px-2 py-[3px] text-[11px] font-medium text-white">
            {model.durationLabel}
          </span>
        )}
      </div>

      {/* Gövde */}
      <div className="px-4 pb-4 pt-3.5">
        <div className="line-clamp-2 min-h-[40px] text-[15px] font-semibold leading-[1.35] text-[#0f172a]">
          {model.title}
        </div>
        <div className="mt-1.5 text-[12.5px] text-[#64748b]">{model.metaLine}</div>

        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-[#e5e9f0]">
            <span
              className="block h-full rounded-[3px]"
              style={{
                width: `${model.progressPercent}%`,
                background: "linear-gradient(90deg,#12B5CB,#1A5AA0)",
              }}
            />
          </div>
          <span className="w-[34px] text-right text-[12px] font-medium text-[#475569]">
            {model.progressPercent}%
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span
            className={`text-[12px] ${model.due?.warn ? "font-medium text-[#dc2626]" : "text-[#64748b]"}`}
          >
            {model.due?.label ?? ""}
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <SplitBadge
              color={model.badge.color}
              left={model.badge.left}
              right={model.badge.right}
              href={model.badge.href}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
