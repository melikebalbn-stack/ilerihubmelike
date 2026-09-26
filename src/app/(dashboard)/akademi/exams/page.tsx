"use client";

import { useEffect, useState } from "react";
import { useAkademiAuth } from "@/lib/akademi-auth";
import { ExamCard } from "@/components/akademi/dashboard/ExamCard";
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
