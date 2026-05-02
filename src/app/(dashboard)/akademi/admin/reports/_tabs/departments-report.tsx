"use client";

import { useEffect, useState } from "react";

type DeptRow = {
  bolum: string;
  userCount: number;
  completedCourses: number;
  totalAttempts: number;
  passedAttempts: number;
  passRate: number;
  certificateCount: number;
};

export function DepartmentsReportTab() {
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div
      className="rounded-lg overflow-hidden border bg-white"
      style={{ borderColor: "var(--ak-border-default)" }}
    >
      <table className="w-full text-sm">
        <thead style={{ background: "var(--ak-surface-secondary)" }}>
          <tr>
            <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
              Bölüm
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Kullanıcı
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Tamamlanan Kurs
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
          {departments.map((d) => (
            <tr
              key={d.bolum}
              className="border-t hover:bg-slate-50"
              style={{ borderColor: "var(--ak-border-divider)" }}
            >
              <td className="px-4 py-2 font-medium">{d.bolum}</td>
              <td className="px-4 py-2 text-center">{d.userCount}</td>
              <td className="px-4 py-2 text-center">{d.completedCourses}</td>
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
  );
}
