"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

type DeptRow = {
  bolum: string;
  userCount: number;
  yakalar: { YONETICI: number; BEYAZ: number; GRI: number; MAVI: number };
  completedCourses: number;
  sinavaGirmeyen: number;
  totalAttempts: number;
  passedAttempts: number;
  passRate: number;
  certificateCount: number;
};

export function DepartmentsReportTab() {
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Süzgeçler istemcide: bölüm listesi küçük, her tuşta sunucuya gitmek gereksiz.
  const [yakaFilter, setYakaFilter] = useState("");
  const [sadeceEksik, setSadeceEksik] = useState(false);

  const gosterilen = useMemo(() => {
    const ara = search.trim().toLocaleLowerCase("tr-TR");
    return departments.filter((d) => {
      if (ara && !d.bolum.toLocaleLowerCase("tr-TR").includes(ara)) return false;
      // Yaka süzgeci: o yakadan en az bir kişisi olan bölümler.
      if (yakaFilter && !(d.yakalar?.[yakaFilter as keyof DeptRow["yakalar"]] > 0))
        return false;
      if (sadeceEksik && d.sinavaGirmeyen === 0) return false;
      return true;
    });
  }, [departments, search, yakaFilter, sadeceEksik]);

  useEffect(() => {
    fetch("/api/akademi/admin/reports/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments ?? []))
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
        Yükleniyor...
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div
        className="text-center py-12 text-sm border border-dashed rounded-lg"
        style={{
          borderColor: "var(--ak-border-default)",
          color: "var(--ak-text-tertiary)",
        }}
      >
        Henüz personel-bağlantılı bölüm yok
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Bölüm ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md"
            style={{ borderColor: "var(--ak-border-default)" }}
          />
        </div>
        <select
          value={yakaFilter}
          onChange={(e) => setYakaFilter(e.target.value)}
          className="px-3 py-2 text-sm border rounded-md bg-white"
          style={{ borderColor: "var(--ak-border-default)" }}
          title="Seçilen yakadan en az bir kişisi olan bölümler"
        >
          <option value="">Tüm yakalar</option>
          <option value="YONETICI">Yönetici olanlar</option>
          <option value="BEYAZ">Beyaz yaka olanlar</option>
          <option value="GRI">Gri yaka olanlar</option>
          <option value="MAVI">Mavi yaka olanlar</option>
        </select>
        <label
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md bg-white cursor-pointer select-none"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <input
            type="checkbox"
            checked={sadeceEksik}
            onChange={(e) => setSadeceEksik(e.target.checked)}
            className="w-4 h-4"
          />
          Sınava girmeyeni olanlar
        </label>
        <span
          className="text-xs ml-auto"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          {gosterilen.length} / {departments.length} bölüm
        </span>
      </div>

    <div
      className="rounded-lg overflow-hidden border bg-white"
      style={{ borderColor: "var(--ak-border-default)" }}
    >
      <table className="w-full text-xs">
        <thead style={{ background: "var(--ak-surface-secondary)" }}>
          <tr>
            <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
              Bölüm
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Kullanıcı
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Yönetici
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Beyaz
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Gri
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Mavi
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Tamamlanan Kurs
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Sınava girmeyen
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Sınav Denemesi
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Geçen
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Geçme %
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Sertifika
            </th>
          </tr>
        </thead>
        <tbody>
          {gosterilen.map((d) => (
            <tr
              key={d.bolum}
              className="border-t hover:bg-slate-50"
              style={{ borderColor: "var(--ak-border-divider)" }}
            >
              <td className="px-4 py-2 font-medium">{d.bolum}</td>
              <td className="px-4 py-2 text-center font-medium">
                {d.userCount}
              </td>
              <td className="px-4 py-2 text-center text-slate-600">
                {d.yakalar?.YONETICI || "—"}
              </td>
              <td className="px-4 py-2 text-center text-slate-600">
                {d.yakalar?.BEYAZ || "—"}
              </td>
              <td className="px-4 py-2 text-center text-slate-600">
                {d.yakalar?.GRI || "—"}
              </td>
              <td className="px-4 py-2 text-center text-slate-600">
                {d.yakalar?.MAVI || "—"}
              </td>
              <td className="px-4 py-2 text-center">{d.completedCourses}</td>
              <td className="px-4 py-2 text-center">
                {d.sinavaGirmeyen > 0 ? (
                  <span className="text-amber-700 font-medium">
                    {d.sinavaGirmeyen}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-2 text-center">{d.totalAttempts}</td>
              <td className="px-4 py-2 text-center">{d.passedAttempts}</td>
              <td className="px-4 py-2 text-center">
                {d.totalAttempts > 0 ? `%${d.passRate}` : "—"}
              </td>
              <td className="px-4 py-2 text-center font-semibold">
                {d.certificateCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}
