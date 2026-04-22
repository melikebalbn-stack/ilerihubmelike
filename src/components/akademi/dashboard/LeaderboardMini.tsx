"use client";

import Link from "next/link";
import { Medal, ChevronRight } from "lucide-react";
import type { LeaderboardEntry } from "@/types/akademi";

interface Props {
  entries: LeaderboardEntry[];
}

export function LeaderboardMini({ entries }: Props) {
  const top5 = entries.slice(0, 5);

  return (
    <div className="ak-card-static p-5 ak-animate-in ak-delay-2">
      <div className="flex items-center justify-between mb-4">
        <div
          className="text-sm font-bold"
          style={{ color: "var(--ak-text-primary)" }}
        >
          🏆 Sıralama
        </div>
        <Link
          href="/akademi/leaderboard"
          className="text-xs font-medium flex items-center gap-1"
          style={{ color: "var(--ak-accent)" }}
        >
          Tümü
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {top5.length === 0 ? (
        <div
          className="text-sm text-center py-4"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Henüz sıralama yok
        </div>
      ) : (
        <div className="space-y-2">
          {top5.map((entry) => (
            <div
              key={entry.userId}
              className="flex items-center gap-3 p-2 rounded-lg"
              style={{
                background: entry.isCurrentUser
                  ? "var(--ak-accent-glow)"
                  : "transparent",
              }}
            >
              <div className="w-6 flex justify-center shrink-0">
                {entry.rank <= 3 ? (
                  <Medal
                    className="w-4 h-4"
                    style={{
                      color:
                        entry.rank === 1
                          ? "#fbbf24"
                          : entry.rank === 2
                          ? "#94a3b8"
                          : "#d97706",
                    }}
                  />
                ) : (
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--ak-text-tertiary)" }}
                  >
                    {entry.rank}
                  </span>
                )}
              </div>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: "var(--ak-accent-glow)",
                  color: "var(--ak-accent)",
                }}
              >
                {entry.avatarInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--ak-text-primary)" }}
                >
                  {entry.name}
                  {entry.isCurrentUser && (
                    <span
                      className="ml-1 text-xs"
                      style={{ color: "var(--ak-accent)" }}
                    >
                      (Sen)
                    </span>
                  )}
                </div>
              </div>
              <div
                className="text-sm font-bold shrink-0"
                style={{ color: "var(--ak-text-primary)" }}
              >
                {entry.xp} XP
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
