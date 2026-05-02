"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  FileQuestion,
  Award,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAkademiAuth } from "@/lib/akademi-auth";

type AttemptRow = {
  id: string;
  status: string;
  score: number | null;
  passed: boolean | null;
  startedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
};

type ExamData = {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimit: number | null;
  maxAttempts: number;
  isActive: boolean;
  course: { id: string; title: string } | null;
  _count: { questions: number };
  attempts: AttemptRow[];
};

export default function ExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  useAkademiAuth();
  const { id } = use(params);
  const router = useRouter();
  const [exam, setExam] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetch(`/api/akademi/exams/${id}`)
      .then((r) => (r.ok ? r.json() : { exam: null }))
      .then((d) => setExam(d.exam))
      .catch(() => setExam(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStart() {
    setStarting(true);
    try {
      const res = await fetch(`/api/akademi/exams/${id}/attempts`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Başlatılamadı");
        setStarting(false);
        return;
      }
      router.push(`/akademi/exams/${id}/take`);
    } catch {
      toast.error("Beklenmeyen hata");
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
        Yükleniyor...
      </div>
    );
  }
  if (!exam) {
    return (
      <div className="p-6 text-red-600">
        Sınav bulunamadı.{" "}
        <Link href="/akademi/exams" className="underline">
          Sınavlara dön
        </Link>
      </div>
    );
  }

  const now = Date.now();
  const inProgress = exam.attempts.find(
    (a) =>
      a.status === "IN_PROGRESS" &&
      (!a.expiresAt || new Date(a.expiresAt).getTime() > now)
  );
  const usedCount = exam.attempts.filter(
    (a) =>
      a.status !== "IN_PROGRESS" ||
      (a.expiresAt && new Date(a.expiresAt).getTime() < now)
  ).length;
  const canStart = !inProgress && usedCount < exam.maxAttempts;

  return (
    <div className="ak-animate-in max-w-3xl mx-auto space-y-4">
      <Link
        href="/akademi/exams"
        className="inline-flex items-center gap-1 text-sm hover:underline"
        style={{ color: "var(--ak-text-secondary)" }}
      >
        <ArrowLeft size={14} />
        Sınavlara Dön
      </Link>

      <div
        className="border rounded-lg p-6 bg-white space-y-4"
        style={{ borderColor: "var(--ak-border-default)" }}
      >
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--ak-text-primary)" }}
          >
            {exam.title}
          </h1>
          {exam.course && (
            <p
              className="text-sm mt-1"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              Kurs: {exam.course.title}
            </p>
          )}
        </div>

        {exam.description && (
          <p
            className="text-sm whitespace-pre-wrap"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            {exam.description}
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat
            icon={FileQuestion}
            label="Soru"
            value={`${exam._count.questions}`}
          />
          <Stat
            icon={Clock}
            label="Süre"
            value={exam.timeLimit ? `${exam.timeLimit} dk` : "Sınırsız"}
          />
          <Stat icon={Award} label="Geçme" value={`%${exam.passingScore}`} />
          <Stat label="Deneme" value={`${usedCount}/${exam.maxAttempts}`} />
        </div>

        <div
          className="border-t pt-4"
          style={{ borderColor: "var(--ak-border-divider)" }}
        >
          {inProgress ? (
            <Link
              href={`/akademi/exams/${id}/take`}
              className="w-full bg-amber-600 text-white text-center py-3 rounded-md hover:bg-amber-700 block font-medium"
            >
              Yarım Kalan Sınava Devam Et
            </Link>
          ) : canStart ? (
            <button
              onClick={handleStart}
              disabled={starting}
              className="w-full bg-slate-900 text-white py-3 rounded-md hover:bg-slate-800 disabled:opacity-50 font-medium"
            >
              {starting ? "Başlatılıyor..." : "Sınava Başla"}
            </button>
          ) : (
            <div className="text-center text-slate-500 py-3 bg-slate-50 rounded-md">
              Maksimum deneme sayısına ulaştınız
            </div>
          )}
        </div>
      </div>

      {exam.attempts.length > 0 && (
        <div
          className="border rounded-lg p-4 bg-white"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <h3
            className="font-semibold mb-3"
            style={{ color: "var(--ak-text-primary)" }}
          >
            Geçmiş Denemeler
          </h3>
          <div className="space-y-2">
            {exam.attempts.map((a) => (
              <AttemptRowItem key={a.id} attempt={a} examId={id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div
      className="border rounded p-2"
      style={{ borderColor: "var(--ak-border-divider)" }}
    >
      <div
        className="text-xs inline-flex items-center gap-1"
        style={{ color: "var(--ak-text-tertiary)" }}
      >
        {Icon && <Icon size={12} />}
        {label}
      </div>
      <div className="font-medium" style={{ color: "var(--ak-text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function AttemptRowItem({
  attempt,
  examId,
}: {
  attempt: AttemptRow;
  examId: string;
}) {
  const date = new Date(attempt.startedAt).toLocaleString("tr-TR");
  let badge;
  if (attempt.status === "IN_PROGRESS") {
    badge = (
      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-medium">
        Devam ediyor
      </span>
    );
  } else if (attempt.status === "PENDING_REVIEW") {
    badge = (
      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-medium">
        Değerlendirme bekleniyor
      </span>
    );
  } else if (attempt.status === "COMPLETED") {
    badge = attempt.passed ? (
      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded font-medium">
        Geçti — %{Math.round(attempt.score ?? 0)}
      </span>
    ) : (
      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded font-medium">
        Kaldı — %{Math.round(attempt.score ?? 0)}
      </span>
    );
  } else if (attempt.status === "EXPIRED") {
    badge = (
      <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-medium">
        Süresi doldu
      </span>
    );
  }

  const showResult = ["COMPLETED", "PENDING_REVIEW"].includes(attempt.status);

  return (
    <div
      className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
      style={{ borderColor: "var(--ak-border-divider)" }}
    >
      <div>
        <div style={{ color: "var(--ak-text-primary)" }}>{date}</div>
        <div className="mt-1">{badge}</div>
      </div>
      {showResult && (
        <Link
          href={`/akademi/exams/${examId}/result/${attempt.id}`}
          className="text-xs text-blue-600 hover:underline"
        >
          Sonuca Bak
        </Link>
      )}
    </div>
  );
}
