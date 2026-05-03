"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Send,
  Save,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { TYPE_LABELS } from "@/lib/akademi/question-types";

type Option = { id: string; text: string; isCorrect: boolean };

type UserAnswer = {
  id: string;
  optionId: string | null;
  selectedOptionIds: string[];
  textAnswer: string | null;
  ratingValue: number | null;
  scaleValue: number | null;
  dateValue: string | null;
  fileUrl?: string | null;
  matrixAnswer?: Record<string, number> | null;
};

type ManualGrade = {
  score: number | null;
  feedback: string | null;
  gradedAt: string | null;
  gradedBy: { id: string; name: string } | null;
};

type AttemptQuestion = {
  id: string;
  question: string;
  type: string;
  points: number;
  order: number;
  explanation: string | null;
  isManualGraded: boolean;
  matrixConfig?: { rows: string[]; cols: string[] } | null;
  allowedFileTypes?: string | null;
  options: Option[];
  userAnswer: UserAnswer | null;
  autoScore: { earnedPoints: number; isCorrect: boolean } | null;
  manualGrade: ManualGrade | null;
};

type AttemptDetail = {
  attempt: {
    id: string;
    status: string;
    score: number | null;
    passed: boolean | null;
    startedAt: string;
    completedAt: string;
  };
  user: { id: string; name: string; email: string };
  exam: { id: string; title: string; passingScore: number };
  questions: AttemptQuestion[];
  summary: {
    manualTotal: number;
    manualGraded: number;
    allManualGraded: boolean;
  };
};

