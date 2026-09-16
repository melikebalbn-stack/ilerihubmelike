"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Hourglass,
  AlertTriangle,
} from "lucide-react";
import { useAkademiAuth } from "@/lib/akademi-auth";

type ResultData = {
  attempt: {
    id: string;
    status: string;
    score: number | null;
    passed: boolean | null;
    startedAt: string;
    completedAt: string | null;
  };
  exam: { id: string; title: string; passingScore: number };
  // Sunucuda hesaplanır — soru/seçenek/cevap anahtarı bu uçtan GELMEZ.
  summary: {
    totalEarned: number;
    totalMax: number;
    questionCount: number;
    autoGradedCount: number;
    manualPending: number;
  };
};

export default function ExamResultPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  useAkademiAuth();
  const { id: examId, attemptId } = use(params);
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/akademi/attempts/${attemptId}/result`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) {
    return (
      <div
        className="p-6 text-sm"
        style={{ color: "var(--ak-text-tertiary)" }}
      >
        Yükleniyor...
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-6 text-red-600">
        Sonuç yüklenemedi.{" "}
        <Link href={`/akademi/exams/${examId}`} className="underline">
          Sınava dön
        </Link>
      </div>
    );
  }

  const { attempt, exam, summary } = data;

  const { totalEarned, totalMax } = summary;
  const percentage =
    totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
  const allManualGraded = summary.manualPending === 0;

  return (
    <div className="ak-animate-in max-w-3xl mx-auto space-y-4">
      <Link
        href={`/akademi/exams/${examId}`}
        className="inline-flex items-center gap-1 text-sm hover:underline"
        style={{ color: "var(--ak-text-secondary)" }}
      >
        <ArrowLeft size={14} />
        Sınava Dön
      </Link>

      <ResultHeader
        attempt={attempt}
        exam={exam}
        totalEarned={totalEarned}
        totalMax={totalMax}
        percentage={percentage}
        allManualGraded={allManualGraded}
      />

      <div
        className="ak-card-static p-4 text-sm"
        style={{ color: "var(--ak-text-secondary)" }}
      >
        {summary.questionCount} soru · {summary.autoGradedCount} otomatik
        puanlandı
        {summary.manualPending > 0
          ? ` · ${summary.manualPending} soru değerlendirme bekliyor`
          : ""}
        . Soru bazlı cevaplar ve doğru yanıtlar sınav güvenliği gereği
        gösterilmez.
      </div>
    </div>
  );
}

function ResultHeader({
  attempt,
  exam,
  totalEarned,
  totalMax,
  percentage,
  allManualGraded,
}: {
  attempt: ResultData["attempt"];
  exam: ResultData["exam"];
  totalEarned: number;
  totalMax: number;
  percentage: number;
  allManualGraded: boolean;
}) {
  let bg: string;
  let border: string;
  let icon: React.ReactNode;
  let title: string;
  let subtitle: string;

  if (attempt.status === "EXPIRED") {
    bg = "bg-slate-50";
    border = "border-slate-300";
    icon = <Clock className="w-8 h-8 text-slate-500" />;
    title = "Süre doldu";
    subtitle = "Bu sınav süresi dolduğu için tamamlanamadı.";
  } else if (
    attempt.status === "PENDING_REVIEW" ||
    (attempt.status === "COMPLETED" && attempt.passed === null) ||
    !allManualGraded
  ) {
    if (attempt.status === "PENDING_REVIEW" || !allManualGraded) {
      bg = "bg-purple-50";
      border = "border-purple-300";
      icon = <Hourglass className="w-8 h-8 text-purple-600" />;
      title = "Değerlendirme Bekleniyor";
      subtitle =
        "Manuel sorular admin tarafından değerlendirildikten sonra final sonuç netleşecek.";
    } else {
      bg = "bg-slate-50";
      border = "border-slate-300";
      icon = <AlertTriangle className="w-8 h-8 text-slate-500" />;
      title = "Sonuç hazırlanıyor";
      subtitle = "";
    }
  } else if (attempt.passed) {
    bg = "bg-green-50";
    border = "border-green-300";
    icon = <CheckCircle2 className="w-8 h-8 text-green-600" />;
    title = "Tebrikler! Sınavı geçtiniz";
    subtitle = `Geçme barajı: %${exam.passingScore}`;
  } else {
    bg = "bg-red-50";
    border = "border-red-300";
    icon = <XCircle className="w-8 h-8 text-red-600" />;
    title = "Sınavı geçemediniz";
    subtitle = `Geçme barajı: %${exam.passingScore}`;
  }

  return (
    <div className={`border-2 rounded-lg p-6 ${bg} ${border}`}>
      <div className="flex items-start gap-4">
        <div className="shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">{exam.title}</h1>
          <p className="text-sm font-medium mt-1">{title}</p>
          {subtitle && (
            <p className="text-xs mt-0.5 opacity-80">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <ScoreStat
          label="Puan"
          value={`${formatPoints(totalEarned)}/${totalMax}`}
        />
        <ScoreStat label="Yüzde" value={`%${percentage}`} highlight />
        <ScoreStat label="Geçme" value={`%${exam.passingScore}`} />
      </div>
    </div>
  );
}

function ScoreStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white/70 rounded p-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
        {label}
      </div>
      <div
        className={`font-bold ${highlight ? "text-2xl" : "text-base"}`}
        style={{ color: "var(--ak-text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

function formatPoints(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}
