"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminStatCard } from "@/components/akademi/admin/AdminStatCard";
import { ProgressBar } from "@/components/akademi/shared/ProgressBar";

type UserStatus = "completed" | "overdue" | "in_progress" | "not_started";

interface BoardMeta {
  scope: "full" | "own";
  bolums: string[];
  packages: { id: string; name: string }[];
}

interface BoardRow {
  userId: string;
  name: string;
  assigned: number;
  completed: number;
  percent: number;
  nearestDueDate: string | null;
  overdueCount: number;
  status: UserStatus;
}

interface BoardData {
  bolum: string;
  packageId: string | null;
  summary: {
    totalUsers: number;
    totalAssignments: number;
    completed: number;
    inProgress: number;
    overdue: number;
    completionPct: number;
  };
  users: BoardRow[];
}

const STATUS_CFG: Record<
  UserStatus,
  { label: string; color: "green" | "red" | "accent" | null }
> = {
  completed: { label: "Tamamlandı", color: "green" },
  overdue: { label: "Geciken", color: "red" },
  in_progress: { label: "Devam", color: "accent" },
  not_started: { label: "Başlamadı", color: null },
};

function StatusBadge({ status }: { status: UserStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={
        cfg.color
          ? {
              background: `var(--ak-${cfg.color}-glow)`,
              color: `var(--ak-${cfg.color})`,
            }
          : {
              background: "var(--ak-surface-secondary)",
              color: "var(--ak-text-tertiary)",
            }
      }
    >
      {cfg.label}
    </span>
  );
}

export function DepartmentBoardTab() {
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [bolum, setBolum] = useState("");
  const [packageId, setPackageId] = useState("");
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(false);

  // Meta: scope + izinli bölümler + paketler. İlk bölümü pre-select.
  useEffect(() => {
    fetch("/api/akademi/admin/reports/department-board")
      .then((r) => (r.ok ? r.json() : null))
      .then((m: BoardMeta | null) => {
        setMeta(m);
        if (m?.bolums?.length) setBolum(m.bolums[0]);
      })
      .catch(() => setMeta(null));
  }, []);

  const loadBoard = useCallback(() => {
    if (!bolum) return;
    setLoading(true);
    const qs = new URLSearchParams({ bolum });
    if (packageId) qs.set("packageId", packageId);
    fetch(`/api/akademi/admin/reports/department-board?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BoardData | null) => setBoard(d))
      .catch(() => setBoard(null))
      .finally(() => setLoading(false));
  }, [bolum, packageId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const selectCls =
    "px-3 py-2 text-sm rounded-md border bg-white min-w-[200px]";

  return (
    <div className="space-y-4">
      {/* Filtreler */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            className="text-xs font-medium block"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            Bölüm
          </label>
          <select
            className={selectCls}
            style={{ borderColor: "var(--ak-border-default)" }}
            value={bolum}
            onChange={(e) => setBolum(e.target.value)}
            disabled={!meta || meta.bolums.length <= 1}
          >
            {(meta?.bolums ?? []).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label
            className="text-xs font-medium block"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            Kampanya / Paket
          </label>
          <select
            className={selectCls}
            style={{ borderColor: "var(--ak-border-default)" }}
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
          >
            <option value="">Tüm atamalar</option>
            {(meta?.packages ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!bolum ? (
        <div
          className="text-center py-12 text-sm border border-dashed rounded-lg"
          style={{
            borderColor: "var(--ak-border-default)",
            color: "var(--ak-text-tertiary)",
          }}
        >
          Görüntülenecek bölüm bulunamadı.
        </div>
      ) : (
        <>
          {/* Özet StatCard'lar */}
          {board && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <AdminStatCard
                icon="package"
                label="Toplam Atama"
                value={board.summary.totalAssignments}
                color="accent"
                delayIndex={1}
              />
              <AdminStatCard
                icon="award"
                label="Tamamlanan"
                value={board.summary.completed}
                suffix={` (%${board.summary.completionPct})`}
                color="green"
                delayIndex={2}
              />
              <AdminStatCard
                icon="trendingUp"
                label="Devam Eden"
                value={board.summary.inProgress}
                color="orange"
                delayIndex={3}
              />
              <AdminStatCard
                icon="clock"
                label="Geciken"
                value={board.summary.overdue}
                color="red"
                delayIndex={4}
              />
            </div>
          )}

          {/* Çalışan tablosu */}
          {loading ? (
            <div
              className="text-sm"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              Yükleniyor...
            </div>
          ) : !board || board.users.length === 0 ? (
            <div
              className="text-center py-12 text-sm border border-dashed rounded-lg"
              style={{
                borderColor: "var(--ak-border-default)",
                color: "var(--ak-text-tertiary)",
              }}
            >
              Bu bölümde çalışan bulunamadı.
            </div>
          ) : (
            <div
              className="rounded-lg overflow-hidden border bg-white"
              style={{ borderColor: "var(--ak-border-default)" }}
            >
              <table className="w-full text-sm">
                <thead style={{ background: "var(--ak-surface-secondary)" }}>
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                      Çalışan
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase w-48">
                      İlerleme
                    </th>
                    <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                      Atanan
                    </th>
                    <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                      Tamamlanan
                    </th>
                    <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                      Son Tarih
                    </th>
                    <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                      Durum
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {board.users.map((u) => (
                    <tr
                      key={u.userId}
                      className="border-t hover:bg-slate-50"
                      style={{ borderColor: "var(--ak-border-divider)" }}
                    >
                      <td className="px-4 py-2 font-medium">{u.name}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <ProgressBar
                              value={u.percent}
                              size="sm"
                              color={
                                u.status === "completed"
                                  ? "green"
                                  : u.status === "overdue"
                                    ? "red"
                                    : "accent"
                              }
                            />
                          </div>
                          <span
                            className="text-xs tabular-nums w-9 text-right"
                            style={{ color: "var(--ak-text-tertiary)" }}
                          >
                            %{u.percent}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center">{u.assigned}</td>
                      <td className="px-4 py-2 text-center">{u.completed}</td>
                      <td className="px-4 py-2 text-center">
                        {u.nearestDueDate ? (
                          <span
                            style={
                              u.overdueCount > 0
                                ? { color: "var(--ak-red)", fontWeight: 600 }
                                : undefined
                            }
                          >
                            {new Date(u.nearestDueDate).toLocaleDateString(
                              "tr-TR"
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <StatusBadge status={u.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
