"use client";

import { useEffect, useState, useCallback } from "react";
import { Search } from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  bolum: string | null;
  completedCourses: number;
  totalCourseProgress: number;
  passedExams: number;
  totalAttempts: number;
  avgScore: number;
  certificateCount: number;
};

export function UsersReportTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [bolums, setBolums] = useState<string[]>([]);
  const [bolumFilter, setBolumFilter] = useState("");

  useEffect(() => {
    fetch("/api/akademi/admin/reports/departments")
      .then((r) => r.json())
      .then((d) => {
        setBolums(
          (d.departments ?? []).map(
            (b: { bolum: string }) => b.bolum
          )
        );
      })
      .catch(() => setBolums([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (bolumFilter) params.set("bolum", bolumFilter);
    fetch(`/api/akademi/admin/reports/users?${params}`)
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [search, bolumFilter]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Kullanıcı ara (ad, e-posta)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md"
            style={{ borderColor: "var(--ak-border-default)" }}
          />
        </div>
        <select
          value={bolumFilter}
          onChange={(e) => setBolumFilter(e.target.value)}
          className="px-3 py-2 text-sm border rounded-md bg-white"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <option value="">Tüm Bölümler</option>
          {bolums.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
          Yükleniyor...
        </div>
      )}

      {!loading && users.length === 0 && (
        <div
          className="text-center py-12 text-sm border border-dashed rounded-lg"
          style={{
            borderColor: "var(--ak-border-default)",
            color: "var(--ak-text-tertiary)",
          }}
        >
          Sonuç bulunamadı
        </div>
      )}

      {!loading && users.length > 0 && (
        <div
          className="rounded-lg overflow-hidden border bg-white"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <table className="w-full text-sm">
            <thead style={{ background: "var(--ak-surface-secondary)" }}>
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                  Ad Soyad
                </th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                  Bölüm
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                  Kurs
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                  Sınav
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                  Ort. Puan
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                  Sertifika
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-t hover:bg-slate-50"
                  style={{ borderColor: "var(--ak-border-divider)" }}
                >
                  <td className="px-4 py-2">
                    <div>{u.name}</div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--ak-text-tertiary)" }}
                    >
                      {u.email}
                    </div>
                  </td>
                  <td
                    className="px-4 py-2"
                    style={{ color: "var(--ak-text-secondary)" }}
                  >
                    {u.bolum ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {u.completedCourses}/{u.totalCourseProgress}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {u.passedExams}/{u.totalAttempts}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {u.avgScore > 0 ? `%${u.avgScore}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-center font-semibold">
                    {u.certificateCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
