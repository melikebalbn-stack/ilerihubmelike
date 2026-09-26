"use client";

import { useRouter } from "next/navigation";
import { SplitBadge } from "@/components/akademi/SplitBadge";
import {
  buildExamCardModel,
  type ExamCardInput,
} from "@/lib/akademi/exam-card-model";

const TAG_BG: Record<"green" | "red" | "gray" | "amber", string> = {
  green: "bg-[#16a34a]",
  red: "bg-[#dc2626]",
  gray: "bg-[#64748b]",
  amber: "bg-[#f97316]",
};

/**
 * Sınav kartı — CourseCard ile aynı görünüm ailesi. Tüm kart tıklanabilir
 * (onClick → sınav); aksiyon rozeti ayrı link (nested <a> olmasın diye kök div).
 */
export function ExamCard({ exam }: { exam: ExamCardInput }) {
  const router = useRouter();
  const m = buildExamCardModel(exam);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(m.href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(m.href);
      }}
      className="cursor-pointer overflow-hidden rounded-[14px] border border-[#e5e9f0] bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)] transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5AA0]"
    >
      {/* Kapak */}
      <div className="relative h-[150px]" style={{ background: m.coverGradient }}>
        {m.tag && (
          <span
            className={`absolute left-3 top-3 rounded-full px-[9px] py-1 text-[11px] font-semibold text-white ${TAG_BG[m.tag.color]}`}
          >
            {m.tag.label}
          </span>
        )}
        <span className="absolute bottom-[14px] right-3 rounded-md bg-[rgba(15,23,42,.75)] px-2 py-[3px] text-[11px] font-medium text-white">
          {m.durationBadge}
        </span>
      </div>

      {/* Gövde */}
      <div className="px-4 pb-4 pt-3.5">
        <div className="line-clamp-2 min-h-[40px] text-[15px] font-semibold leading-[1.35] text-[#0f172a]">
          {m.title}
        </div>
        <div className="mt-1.5 text-[12.5px] text-[#64748b]">{m.metaLine}</div>

        {m.lastScore && (
          <span
            className={`mt-2 inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
              m.lastScore.passed
                ? "bg-[#dcfce7] text-[#166534]"
                : "bg-[#fee2e2] text-[#991b1b]"
            }`}
          >
            {m.lastScore.label}
          </span>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[12px] text-[#64748b]">{m.footerLeft}</span>
          <span onClick={(e) => e.stopPropagation()}>
            <SplitBadge
              color={m.badge.color}
              left={m.badge.left}
              right={m.badge.right}
              href={m.badge.href}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
