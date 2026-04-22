"use client";

import { useEffect, useState } from "react";
import { Podium } from "@/components/akademi/leaderboard/Podium";
import { LeaderboardRow } from "@/components/akademi/leaderboard/LeaderboardRow";
import { CurrentUserCard } from "@/components/akademi/leaderboard/CurrentUserCard";
import type { LeaderboardResponse } from "@/types/akademi";

export default function AkademiLeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/akademi/leaderboard")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-8 py-7 max-w-5xl mx-auto">
        <div
          className="text-sm text-center py-12"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Sıralama yükleniyor...
        </div>
      </div>
    );
  }

  if (!data || data.top.length === 0) {
    return (
      <div className="px-8 py-7 max-w-5xl mx-auto">
        <div
          className="ak-card-static p-8 text-center"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Henüz sıralamada kimse yok.
        </div>
      </div>
    );
  }

  const top3 = data.top.slice(0, 3);
  const rest = data.top.slice(3);

  return (
    <div className="px-8 py-7 max-w-5xl mx-auto">
      <div className="mb-6 ak-animate-in">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ color: "var(--ak-text-primary)" }}
        >
          🏆 Sıralama
        </h1>
        <p
          className="text-sm"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          XP puanına göre en başarılı öğrenciler
        </p>
      </div>

      {data.currentUser && data.currentUser.rank > 3 && (
        <CurrentUserCard entry={data.currentUser} />
      )}

      <Podium top3={top3} />

      {rest.length > 0 && (
        <div className="space-y-2.5 mt-6">
          <div
            className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            Sıralamanın Devamı
          </div>
          {rest.map((e, i) => (
            <LeaderboardRow
              key={e.userId}
              entry={e}
              delayIndex={Math.min(i + 1, 8)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
