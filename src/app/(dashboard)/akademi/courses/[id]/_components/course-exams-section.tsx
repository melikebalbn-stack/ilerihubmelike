"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileQuestion,
  CheckCircle2,
  Clock,
  Play,
} from "lucide-react";

type ExamItem = {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimit: number | null;
  maxAttempts: number;
  questionCount: number;
  userStatus: {
    passed: boolean;
    hasInProgress: boolean;
    inProgressAttemptId: string | null;
    usedAttempts: number;
    remainingAttempts: number;
    canStart: boolean;
    lastAttempt: { id: string; score: number | null } | null;
  };
};

export function CourseExamsSection({ courseId }: { courseId: string }) {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/akademi/courses/${courseId}/exams`)
      .then((r) => (r.ok ? r.json() : { exams: [] }))
      .then((d) => setExams(d.exams ?? []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading || exams.length === 0) return null;

  return (
    <div
      className="border rounded-lg p-4 bg-white mt-6"
      style={{ borderColor: "var(--ak-border-default)" }}
    >
      <h3
        className="font-semibold flex items-center gap-2 mb-3"
        style={{ color: "var(--ak-text-primary)" }}
      >
        <FileQuestion size={18} />
        İlişkili Sınavlar ({exams.length})
      </h3>
      <div className="space-y-2">
        {exams.map((e) => (
          <div
            key={e.id}
            className="border rounded-md p-3 hover:bg-slate-50 transition-colors"
            style={{ borderColor: "var(--ak-border-divider)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4
                  className="font-medium"
                  style={{ color: "var(--ak-text-primary)" }}
                >
                  {e.title}
                </h4>
                <div
                  className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1"
                  style={{ color: "var(--ak-text-tertiary)" }}
                >
                  <span>{e.questionCount} soru</span>
                  {e.timeLimit && <span>{e.timeLimit} dk</span>}
                  <span>Geçme: %{e.passingScore}</span>
                  <span>
                    Deneme: {e.userStatus.usedAttempts}/{e.maxAttempts}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                {e.userStatus.passed ? (
                  <div className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded inline-flex items-center gap-1 font-medium">
                    <CheckCircle2 size={12} />
                    Geçti
                  </div>
                ) : e.userStatus.hasInProgress ? (
                  <Link
                    href={`/akademi/exams/${e.id}/take`}
                    className="text-xs px-2 py-1 bg-amber-600 text-white rounded inline-flex items-center gap-1 hover:bg-amber-700 font-medium"
                  >
                    <Clock size={12} />
                    Devam Et
                  </Link>
                ) : e.userStatus.canStart ? (
                  <Link
                    href={`/akademi/exams/${e.id}`}
                    className="text-xs px-2 py-1 bg-slate-900 text-white rounded inline-flex items-center gap-1 hover:bg-slate-800 font-medium"
                  >
                    <Play size={12} />
                    Başla
                  </Link>
                ) : (
                  <span
                    className="text-xs"
                    style={{ color: "var(--ak-text-tertiary)" }}
                  >
                    Hak yok
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
