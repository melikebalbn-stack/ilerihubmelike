"use client";

import { Medal } from "lucide-react";
import type { LeaderboardEntry } from "@/types/akademi";

interface Props {
  entry: LeaderboardEntry;
  delayIndex?: number;
}

export function LeaderboardRow({ entry, delayIndex = 1 }: Props) {
  const medalColor =
    entry.rank === 1
      ? "#fbbf24"
      : entry.rank === 2
      ? "#94a3b8"
      : entry.rank === 3
      ? "#d97706"
      : null;

  return (
    <div
      className={`ak-card-static p-3 flex items-center gap-4 ak-animate-in ak-delay-${Math.min(
        delayIndex,
        8
      )}`}
      style={{
        background: entry.isCurrentUser
          ? "var(--ak-accent-glow)"
          : "var(--ak-bg-card)",
        borderColor: entry.isCurrentUser
          ? "var(--ak-accent)"
          : "var(--ak-border-card)",
        borderLeft: entry.isCurrentUser
          ? "4px solid var(--ak-accent)"
          : "1px solid var(--ak-border-card)",
      }}
    >
      <div className="w-10 flex justify-center shrink-0">
        {medalColor ? (
          <Medal className="w-5 h-5" style={{ color: medalColor }} />
        ) : (
          <span
            className="text-sm font-bold"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            {entry.rank}
          </span>
        )}
      </div>

      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
        style={{
          background: "var(--ak-accent-glow)",
          color: "var(--ak-accent)",
        }}
      >
        {entry.avatarInitials}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-semibold truncate"
          style={{ color: "var(--ak-text-primary)" }}
        >
          {entry.name}
          {entry.isCurrentUser && (
            <span
              className="ml-1.5 text-xs font-normal"
              style={{ color: "var(--ak-accent)" }}
            >
              (Sen)
            </span>
          )}
        </div>
        {entry.department && (
          <div
            className="text-xs truncate"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            {entry.department}
          </div>
        )}
      </div>

      <div className="hidden sm:block text-right shrink-0">
        <div
          className="text-xs"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Seviye {entry.level}
        </div>
        {entry.levelTitle && (
          <div
            className="text-xs"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            {entry.levelTitle}
          </div>
        )}
      </div>

      <div
        className="text-base font-bold shrink-0"
        style={{ color: "var(--ak-accent)" }}
      >
        {entry.xp} XP
      </div>
    </div>
  );
}
