"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  FileQuestion,
  Award,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useAkademiAuth } from "@/lib/akademi-auth";

type ExamItem = {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimit: number | null;
  maxAttempts: number;
  questionCount: number;
  course: { id: string; title: string } | null;
  userStatus: {
    canStart: boolean;
    hasInProgress: boolean;
    inProgressAttemptId: string | null;
    usedAttempts: number;
    remainingAttempts: number;
    lastResult: {
      attemptId: string;
      score: number | null;
      passed: boolean | null;
      status: string;
      completedAt: string | null;
    } | null;
  };
};

export default function UserExamsPage() {
  useAkademiAuth();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/akademi/exams")
      .then((r) => (r.ok ? r.json() : { exams: [] }))
      .then((d) => setExams(d.exams ?? []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="ak-animate-in space-y-5">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--ak-text-primary)" }}
        >
          Sınavlar
        </h1>
        <p className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
          Atanmış ve genel sınavlar
        </p>
      </div>

      {exams.length === 0 && (
        <div
          className="text-center py-12 text-sm border border-dashed rounded-lg"
          style={{
            borderColor: "var(--ak-border-default)",
            color: "var(--ak-text-tertiary)",
          }}
        >
          Henüz aktif sınav yok
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exams.map((e) => (
          <ExamCard key={e.id} exam={e} />
        ))}
      </div>
    </div>
  );
}

function ExamCard({ exam }: { exam: ExamItem }) {
  const { userStatus } = exam;

  let actionButton;
  if (userStatus.hasInProgress) {
    actionButton = (
      <Link
        href={`/akademi/exams/${exam.id}/take`}
        className="w-full bg-amber-600 text-white text-center py-2 rounded-md hover:bg-amber-700 inline-flex items-center justify-center gap-2 font-medium"
      >
        <RefreshCw size={14} />
        Devam Et
      </Link>
    );
  } else if (userStatus.lastResult) {
    actionButton = (
      <div className="space-y-2">
        <Link
          href={`/akademi/exams/${exam.id}/result/${userStatus.lastResult.attemptId}`}
          className="w-full bg-slate-100 text-slate-800 text-center py-2 rounded-md hover:bg-slate-200 block text-sm font-medium"
        >
          Son Sonucu Gör
        </Link>
        {userStatus.canStart && (
          <Link
            href={`/akademi/exams/${exam.id}`}
            className="w-full bg-slate-900 text-white text-center py-2 rounded-md hover:bg-slate-800 block text-sm"
          >
            Tekrar Dene ({userStatus.remainingAttempts} hak)
          </Link>
        )}
      </div>
    );
  } else if (userStatus.canStart) {
    actionButton = (
      <Link
        href={`/akademi/exams/${exam.id}`}
        className="w-full bg-slate-900 text-white text-center py-2 rounded-md hover:bg-slate-800 block font-medium"
      >
        Sınava Başla
      </Link>
    );
  } else {
    actionButton = (
      <div className="w-full bg-slate-100 text-slate-500 text-center py-2 rounded-md text-sm">
        Hakkınız bitti
      </div>
    );
  }

  return (
    <div
      className="border rounded-lg p-4 bg-white space-y-3"
      style={{ borderColor: "var(--ak-border-default)" }}
    >
      <div>
        <h3
          className="font-semibold"
          style={{ color: "var(--ak-text-primary)" }}
        >
          {exam.title}
        </h3>
        {exam.course && (
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            {exam.course.title}
          </p>
        )}
        {exam.description && (
          <p
            className="text-sm mt-2 line-clamp-2"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            {exam.description}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
          style={{
            background: "var(--ak-surface-secondary)",
            color: "var(--ak-text-secondary)",
          }}
        >
          <FileQuestion size={11} />
          {exam.questionCount} soru
        </span>
        {exam.timeLimit && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
            style={{
              background: "var(--ak-surface-secondary)",
              color: "var(--ak-text-secondary)",
            }}
          >
            <Clock size={11} />
            {exam.timeLimit} dk
          </span>
        )}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded">
          <Award size={11} />
          %{exam.passingScore}
        </span>
      </div>

      {userStatus.lastResult &&
        userStatus.lastResult.status === "COMPLETED" && (
          <div
            className={`text-xs px-2 py-1 rounded font-medium ${
              userStatus.lastResult.passed
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            Son sonuç: %{Math.round(userStatus.lastResult.score ?? 0)} —{" "}
            {userStatus.lastResult.passed ? "Geçti" : "Kaldı"}
          </div>
        )}
      {userStatus.lastResult &&
        userStatus.lastResult.status === "PENDING_REVIEW" && (
          <div className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-800 inline-flex items-center gap-1 font-medium">
            <AlertCircle size={11} />
            Değerlendirme bekleniyor
          </div>
        )}

      <div>{actionButton}</div>
    </div>
  );
}
