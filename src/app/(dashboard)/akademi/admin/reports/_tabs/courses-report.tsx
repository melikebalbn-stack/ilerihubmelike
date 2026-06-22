"use client";

import { useEffect, useState } from "react";

type CourseRow = {
  id: string;
  title: string;
  isActive: boolean;
  contentCount: number;
  examCount: number;
  assignmentCount: number;
  certificateCount: number;
  enrolled: number;
  completed: number;
  completionRate: number;
  avgScore: number;
  passRate: number;
  totalAttempts: number;
};

export function CoursesReportTab() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/akademi/admin/reports/courses")
      .then((r) => r.json())
      .then((d) => setCourses(d.courses ?? []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
        Yükleniyor...
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div
        className="text-center py-12 text-sm border border-dashed rounded-lg"
        style={{
          borderColor: "var(--ak-border-default)",
          color: "var(--ak-text-tertiary)",
        }}
      >
        Henüz kurs yok
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
              Kurs
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              İçerik
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Sınav
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Atama
            </th>
            <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
              Tamamlama
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
          {courses.map((c) => (
            <tr
              key={c.id}
              className="border-t hover:bg-slate-50"
              style={{ borderColor: "var(--ak-border-divider)" }}
            >
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.title}</span>
                  {!c.isActive && (
                    <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                      Pasif
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-2 text-center">{c.contentCount}</td>
              <td className="px-4 py-2 text-center">{c.examCount}</td>
              <td className="px-4 py-2 text-center">{c.assignmentCount}</td>
              <td className="px-4 py-2 text-center">
                {c.completed}/{c.enrolled}{" "}
                <span
                  className="text-xs"
                  style={{ color: "var(--ak-text-tertiary)" }}
                >
                  (%{c.completionRate})
                </span>
              </td>
              <td className="px-4 py-2 text-center">
                {c.totalAttempts > 0 ? `%${c.passRate}` : "—"}
              </td>
              <td className="px-4 py-2 text-center font-semibold">
                {c.certificateCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
