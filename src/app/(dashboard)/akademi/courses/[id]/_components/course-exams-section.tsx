"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileQuestion,
  CheckCircle2,
  Clock,
  Play,
  Lock,
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
  // Dalga 1: sunucu kilidi — tüm zorunlu içerikler tamamlanmadan başlatılamaz.
  locked?: boolean;
  lockReason?: string | null;
  contentProgress?: { completed: number; required: number };
};

export function CourseExamsSection({
  courseId,
  reloadKey,
}: {
  courseId: string;
  /** İçerik tamamlanınca değişir → kilit durumu yeniden çekilir. */
  reloadKey?: string;
}) {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/akademi/courses/${courseId}/exams`)
      .then((r) => (r.ok ? r.json() : { exams: [] }))
      .then((d) => setExams(d.exams ?? []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, [courseId, reloadKey]);

  if (loading || exams.length === 0) return null;

  const locked = exams.some((e) => e.locked);
  const lockReason = exams.find((e) => e.locked)?.lockReason ?? null;

  return (
    <section
      className="ak-card-static p-5 mb-5 transition-opacity"
      style={{ borderColor: "var(--ak-border-default)", opacity: locked ? 0.65 : 1 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          {locked ? <Lock size={14} /> : <FileQuestion size={14} />}
          2. Adım — Sınav
        </h2>
        {locked && lockReason && (
          <span className="text-xs font-medium" style={{ color: "var(--ak-text-tertiary)" }}>
            <Lock size={12} className="inline mr-1 -mt-0.5" />
            {lockReason}
          </span>
        )}
      </div>
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
                ) : e.locked ? (
                  <button
                    type="button"
                    disabled
                    title={e.lockReason ?? "Önce eğitim içeriklerini tamamlayın"}
                    className="text-xs px-2 py-1 bg-slate-400 text-white rounded inline-flex items-center gap-1 font-medium cursor-not-allowed"
                  >
                    <Lock size={12} />
                    Başla
                  </button>
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
    </section>
  );
}
