"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Hourglass,
  Award,
  AlertTriangle,
  Star,
} from "lucide-react";
import { useAkademiAuth } from "@/lib/akademi-auth";

const TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: "Tek Seçim",
  MULTIPLE_CHOICE: "Çoklu Seçim",
  TRUE_FALSE: "Doğru/Yanlış",
  TEXT_SHORT: "Kısa Metin",
  TEXT_LONG: "Uzun Metin",
  RATING: "Değerlendirme",
  SCALE: "Skala",
  YES_NO: "Evet/Hayır",
  DATE: "Tarih",
};

const AUTO_TYPES = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"];

type Option = { id: string; text: string; isCorrect: boolean };

type UserAnswer = {
  optionId: string | null;
  selectedOptionIds: string[];
  textAnswer: string | null;
  ratingValue: number | null;
  scaleValue: number | null;
  dateValue: string | null;
};

type ResultQuestion = {
  id: string;
  question: string;
  type: string;
  points: number;
  order: number;
  explanation: string | null;
  isManualGraded: boolean;
  options: Option[];
  userAnswer: UserAnswer | null;
  autoScore: { earnedPoints: number; isCorrect: boolean } | null;
  manualGrade: {
    score: number | null;
    feedback: string | null;
    gradedAt: string | null;
  } | null;
};

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
  questions: ResultQuestion[];
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

  const { attempt, exam, questions } = data;

  // Toplam puanı client-side hesapla — manuel grading sonrası mevcut state ile uyumlu olur
  const totalEarned = questions.reduce((sum, q) => {
    if (q.autoScore) return sum + q.autoScore.earnedPoints;
    if (q.manualGrade?.gradedAt && q.manualGrade.score !== null) {
      return sum + q.manualGrade.score;
    }
    return sum;
  }, 0);
  const totalMax = questions.reduce((sum, q) => sum + q.points, 0);
  const percentage =
    totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
  const allManualGraded = questions
    .filter((q) => q.isManualGraded)
    .every((q) => q.manualGrade?.gradedAt);

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

      <div className="space-y-3">
        <h2
          className="text-lg font-bold"
          style={{ color: "var(--ak-text-primary)" }}
        >
          Soru Detayları
        </h2>
        {questions.map((q, idx) => (
          <QuestionCard key={q.id} question={q} index={idx} />
        ))}
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

function QuestionCard({
  question,
  index,
}: {
  question: ResultQuestion;
  index: number;
}) {
  const isAuto = AUTO_TYPES.includes(question.type);
  const optionBased =
    isAuto || question.type === "YES_NO";

  let scoreBadge;
  if (isAuto && question.autoScore) {
    scoreBadge = question.autoScore.isCorrect ? (
      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded inline-flex items-center gap-1 font-medium">
        <CheckCircle2 size={12} />
        Doğru — {formatPoints(question.autoScore.earnedPoints)}/{question.points}
      </span>
    ) : question.autoScore.earnedPoints > 0 ? (
      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded inline-flex items-center gap-1 font-medium">
        Kısmi — {formatPoints(question.autoScore.earnedPoints)}/{question.points}
      </span>
    ) : (
      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded inline-flex items-center gap-1 font-medium">
        <XCircle size={12} />
        Yanlış — 0/{question.points}
      </span>
    );
  } else if (question.manualGrade?.gradedAt) {
    scoreBadge = (
      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded inline-flex items-center gap-1 font-medium">
        <Award size={12} />
        Değerlendirildi — {formatPoints(question.manualGrade.score ?? 0)}/
        {question.points}
      </span>
    );
  } else {
    scoreBadge = (
      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded inline-flex items-center gap-1 font-medium">
        <Hourglass size={12} />
        Değerlendirme bekleniyor
      </span>
    );
  }

  return (
    <div
      className="border rounded-lg p-4 bg-white space-y-3"
      style={{ borderColor: "var(--ak-border-default)" }}
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-xs font-mono text-slate-400">#{index + 1}</span>
        <span
          className="text-xs px-2 py-0.5 rounded font-medium"
          style={{
            background: "var(--ak-surface-secondary)",
            color: "var(--ak-text-secondary)",
          }}
        >
          {TYPE_LABELS[question.type] || question.type}
        </span>
        {scoreBadge}
      </div>

      <p
        className="font-medium whitespace-pre-wrap"
        style={{ color: "var(--ak-text-primary)" }}
      >
        {question.question}
      </p>

      {optionBased ? (
        <OptionListResult
          question={question}
          isAuto={isAuto}
        />
      ) : (
        <NonOptionAnswer question={question} />
      )}

      {question.manualGrade?.feedback && (
        <div className="border-l-4 border-blue-300 bg-blue-50 px-3 py-2 text-sm">
          <div className="font-medium text-blue-900 text-xs mb-0.5">
            Değerlendirme notu
          </div>
          <p className="text-blue-900 whitespace-pre-wrap">
            {question.manualGrade.feedback}
          </p>
        </div>
      )}

      {question.explanation && (
        <div className="border-l-4 border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          <div className="font-medium text-amber-900 text-xs mb-0.5">
            Açıklama
          </div>
          <p className="text-amber-900 whitespace-pre-wrap">
            {question.explanation}
          </p>
        </div>
      )}
    </div>
  );
}

