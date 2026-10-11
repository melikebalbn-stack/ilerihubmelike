"use client";

import { useEffect, useState, useCallback } from "react";
import { Search } from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  bolum: string | null;
  yaka: "YONETICI" | "BEYAZ" | "GRI" | "MAVI" | null;
  atananKurs: number;
  completedCourses: number;
  totalCourseProgress: number;
  atananSinav: number;
  gectigiSinav: number;
  kaldigiSinav: number;
  girmedigiSinav: number;
  passedExams: number;
  totalAttempts: number;
  avgScore: number;
  certificateCount: number;
};

const YAKA_ETIKET: Record<NonNullable<UserRow["yaka"]>, string> = {
  YONETICI: "Yönetici",
  BEYAZ: "Beyaz yaka",
  GRI: "Gri yaka",
  MAVI: "Mavi yaka",
};

export function UsersReportTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [bolums, setBolums] = useState<string[]>([]);
  const [bolumFilter, setBolumFilter] = useState("");
  const [yakaFilter, setYakaFilter] = useState("");
  // Varsayılan KAPALI: tüm aktif kullanıcılar (bluecollar dahil) listelenir.
  const [onlyAssigned, setOnlyAssigned] = useState(false);

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
    if (yakaFilter) params.set("yaka", yakaFilter);
    if (onlyAssigned) params.set("onlyAssigned", "1");
    fetch(`/api/akademi/admin/reports/users?${params}`)
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [search, bolumFilter, yakaFilter, onlyAssigned]);

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
        <select
          value={yakaFilter}
          onChange={(e) => setYakaFilter(e.target.value)}
          className="px-3 py-2 text-sm border rounded-md bg-white"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <option value="">Tüm yakalar</option>
          <option value="YONETICI">Yönetici</option>
          <option value="BEYAZ">Beyaz yaka</option>
          <option value="GRI">Gri yaka</option>
          <option value="MAVI">Mavi yaka</option>
        </select>
        <label
          className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md bg-white cursor-pointer select-none"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <input
            type="checkbox"
            checked={onlyAssigned}
            onChange={(e) => setOnlyAssigned(e.target.checked)}
          />
          Yalnız akademi ataması olanlar
        </label>
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
          <table className="w-full text-xs">
            <thead style={{ background: "var(--ak-surface-secondary)" }}>
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                  Ad Soyad
                </th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                  Bölüm
                </th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                  Yaka
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                  Kurs (biten/atanan)
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                  Atanan sınav
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                  Geçti
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                  Kaldı
                </th>
                <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                  Girmedi
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
                  <td
                    className="px-4 py-2"
                    style={{ color: "var(--ak-text-secondary)" }}
                  >
                    {u.yaka ? YAKA_ETIKET[u.yaka] : "—"}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {u.atananKurs > 0
                      ? `${u.completedCourses}/${u.atananKurs}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-center font-medium">
                    {u.atananSinav || "—"}
                  </td>
                  <td className="px-4 py-2 text-center text-green-700 font-medium">
                    {u.gectigiSinav || "—"}
                  </td>
                  <td className="px-4 py-2 text-center text-red-700 font-medium">
                    {u.kaldigiSinav || "—"}
                  </td>
                  <td className="px-4 py-2 text-center text-slate-500">
                    {u.girmedigiSinav || "—"}
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