export default function GradingDetailPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/akademi/admin/attempts/${attemptId}`);
      if (!res.ok) {
        setData(null);
        return;
      }
      const d = await res.json();
      setData(d);
    } catch {
      toast.error("Yüklenemedi");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    load();
  }, [load]);

  // Save sonrası optimistic delta — load() çağrılmaz, scroll korunur
  const handleAnswerGraded = useCallback(
    (questionId: string, gradedValue: ManualGrade, wasNewGrade: boolean) => {
      setData((prev) => {
        if (!prev) return prev;
        const nextQuestions = prev.questions.map((q) =>
          q.id === questionId ? { ...q, manualGrade: gradedValue } : q
        );
        const newManualGraded = wasNewGrade
          ? prev.summary.manualGraded + 1
          : prev.summary.manualGraded;
        return {
          ...prev,
          questions: nextQuestions,
          summary: {
            ...prev.summary,
            manualGraded: newManualGraded,
            allManualGraded: newManualGraded >= prev.summary.manualTotal,
          },
        };
      });
    },
    []
  );

  async function handleFinalize() {
    if (
      !confirm(
        "Sınav finalize edilecek ve kullanıcıya sonuç bildirimi gidecek. Onaylıyor musunuz?"
      )
    ) {
      return;
    }
    setFinalizing(true);
    try {
      const res = await fetch(
        `/api/akademi/admin/attempts/${attemptId}/finalize`,
        { method: "POST" }
      );
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Finalize başarısız");
        setFinalizing(false);
        return;
      }
      toast.success(
        `Finalize tamam — %${d.score}, ${d.passed ? "Geçti" : "Kaldı"}`
      );
      router.push("/akademi/admin/grading");
    } catch {
      toast.error("Beklenmeyen hata");
      setFinalizing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
        Yükleniyor...
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-6 text-red-600">
        Attempt bulunamadı.{" "}
        <Link href="/akademi/admin/grading" className="underline">
          Listeye dön
        </Link>
      </div>
    );
  }

  const { attempt, user, exam, questions, summary } = data;

  return (
    <div className="ak-animate-in max-w-4xl mx-auto space-y-4">
      <Link
        href="/akademi/admin/grading"
        className="inline-flex items-center gap-1 text-sm hover:underline"
        style={{ color: "var(--ak-text-secondary)" }}
      >
        <ArrowLeft size={14} />
        Bekleyen Listesine Dön
      </Link>

      <div
        className="border rounded-lg p-6 bg-white"
        style={{ borderColor: "var(--ak-border-default)" }}
      >
        <h1
          className="text-xl font-bold"
          style={{ color: "var(--ak-text-primary)" }}
        >
          {exam.title}
        </h1>
        <div
          className="text-sm mt-1"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          <strong>{user.name}</strong>{" "}
          <span style={{ color: "var(--ak-text-tertiary)" }}>
            ({user.email})
          </span>
        </div>
        <div
          className="text-xs mt-1 inline-flex items-center gap-1"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          <Clock size={11} />
          Bitirildi: {new Date(attempt.completedAt).toLocaleString("tr-TR")}
        </div>

        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-md flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-purple-900">
            Manuel sorular:{" "}
            <strong>
              {summary.manualGraded}/{summary.manualTotal}
            </strong>{" "}
            değerlendirildi
          </div>
          {summary.allManualGraded ? (
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2 text-sm font-medium"
            >
              <Send size={14} />
              {finalizing ? "Finalize ediliyor..." : "Finalize Et"}
            </button>
          ) : (
            <span className="text-xs text-purple-700">
              Tüm manuel sorular tamamlanınca finalize edilebilir
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {questions.map((q) => (
          <QuestionGradeCard
            key={q.id}
            question={q}
            attemptId={attemptId}
            onGraded={handleAnswerGraded}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionGradeCard({
  question,
  attemptId,
  onGraded,
}: {
  question: AttemptQuestion;
  attemptId: string;
  onGraded: (
    questionId: string,
    gradedValue: ManualGrade,
    wasNewGrade: boolean
  ) => void;
}) {
  const isAuto = !question.isManualGraded;
  const userAnswer = question.userAnswer;
  const [existingGrade, setExistingGrade] = useState<ManualGrade | null>(
    question.manualGrade
  );

  const initialScore =
    existingGrade?.score !== null && existingGrade?.score !== undefined
      ? existingGrade.score.toString()
      : "";
  const initialFeedback = existingGrade?.feedback ?? "";

  const [score, setScore] = useState<string>(initialScore);
  const [feedback, setFeedback] = useState<string>(initialFeedback);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (score === "" || !Number.isFinite(Number(score))) {
      toast.error("Puan girin");
      return;
    }
    const n = Number(score);
    if (n < 0 || n > question.points) {
      toast.error(`Puan 0-${question.points} arası olmalı`);
      return;
    }
    if (!userAnswer) {
      toast.error("Bu soruya cevap yok, grade edilemez");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/akademi/admin/attempts/${attemptId}/answers/${userAnswer.id}/grade`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            score: n,
            feedback: feedback.trim() || null,
          }),
        }
      );
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Kayıt başarısız");
        return;
      }

      const wasNewGrade = !existingGrade?.gradedAt;
      // Backend response: { ok, answer: { manualScore, manualFeedback, gradedAt, gradedBy: {id, name} } }
      const updated: ManualGrade = {
        score: d.answer?.manualScore ?? n,
        feedback: d.answer?.manualFeedback ?? (feedback.trim() || null),
        gradedAt: d.answer?.gradedAt ?? new Date().toISOString(),
        gradedBy: d.answer?.gradedBy ?? null,
      };
      setExistingGrade(updated);
      toast.success(
        wasNewGrade ? "Değerlendirme kaydedildi" : "Değerlendirme güncellendi"
      );
      onGraded(question.id, updated, wasNewGrade);
    } catch {
      toast.error("Beklenmeyen hata");
    } finally {
      setSaving(false);
    }
  }

  const cardBorder = isAuto
    ? "border-slate-200"
    : existingGrade?.gradedAt
    ? "border-green-300"
    : "border-purple-300";

  return (
    <div className={`border rounded-lg p-4 bg-white ${cardBorder}`}>
      <div className="flex items-baseline gap-2 mb-2 flex-wrap">
        <span className="text-xs font-mono text-slate-400">
          #{question.order}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded font-medium"
          style={{
            background: "var(--ak-surface-secondary)",
            color: "var(--ak-text-secondary)",
          }}
        >
          {TYPE_LABELS[question.type] || question.type}
        </span>
        <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-medium">
          Max {question.points}
        </span>
        {isAuto ? (
          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
            Otomatik:{" "}
            {question.autoScore?.earnedPoints ?? 0}/{question.points}
          </span>
        ) : existingGrade?.gradedAt ? (
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded inline-flex items-center gap-1 font-medium">
            <CheckCircle2 size={11} />
            Değerlendirildi: {existingGrade.score}/{question.points}
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-medium">
            Beklemede
          </span>
        )}
      </div>

      <p
        className="text-sm font-medium whitespace-pre-wrap mb-3"
        style={{ color: "var(--ak-text-primary)" }}
      >
        {question.question}
      </p>

      {question.options.length > 0 && (
        <OptionListAdmin question={question} userAnswer={userAnswer} />
      )}

      {!isAuto && userAnswer && hasNonOptionAnswer(userAnswer) && (
        <div className="mb-3">
          <div
            className="text-xs mb-1"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            Kullanıcının cevabı:
          </div>
          <div
            className="text-sm p-2 rounded whitespace-pre-wrap"
            style={{
              background: "var(--ak-surface-secondary)",
              color: "var(--ak-text-primary)",
            }}
          >
            <NonOptionAnswerView
              answer={userAnswer}
              type={question.type}
              question={question}
            />
          </div>
        </div>
      )}

      {!isAuto && !userAnswer && (
        <div
          className="text-sm italic mb-3"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Kullanıcı bu soruya cevap vermedi.
        </div>
      )}

      {!isAuto && (
        <div
          className="border-t pt-3 mt-3 space-y-2"
          style={{ borderColor: "var(--ak-border-divider)" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--ak-text-secondary)" }}
              >
                Puan (0-{question.points})
              </label>
              <input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                min={0}
                max={question.points}
                step="any"
                className="w-full px-3 py-1.5 text-sm border rounded-md"
                style={{ borderColor: "var(--ak-border-default)" }}
                disabled={!userAnswer}
              />
            </div>
            <div className="md:col-span-2">
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--ak-text-secondary)" }}
              >
                Geri bildirim (opsiyonel)
              </label>
              <input
                type="text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border rounded-md"
                style={{ borderColor: "var(--ak-border-default)" }}
                placeholder="Kullanıcıya görünecek not..."
                disabled={!userAnswer}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !userAnswer}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5 text-sm font-medium"
            >
              <Save size={13} />
              {saving
                ? "Kaydediliyor..."
                : existingGrade?.gradedAt
                ? "Güncelle"
                : "Kaydet"}
            </button>
          </div>
          {existingGrade?.gradedBy && existingGrade.gradedAt && (
            <div
              className="text-xs"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              Önceki değerlendirme: {existingGrade.gradedBy.name} —{" "}
              {new Date(existingGrade.gradedAt).toLocaleString("tr-TR")}
            </div>
          )}
        </div>
      )}

      {question.explanation && (
        <div className="mt-3 text-xs bg-blue-50 border border-blue-200 rounded p-2 text-blue-900">
          <strong>Soru açıklaması:</strong> {question.explanation}
        </div>
      )}
    </div>
  );
}