function OptionListResult({
  question,
  isAuto,
}: {
  question: ResultQuestion;
  isAuto: boolean;
}) {
  const userSelected = new Set<string>();
  if (question.userAnswer?.optionId) {
    userSelected.add(question.userAnswer.optionId);
  }
  for (const id of question.userAnswer?.selectedOptionIds ?? []) {
    userSelected.add(id);
  }

  return (
    <div className="space-y-1.5">
      {question.options.map((o) => {
        const userPicked = userSelected.has(o.id);
        const correct = o.isCorrect;

        let cls = "border-slate-200";
        let badge: React.ReactNode = null;

        if (isAuto && correct && userPicked) {
          cls = "border-green-400 bg-green-50";
          badge = (
            <CheckCircle2 size={14} className="text-green-600 shrink-0" />
          );
        } else if (isAuto && correct && !userPicked) {
          cls = "border-green-300 bg-green-50/50";
          badge = (
            <span className="text-xs text-green-700 font-medium shrink-0">
              Doğru cevap
            </span>
          );
        } else if (isAuto && !correct && userPicked) {
          cls = "border-red-400 bg-red-50";
          badge = <XCircle size={14} className="text-red-600 shrink-0" />;
        } else if (!isAuto && userPicked) {
          // YES_NO (manuel) — sadece kullanıcı seçimini göster
          cls = "border-blue-300 bg-blue-50";
          badge = (
            <span className="text-xs text-blue-700 font-medium shrink-0">
              Cevabınız
            </span>
          );
        }

        return (
          <div
            key={o.id}
            className={`flex items-center gap-3 p-2.5 border rounded text-sm ${cls}`}
          >
            <span className="flex-1">{o.text}</span>
            {badge}
          </div>
        );
      })}
    </div>
  );
}

function NonOptionAnswer({ question }: { question: ResultQuestion }) {
  const a = question.userAnswer;
  if (!a) {
    return (
      <div className="text-sm italic text-slate-500 border border-dashed border-slate-200 rounded p-3">
        Cevap verilmedi
      </div>
    );
  }

  let content: React.ReactNode;

  switch (question.type) {
    case "TEXT_SHORT":
    case "TEXT_LONG":
      content = a.textAnswer ? (
        <p className="whitespace-pre-wrap">{a.textAnswer}</p>
      ) : (
        <span className="italic text-slate-500">Cevap verilmedi</span>
      );
      break;

    case "RATING":
      content =
        a.ratingValue !== null && a.ratingValue !== undefined ? (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((v) => (
              <Star
                key={v}
                size={20}
                className={
                  v <= a.ratingValue!
                    ? "fill-amber-400 text-amber-400"
                    : "text-slate-300"
                }
              />
            ))}
            <span className="ml-2 text-sm font-medium">
              {a.ratingValue}/5
            </span>
          </div>
        ) : (
          <span className="italic text-slate-500">Cevap verilmedi</span>
        );
      break;

    case "SCALE":
      content =
        a.scaleValue !== null && a.scaleValue !== undefined ? (
          <div className="text-sm font-medium">
            Seçim:{" "}
            <span className="text-lg font-bold">{a.scaleValue}</span>/10
          </div>
        ) : (
          <span className="italic text-slate-500">Cevap verilmedi</span>
        );
      break;

    case "DATE":
      content = a.dateValue ? (
        <p className="font-medium">
          {new Date(a.dateValue).toLocaleDateString("tr-TR")}
        </p>
      ) : (
        <span className="italic text-slate-500">Cevap verilmedi</span>
      );
      break;

    default:
      content = (
        <span className="italic text-slate-500">Cevap görüntülenemiyor</span>
      );
  }

  return (
    <div className="border border-blue-200 bg-blue-50 rounded p-3 text-sm">
      <div className="text-xs font-medium text-blue-700 mb-1">
        Cevabınız
      </div>
      <div className="text-slate-800">{content}</div>
    </div>
  );
}
