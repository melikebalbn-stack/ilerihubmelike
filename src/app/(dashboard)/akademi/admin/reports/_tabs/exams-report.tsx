"use client";

import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";

type ExamRow = {
  id: string;
  title: string;
  isActive: boolean;
  passingScore: number;
  course: { id: string; title: string } | null;
  questionCount: number;
  totalAttempts: number;
  completedAttempts: number;
  pendingReview: number;
  passed: number;
  passRate: number;
  avgScore: number;
  avgDurationMinutes: number;
};

type QuestionStat = {
  id: string;
  order: number;
  question: string;
  type: string;
  points: number;
  isManualGraded: boolean;
  totalAnswers: number;
  correctCount: number | null;
  correctRate: number | null;
  difficulty: "easy" | "medium" | "hard" | "manual";
};

export function ExamsReportTab() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/akademi/admin/reports/exams")
      .then((r) => r.json())
      .then((d) => setExams(d.exams ?? []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
        Yükleniyor...
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div
        className="text-center py-12 text-sm border border-dashed rounded-lg"
        style={{
          borderColor: "var(--ak-border-default)",
          color: "var(--ak-text-tertiary)",
        }}
      >
        Henüz sınav yok
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-lg overflow-hidden border bg-white"
        style={{ borderColor: "var(--ak-border-default)" }}
      >
        <table className="w-full text-sm">
          <thead style={{ background: "var(--ak-surface-secondary)" }}>
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                Sınav
              </th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                Kurs
              </th>
              <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                Soru
              </th>
              <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                Deneme
              </th>
              <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                Bekleyen
              </th>
              <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                Geçme %
              </th>
              <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                Ort. Puan
              </th>
              <th className="text-center px-4 py-2 text-xs font-semibold uppercase">
                Ort. Süre
              </th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {exams.map((e) => (
              <tr
                key={e.id}
                className="border-t hover:bg-slate-50"
                style={{ borderColor: "var(--ak-border-divider)" }}
              >
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{e.title}</span>
                    {!e.isActive && (
                      <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        Pasif
                      </span>
                    )}
                  </div>
                </td>
                <td
                  className="px-4 py-2"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {e.course?.title ?? "—"}
                </td>
                <td className="px-4 py-2 text-center">{e.questionCount}</td>
                <td className="px-4 py-2 text-center">
                  {e.completedAttempts}/{e.totalAttempts}
                </td>
                <td className="px-4 py-2 text-center">
                  {e.pendingReview > 0 ? (
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-medium">
                      {e.pendingReview}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  {e.completedAttempts > 0 ? `%${e.passRate}` : "—"}
                </td>
                <td className="px-4 py-2 text-center">
                  {e.completedAttempts > 0 ? `%${e.avgScore}` : "—"}
                </td>
                <td className="px-4 py-2 text-center">
                  {e.avgDurationMinutes > 0
                    ? `${e.avgDurationMinutes} dk`
                    : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => setSelectedExamId(e.id)}
                    className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    Sorular
                    <ChevronRight size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedExamId && (
        <QuestionDifficultyPanel
          examId={selectedExamId}
          onClose={() => setSelectedExamId(null)}
        />
      )}
    </div>
  );
}

const DIFFICULTY_LABELS: Record<QuestionStat["difficulty"], string> = {
  easy: "Kolay",
  medium: "Orta",
  hard: "Zor",
  manual: "Manuel",
};
const DIFFICULTY_COLORS: Record<QuestionStat["difficulty"], string> = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  hard: "bg-red-100 text-red-800",
  manual: "bg-slate-100 text-slate-600",
};

function QuestionDifficultyPanel({
  examId,
  onClose,
}: {
  examId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{
    exam: { id: string; title: string };
    questions: QuestionStat[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/akademi/admin/reports/exams?examId=${examId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [examId]);

  return (
    <div
      className="border rounded-lg p-4 bg-white"
      style={{ borderColor: "var(--ak-border-default)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">
          Soru Zorluk Analizi:{" "}
          {data?.exam.title ?? <span className="text-slate-400">—</span>}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-100"
          title="Kapat"
        >
          <X size={16} />
        </button>
      </div>
      {loading && (
        <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
          Yükleniyor...
        </div>
      )}
      {!loading && data && (
        <table className="w-full text-sm">
          <thead style={{ background: "var(--ak-surface-secondary)" }}>
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase">
                #
              </th>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase">
                Soru
              </th>
              <th className="text-center px-3 py-2 text-xs font-semibold uppercase">
                Cevap
              </th>
              <th className="text-center px-3 py-2 text-xs font-semibold uppercase">
                Doğru %
              </th>
              <th className="text-center px-3 py-2 text-xs font-semibold uppercase">
                Zorluk
              </th>
            </tr>
          </thead>
          <tbody>
            {data.questions.map((q) => (
              <tr
                key={q.id}
                className="border-t"
                style={{ borderColor: "var(--ak-border-divider)" }}
              >
                <td className="px-3 py-2 font-mono text-xs">#{q.order}</td>
                <td
                  className="px-3 py-2"
                  style={{ color: "var(--ak-text-primary)" }}
                >
                  {q.question.slice(0, 100)}
                  {q.question.length > 100 ? "..." : ""}
                </td>
                <td className="px-3 py-2 text-center">{q.totalAnswers}</td>
                <td className="px-3 py-2 text-center">
                  {q.correctRate !== null ? `%${q.correctRate}` : "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      DIFFICULTY_COLORS[q.difficulty]
                    }`}
                  >
                    {DIFFICULTY_LABELS[q.difficulty]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
