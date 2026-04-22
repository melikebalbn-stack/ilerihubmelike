"use client";

import { motion } from "framer-motion";
import type { LeaderboardEntry } from "@/types/akademi";

interface Props {
  top3: LeaderboardEntry[];
}

const PODIUM_CONFIG = [
  { rank: 2, height: "h-24", emoji: "🥈", color: "#94a3b8", delay: 0.2 },
  { rank: 1, height: "h-32", emoji: "🥇", color: "#fbbf24", delay: 0 },
  { rank: 3, height: "h-20", emoji: "🥉", color: "#d97706", delay: 0.4 },
];

export function Podium({ top3 }: Props) {
  const byRank = (r: number) => top3.find((e) => e.rank === r);

  return (
    <div className="flex items-end justify-center gap-3 md:gap-6 mb-8 px-4">
      {PODIUM_CONFIG.map((p) => {
        const entry = byRank(p.rank);
        if (!entry) {
          return <div key={p.rank} className={`flex-1 ${p.height}`} />;
        }

        return (
          <motion.div
            key={p.rank}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              delay: p.delay,
              type: "spring",
              stiffness: 120,
              damping: 14,
            }}
            className="flex-1 max-w-[180px] flex flex-col items-center"
          >
            <div className="text-4xl mb-2">{p.emoji}</div>
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold mb-2"
              style={{
                background: entry.isCurrentUser
                  ? "var(--ak-accent)"
                  : "var(--ak-accent-glow)",
                color: entry.isCurrentUser ? "#fff" : "var(--ak-accent)",
                boxShadow: `0 4px 16px ${p.color}40`,
              }}
            >
              {entry.avatarInitials}
            </div>
            <div
              className="text-sm font-bold text-center mb-0.5 truncate w-full px-1"
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
            <div
              className="text-xs mb-3"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              {entry.xp} XP · Seviye {entry.level}
            </div>
            <div
              className={`w-full ${p.height} rounded-t-xl flex items-start justify-center pt-3`}
              style={{ background: p.color }}
            >
              <span className="text-3xl font-bold text-white/90">
                {p.rank}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
