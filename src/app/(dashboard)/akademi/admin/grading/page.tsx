"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Clock, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

type PendingAttempt = {
  id: string;
  score: number | null;
  startedAt: string;
  completedAt: string;
  user: { id: string; name: string; email: string };
  exam: { id: string; title: string; passingScore: number };
  manualTotal: number;
  manualGraded: number;
  progress: number;
};

export default function AdminGradingPage() {
  const [attempts, setAttempts] = useState<PendingAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    fetch(`/api/akademi/admin/grading/pending?${params}`)
      .then((r) => (r.ok ? r.json() : { attempts: [] }))
      .then((d) => setAttempts(d.attempts ?? []))
      .catch(() => {
        toast.error("Liste yüklenemedi");
        setAttempts([]);
      })
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="ak-animate-in space-y-4">
      <div className="relative max-w-md">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--ak-text-tertiary)" }}
        />
        <input
          type="text"
          placeholder="Kullanıcı veya sınav ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border rounded-md"
          style={{
            borderColor: "var(--ak-border-default)",
            background: "var(--ak-surface-input)",
            color: "var(--ak-text-primary)",
          }}
        />
      </div>

      {loading && (
        <div
          className="ak-card-static p-8 text-center text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Yükleniyor...
        </div>
      )}

      {!loading && attempts.length === 0 && (
        <div
          className="text-center py-12 text-sm border border-dashed rounded-lg"
          style={{
            borderColor: "var(--ak-border-default)",
            color: "var(--ak-text-tertiary)",
          }}
        >
          {search
            ? "Aramayla eşleşen attempt bulunamadı"
            : "Bekleyen değerlendirme yok 🎉"}
        </div>
      )}

      {!loading && attempts.length > 0 && (
        <div className="space-y-2">
          {attempts.map((a) => (
            <Link
              key={a.id}
              href={`/akademi/admin/grading/${a.id}`}
              className="block border rounded-lg p-4 bg-white hover:bg-slate-50 transition-colors"
              style={{ borderColor: "var(--ak-border-default)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-semibold"
                    style={{ color: "var(--ak-text-primary)" }}
                  >
                    {a.exam.title}
                  </h3>
                  <div
                    className="text-sm mt-1 inline-flex items-center gap-1"
                    style={{ color: "var(--ak-text-secondary)" }}
                  >
                    <UserIcon size={12} />
                    <strong>{a.user.name}</strong>
                    <span style={{ color: "var(--ak-text-tertiary)" }}>
                      ({a.user.email})
                    </span>
                  </div>
                  <div
                    className="text-xs mt-1 inline-flex items-center gap-1"
                    style={{ color: "var(--ak-text-tertiary)" }}
                  >
                    <Clock size={11} />
                    Bitirildi:{" "}
                    {new Date(a.completedAt).toLocaleString("tr-TR")}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "var(--ak-text-primary)" }}
                  >
                    {a.manualGraded}/{a.manualTotal} graded
                  </div>
                  <div className="w-32 h-2 bg-slate-200 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all"
                      style={{ width: `${a.progress}%` }}
                    />
                  </div>
                  <div
                    className="text-xs mt-1"
                    style={{ color: "var(--ak-text-tertiary)" }}
                  >
                    %{a.progress}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
