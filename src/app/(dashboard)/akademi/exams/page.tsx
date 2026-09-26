"use client";

import { useEffect, useState, useMemo } from "react";
import { useAkademiAuth } from "@/lib/akademi-auth";
import { ExamCard } from "@/components/akademi/dashboard/ExamCard";
import { StatCard } from "@/components/akademi/dashboard/StatCard";
import { examsKpi } from "@/lib/akademi/page-kpi";
import type { ExamCardInput } from "@/lib/akademi/exam-card-model";

export default function UserExamsPage() {
  useAkademiAuth();
  const [exams, setExams] = useState<ExamCardInput[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/akademi/exams")
      .then((r) => (r.ok ? r.json() : { exams: [] }))
      .then((d) => setExams(d.exams ?? []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, []);

  const kpi = useMemo(() => examsKpi(exams), [exams]);

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto">
      <div className="mb-6 ak-animate-in">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ color: "var(--ak-text-primary)" }}
        >
          Sınavlar
        </h1>
        <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
          Atanmış ve genel sınavlar
        </p>
      </div>

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 ak-animate-in">
          <StatCard compact icon="clock" label="Bekleyen Sınav" value={kpi.pending} color="orange" delayIndex={1} />
          <StatCard compact icon="award" label="Geçilen" value={kpi.passed} color="green" delayIndex={2} />
          <StatCard compact icon="flame" label="Kalan" value={kpi.failed} color="red" delayIndex={3} />
          <StatCard compact icon="trophy" label="Ortalama Puan" value={kpi.avgScore} suffix="%" color="accent" delayIndex={4} />
        </div>
      )}

      {loading ? (
        <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
          Yükleniyor…
        </div>
      ) : exams.length === 0 ? (
        <div
          className="ak-card-static p-6 text-center text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Henüz aktif sınav yok.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-[18px]">
          {exams.map((e) => (
            <ExamCard key={e.id} exam={e} />
          ))}
        </div>
      )}
    </div>
  );
}
