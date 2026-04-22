"use client";

import { Trophy, TrendingUp } from "lucide-react";
import { AnimatedNumber } from "@/components/akademi/shared/AnimatedNumber";
import { ProgressBar } from "@/components/akademi/shared/ProgressBar";
import type { XpSummary } from "@/types/akademi";

interface Props {
  summary: XpSummary;
}

export function XpCard({ summary }: Props) {
  const nextPct =
    summary.nextLevelAt && summary.nextLevelAt > 0
      ? Math.min(100, (summary.xp / summary.nextLevelAt) * 100)
      : 100;

  return (
    <div className="ak-card-static p-5 ak-animate-in ak-delay-1">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--ak-purple-glow)" }}
        >
          <Trophy className="w-6 h-6" style={{ color: "var(--ak-purple)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            Seviye {summary.level}
          </div>
          <div
            className="text-base font-bold truncate"
            style={{ color: "var(--ak-text-primary)" }}
          >
            {summary.levelTitle}
          </div>
        </div>
      </div>

      <div
        className="text-3xl font-bold mb-1"
        style={{ color: "var(--ak-text-primary)" }}
      >
        <AnimatedNumber value={summary.xp} suffix=" XP" />
      </div>

      {summary.nextLevelAt && (
        <>
          <div
            className="text-xs mb-2"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            Sonraki seviye: {summary.nextLevelAt} XP
          </div>
          <ProgressBar value={nextPct} size="sm" color="purple" />
        </>
      )}

      {summary.recentHistory.length > 0 && (
        <div
          className="mt-4 pt-4 border-t"
          style={{ borderColor: "var(--ak-border-divider)" }}
        >
          <div
            className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            Son Kazanımlar
          </div>
          <div className="space-y-1.5">
            {summary.recentHistory.slice(0, 3).map((h) => (
              <div key={h.id} className="flex items-center gap-2 text-xs">
                <TrendingUp
                  className="w-3 h-3 shrink-0"
                  style={{ color: "var(--ak-green)" }}
                />
                <span
                  className="font-semibold"
                  style={{ color: "var(--ak-green)" }}
                >
                  +{h.amount}
                </span>
                <span
                  className="truncate"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {h.reason}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
