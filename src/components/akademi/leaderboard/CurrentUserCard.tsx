"use client";

import type { LeaderboardEntry } from "@/types/akademi";

interface Props {
  entry: LeaderboardEntry | null;
}

export function CurrentUserCard({ entry }: Props) {
  if (!entry) return null;

  return (
    <div
      className="sticky top-14 z-10 mb-6 rounded-[14px] p-4 flex items-center gap-4 ak-animate-in"
      style={{
        background: "var(--ak-accent)",
        color: "#fff",
        boxShadow: "var(--ak-accent-shadow)",
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
        style={{ background: "rgba(255,255,255,0.2)" }}
      >
        {entry.avatarInitials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wide opacity-80">
          Sıralamadaki yerin
        </div>
        <div className="text-lg font-bold truncate">{entry.name}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs uppercase tracking-wide opacity-80">Sıran</div>
        <div className="text-2xl font-bold">#{entry.rank}</div>
      </div>
      <div
        className="text-right shrink-0 pl-4 border-l"
        style={{ borderColor: "rgba(255,255,255,0.2)" }}
      >
        <div className="text-xs uppercase tracking-wide opacity-80">XP</div>
        <div className="text-2xl font-bold">{entry.xp}</div>
      </div>
    </div>
  );
}
