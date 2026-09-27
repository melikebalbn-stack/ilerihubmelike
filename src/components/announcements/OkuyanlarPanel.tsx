"use client";

import { useEffect, useMemo, useState } from "react";

type ReadRow = {
  userName: string;
  userDepartment: string | null;
  readAt: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
};

type Stats = {
  totalReads: number;
  acknowledged: number;
  notAcknowledged: number;
  byDepartment: Record<string, { total: number; acknowledged: number }>;
  reads: ReadRow[];
};

function trTarih(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Yönetici görünümü: bir duyuruyu görenler/onaylayanlar (sayı + kişi listesi,
 * bölüm filtreli). Yalnız duyuru.admin/create sahipleri için detay sayfasında.
 * Veri: GET /api/announcements/[id]/acknowledge (readAt=gördü, acknowledged=onayladı).
 */
export function OkuyanlarPanel({
  announcementId,
  requireAcknowledgment,
}: {
  announcementId: string;
  requireAcknowledgment: boolean;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [dept, setDept] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/announcements/${announcementId}/acknowledge`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Stats | null) => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [announcementId]);

  const depts = useMemo(() => {
    if (!stats) return [];
    return Object.keys(stats.byDepartment).sort((a, b) => a.localeCompare(b, "tr"));
  }, [stats]);

  const rows = useMemo(() => {
    if (!stats) return [];
    return stats.reads.filter((r) => dept === "all" || (r.userDepartment || "Bilinmiyor") === dept);
  }, [stats, dept]);

  if (loading) return <div className="text-sm text-muted-foreground">Okuyanlar yükleniyor…</div>;
  if (!stats) return null;

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-3 text-lg font-semibold">Okuyanlar</h3>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold">{stats.totalReads}</div>
          <div className="text-xs text-muted-foreground">Gördü</div>
        </div>
        {requireAcknowledgment ? (
          <>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.acknowledged}</div>
              <div className="text-xs text-muted-foreground">Onayladı</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.notAcknowledged}</div>
              <div className="text-xs text-muted-foreground">Onay bekliyor</div>
            </div>
          </>
        ) : (
          <div className="col-span-2 rounded-lg border p-3 text-center text-sm text-muted-foreground">
            Bu duyuru okundu onayı gerektirmiyor.
          </div>
        )}
      </div>

      <div className="mb-3">
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="rounded-lg border bg-background px-3 py-1.5 text-sm"
        >
          <option value="all">Tüm bölümler</option>
          {depts.map((d) => (
            <option key={d} value={d}>
              {d} ({stats.byDepartment[d].total})
            </option>
          ))}
        </select>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Kişi</th>
              <th className="px-3 py-2">Bölüm</th>
              <th className="px-3 py-2">Gördü</th>
              {requireAcknowledgment && <th className="px-3 py-2">Onay</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.userName}-${i}`} className="border-t">
                <td className="px-3 py-2">{r.userName}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.userDepartment || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{trTarih(r.readAt)}</td>
                {requireAcknowledgment && (
                  <td className="px-3 py-2">
                    {r.acknowledged ? (
                      <span className="text-green-600">✓ {trTarih(r.acknowledgedAt)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={requireAcknowledgment ? 4 : 3} className="px-3 py-6 text-center text-muted-foreground">
                  Kayıt yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