function hasNonOptionAnswer(a: UserAnswer): boolean {
  return !!(
    a.textAnswer ||
    a.ratingValue !== null ||
    a.scaleValue !== null ||
    a.dateValue ||
    a.fileUrl ||
    (a.matrixAnswer && Object.keys(a.matrixAnswer).length > 0)
  );
}

function NonOptionAnswerView({
  answer,
  type,
  question,
}: {
  answer: UserAnswer;
  type: string;
  question: AttemptQuestion;
}) {
  if (type === "TEXT_SHORT" || type === "TEXT_LONG") {
    return <span>{answer.textAnswer || "(boş)"}</span>;
  }
  if (type === "RATING" && answer.ratingValue !== null) {
    return <span>{answer.ratingValue} / 5</span>;
  }
  if (type === "SCALE" && answer.scaleValue !== null) {
    return <span>{answer.scaleValue} / 10</span>;
  }
  if (type === "DATE" && answer.dateValue) {
    return <span>{new Date(answer.dateValue).toLocaleDateString("tr-TR")}</span>;
  }
  if (type === "FILE_UPLOAD") {
    return answer.fileUrl ? (
      <a
        href={answer.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-700 hover:underline inline-flex items-center gap-1 font-medium"
      >
        📎 Yüklenen dosyayı aç / indir
      </a>
    ) : (
      <span className="italic">Dosya yüklenmedi</span>
    );
  }
  if (
    type === "MATRIX" &&
    answer.matrixAnswer &&
    question.matrixConfig
  ) {
    const cfg = question.matrixConfig;
    return (
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="border border-slate-300 bg-white p-1 text-left" />
            {cfg.cols.map((c, idx) => (
              <th
                key={idx}
                className="border border-slate-300 bg-white p-1"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cfg.rows.map((r, rIdx) => {
            const colIdx = answer.matrixAnswer![String(rIdx)];
            return (
              <tr key={rIdx}>
                <td className="border border-slate-300 bg-white p-1 font-medium">
                  {r}
                </td>
                {cfg.cols.map((_, cIdx) => (
                  <td
                    key={cIdx}
                    className="border border-slate-300 bg-white p-1 text-center"
                  >
                    {colIdx === cIdx && (
                      <span className="text-green-600 font-bold">●</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
  return <span className="italic">Cevap yok</span>;
}

function OptionListAdmin({
  question,
  userAnswer,
}: {
  question: AttemptQuestion;
  userAnswer: UserAnswer | null;
}) {
  const userOptionIds = userAnswer
    ? userAnswer.optionId
      ? [userAnswer.optionId]
      : userAnswer.selectedOptionIds || []
    : [];

  return (
    <div className="space-y-1.5 mb-3">
      {question.options.map((o) => {
        const isUserChoice = userOptionIds.includes(o.id);
        let cls = "bg-slate-50 text-slate-700";
        if (o.isCorrect) cls = "bg-green-50 text-green-800";
        else if (isUserChoice) cls = "bg-red-50 text-red-800";

        return (
          <div
            key={o.id}
            className={`text-sm p-2 rounded flex items-center gap-2 ${cls}`}
          >
            {o.isCorrect && (
              <CheckCircle2 size={14} className="text-green-600 shrink-0" />
            )}
            {isUserChoice && !o.isCorrect && (
              <XCircle size={14} className="text-red-600 shrink-0" />
            )}
            <span className="flex-1">{o.text}</span>
            {isUserChoice && (
              <span className="text-xs opacity-75 shrink-0">
                (Kullanıcı seçti)
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
