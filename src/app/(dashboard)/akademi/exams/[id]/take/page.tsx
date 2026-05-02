"use client";

import { useEffect, useState, use, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useAkademiAuth } from "@/lib/akademi-auth";

type Question = {
  id: string;
  question: string;
  type: string;
  points: number;
  order: number;
  options: Array<{ id: string; text: string; order: number }>;
  matrixConfig?: { rows: string[]; cols: string[] } | null;
  allowedFileTypes?: string | null;
};

type AnswerState = {
  optionId?: string | null;
  selectedOptionIds?: string[];
  textAnswer?: string | null;
  ratingValue?: number | null;
  scaleValue?: number | null;
  dateValue?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  matrixAnswer?: Record<string, number> | null;
};

type SavedAnswer = {
  questionId: string;
  optionId: string | null;
  selectedOptionIds: string[];
  textAnswer: string | null;
  ratingValue: number | null;
  scaleValue: number | null;
  dateValue: string | null;
  fileUrl: string | null;
  matrixAnswer: Record<string, number> | null;
};

const AUTO_SAVE_DEBOUNCE = 800;

function isAnswered(a: AnswerState | undefined): boolean {
  if (!a) return false;
  return !!(
    a.optionId ||
    (a.selectedOptionIds && a.selectedOptionIds.length > 0) ||
    (a.textAnswer && a.textAnswer.length > 0) ||
    (a.ratingValue !== undefined && a.ratingValue !== null) ||
    (a.scaleValue !== undefined && a.scaleValue !== null) ||
    a.dateValue ||
    a.fileUrl ||
    (a.matrixAnswer && Object.keys(a.matrixAnswer).length > 0)
  );
}

export default function ExamTakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  useAkademiAuth();
  const { id: examId } = use(params);
  const router = useRouter();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examMeta, setExamMeta] = useState<{
    title: string;
    passingScore: number;
  } | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const attemptIdRef = useRef<string | null>(null);
  const examIdRef = useRef(examId);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const questionsRef = useRef<Question[]>([]);

  useEffect(() => {
    examIdRef.current = examId;
  }, [examId]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const startRes = await fetch(`/api/akademi/exams/${examId}/attempts`, {
          method: "POST",
        });
        const startData = await startRes.json();
        if (cancelled) return;
        if (!startRes.ok) {
          toast.error(startData.error || "Sınav başlatılamadı");
          router.push(`/akademi/exams/${examId}`);
          return;
        }
        const aId = startData.attempt.id as string;
        setAttemptId(aId);
        attemptIdRef.current = aId;

        const detRes = await fetch(`/api/akademi/attempts/${aId}`);
        const detData = await detRes.json();
        if (cancelled) return;
        if (!detRes.ok) {
          toast.error(detData.error || "Yüklenemedi");
          router.push(`/akademi/exams/${examId}`);
          return;
        }
        if (detData.attempt.status !== "IN_PROGRESS") {
          toast.error("Sınav artık aktif değil");
          router.push(`/akademi/exams/${examId}`);
          return;
        }
        setQuestions(detData.questions);
        questionsRef.current = detData.questions;
        setExamMeta({
          title: detData.exam.title,
          passingScore: detData.exam.passingScore,
        });
        setRemainingMs(detData.attempt.remainingMs);

        const map: Record<string, AnswerState> = {};
        for (const sa of detData.savedAnswers as SavedAnswer[]) {
          map[sa.questionId] = {
            optionId: sa.optionId,
            selectedOptionIds: sa.selectedOptionIds,
            textAnswer: sa.textAnswer,
            ratingValue: sa.ratingValue,
            scaleValue: sa.scaleValue,
            dateValue: sa.dateValue,
            fileUrl: sa.fileUrl,
            matrixAnswer: sa.matrixAnswer,
          };
        }
        setAnswers(map);
      } catch {
        if (!cancelled) {
          toast.error("Bağlantı hatası");
          router.push(`/akademi/exams/${examId}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const handleSubmit = useCallback(
    async (isAuto: boolean) => {
      if (!attemptIdRef.current) return;
      if (
        !isAuto &&
        !confirm(
          "Sınavı bitirmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        )
      ) {
        return;
      }
      submittingRef.current = true;
      setSubmitting(true);

      await new Promise((resolve) =>
        setTimeout(resolve, AUTO_SAVE_DEBOUNCE + 200)
      );

      try {
        const res = await fetch(
          `/api/akademi/attempts/${attemptIdRef.current}/submit`,
          { method: "POST" }
        );
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Submit başarısız");
          setSubmitting(false);
          submittingRef.current = false;
          return;
        }
        toast.success(
          isAuto
            ? "Süre doldu, sınav otomatik gönderildi"
            : "Sınav tamamlandı"
        );
        router.push(
          `/akademi/exams/${examIdRef.current}/result/${attemptIdRef.current}`
        );
      } catch {
        toast.error("Submit hatası");
        setSubmitting(false);
        submittingRef.current = false;
      }
    },
    [router]
  );

  useEffect(() => {
    if (remainingMs === null) return;
    const interval = setInterval(() => {
      setRemainingMs((prev) => {
        if (prev === null) return null;
        const next = prev - 1000;
        if (next <= 0 && !submittingRef.current) {
          submittingRef.current = true;
          handleSubmit(true);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs !== null, handleSubmit]);

  const saveAnswer = useCallback(
    (questionId: string, payload: AnswerState) => {
      const aId = attemptIdRef.current;
      if (!aId) return;
      // FILE_UPLOAD ayrı endpoint kullanır; autosave atlanır
      const q = questionsRef.current.find((x) => x.id === questionId);
      if (q?.type === "FILE_UPLOAD") return;
      if (saveTimers.current[questionId]) {
        clearTimeout(saveTimers.current[questionId]);
      }
      saveTimers.current[questionId] = setTimeout(async () => {
        try {
          await fetch(`/api/akademi/attempts/${aId}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId, ...payload }),
          });
        } catch {
          /* network hatası — kullanıcıyı rahatsız etme, sıradaki autosave yeniden dener */
        }
      }, AUTO_SAVE_DEBOUNCE);
    },
    []
  );

  const updateAnswer = useCallback(
    (questionId: string, partial: AnswerState) => {
      setAnswers((prev) => {
        const cur = prev[questionId] || {};
        return { ...prev, [questionId]: { ...cur, ...partial } };
      });
      saveAnswer(questionId, partial);
    },
    [saveAnswer]
  );

  if (loading) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
        Yükleniyor...
      </div>
    );
  }
  if (!examMeta || questions.length === 0) {
    return (
      <div className="p-6 text-red-600">Sınav verisi yüklenemedi</div>
    );
  }

  const current = questions[currentIdx];
  const currentAnswer = answers[current.id] || {};
  const answeredCount = questions.filter((q) => isAnswered(answers[q.id])).length;

  return (
    <div className="min-h-screen bg-slate-50 -mx-8 -my-7 px-0 py-0">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold truncate">{examMeta.title}</h1>
            <p className="text-xs text-slate-500">
              Soru {currentIdx + 1} / {questions.length} · Cevaplanan:{" "}
              {answeredCount}
            </p>
          </div>
          {remainingMs !== null && <Timer remainingMs={remainingMs} />}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-mono text-slate-400">
              #{currentIdx + 1}
            </span>
            <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-medium">
              {current.points} puan
            </span>
          </div>
          <p className="text-base font-medium whitespace-pre-wrap">
            {current.question}
          </p>

          <QuestionInput
            question={current}
            answer={currentAnswer}
            attemptId={attemptId}
            onChange={(partial) => updateAnswer(current.id, partial)}
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <ChevronLeft size={16} />
            Önceki
          </button>

          {currentIdx === questions.length - 1 ? (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2 font-medium"
            >
              <Send size={16} />
              {submitting ? "Gönderiliyor..." : "Sınavı Bitir"}
            </button>
          ) : (
            <button
              onClick={() =>
                setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))
              }
              className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 inline-flex items-center gap-1"
            >
              Sonraki
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        <QuestionNav
          questions={questions}
          currentIdx={currentIdx}
          answers={answers}
          onJump={setCurrentIdx}
        />

        {currentIdx !== questions.length - 1 && (
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="w-full px-4 py-2 border border-green-600 text-green-700 rounded-md hover:bg-green-50 disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
          >
            <Send size={14} />
            Sınavı Şimdi Bitir
          </button>
        )}
      </div>
    </div>
  );
}

function Timer({ remainingMs }: { remainingMs: number }) {
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const lowTime = remainingMs < 5 * 60 * 1000;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-sm font-semibold whitespace-nowrap ${
        lowTime ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-800"
      }`}
    >
      <Clock size={14} />
      {minutes.toString().padStart(2, "0")}:
      {seconds.toString().padStart(2, "0")}
      {lowTime && <AlertTriangle size={12} />}
    </div>
  );
}

function QuestionNav({
  questions,
  currentIdx,
  answers,
  onJump,
}: {
  questions: Question[];
  currentIdx: number;
  answers: Record<string, AnswerState>;
  onJump: (idx: number) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap gap-2">
      {questions.map((q, idx) => {
        const answered = isAnswered(answers[q.id]);
        const isCurrent = idx === currentIdx;
        return (
          <button
            key={q.id}
            onClick={() => onJump(idx)}
            className={`w-9 h-9 rounded text-sm font-medium transition-colors ${
              isCurrent
                ? "bg-slate-900 text-white"
                : answered
                ? "bg-green-100 text-green-800 border border-green-300"
                : "bg-slate-100 text-slate-600 border border-slate-200"
            }`}
          >
            {idx + 1}
          </button>
        );
      })}
    </div>
  );
}

function QuestionInput({
  question,
  answer,
  attemptId,
  onChange,
}: {
  question: Question;
  answer: AnswerState;
  attemptId: string | null;
  onChange: (partial: AnswerState) => void;
}) {
  switch (question.type) {
    case "DROPDOWN":
      return (
        <select
          value={answer.optionId ?? ""}
          onChange={(e) => onChange({ optionId: e.target.value || null })}
          className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
        >
          <option value="">— Seçiniz —</option>
          {question.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.text}
            </option>
          ))}
        </select>
      );

    case "FILE_UPLOAD":
      return (
        <FileUploadInput
          question={question}
          answer={answer}
          attemptId={attemptId}
          onChange={onChange}
        />
      );

    case "MATRIX":
      return (
        <MatrixInput question={question} answer={answer} onChange={onChange} />
      );

    case "SINGLE_CHOICE":
    case "TRUE_FALSE":
    case "YES_NO":
      return (
        <div className="space-y-2">
          {question.options.map((o) => (
            <label
              key={o.id}
              className="flex items-center gap-3 p-3 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={answer.optionId === o.id}
                onChange={() => onChange({ optionId: o.id })}
                className="w-4 h-4"
              />
              <span>{o.text}</span>
            </label>
          ))}
        </div>
      );

    case "MULTIPLE_CHOICE": {
      const selected: string[] = answer.selectedOptionIds ?? [];
      return (
        <div className="space-y-2">
          {question.options.map((o) => (
            <label
              key={o.id}
              className="flex items-center gap-3 p-3 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...selected, o.id]
                    : selected.filter((s) => s !== o.id);
                  onChange({ selectedOptionIds: next });
                }}
                className="w-4 h-4"
              />
              <span>{o.text}</span>
            </label>
          ))}
        </div>
      );
    }

    case "TEXT_SHORT":
      return (
        <input
          type="text"
          value={answer.textAnswer ?? ""}
          onChange={(e) => onChange({ textAnswer: e.target.value })}
          className="w-full px-3 py-2 border border-slate-300 rounded-md"
          placeholder="Cevabınızı yazın..."
          maxLength={500}
        />
      );

    case "TEXT_LONG":
      return (
        <textarea
          value={answer.textAnswer ?? ""}
          onChange={(e) => onChange({ textAnswer: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 border border-slate-300 rounded-md"
          placeholder="Cevabınızı yazın..."
          maxLength={5000}
        />
      );

    case "RATING":
      return (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ ratingValue: v })}
              className={`w-12 h-12 rounded-lg border-2 font-bold transition-colors ${
                answer.ratingValue === v
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      );

    case "SCALE": {
      const sv = answer.scaleValue ?? 5;
      return (
        <div className="space-y-3">
          <input
            type="range"
            min={1}
            max={10}
            value={sv}
            onChange={(e) => onChange({ scaleValue: Number(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>1</span>
            <span className="text-base font-bold text-slate-800">
              Seçim: {answer.scaleValue ?? "—"}
            </span>
            <span>10</span>
          </div>
        </div>
      );
    }

    case "DATE": {
      const dateVal = answer.dateValue
        ? new Date(answer.dateValue).toISOString().split("T")[0]
        : "";
      return (
        <input
          type="date"
          value={dateVal}
          onChange={(e) =>
            onChange({ dateValue: e.target.value || null })
          }
          className="px-3 py-2 border border-slate-300 rounded-md"
        />
      );
    }

    default:
      return (
        <div className="text-red-600 text-sm">
          Desteklenmeyen tip: {question.type}
        </div>
      );
  }
}

function FileUploadInput({
  question,
  answer,
  attemptId,
  onChange,
}: {
  question: Question;
  answer: AnswerState;
  attemptId: string | null;
  onChange: (partial: AnswerState) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const allowed = (question.allowedFileTypes || "pdf,doc,docx,jpg,jpeg,png")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !attemptId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("questionId", question.id);
      const res = await fetch(`/api/akademi/attempts/${attemptId}/upload`, {
        method: "POST",
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Yükleme başarısız");
        return;
      }
      onChange({ fileUrl: d.fileUrl, fileName: d.fileName });
      toast.success("Dosya yüklendi");
    } catch {
      toast.error("Beklenmeyen hata");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (answer.fileUrl) {
    return (
      <div className="border-2 border-dashed border-green-300 bg-green-50 rounded-lg p-5 text-center">
        <div className="text-sm text-green-800 font-medium mb-1">
          ✓ Dosya yüklendi
        </div>
        <a
          href={answer.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline inline-block mb-3"
        >
          {answer.fileName ?? "Yüklenen dosyayı aç"}
        </a>
        <div>
          <label className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-300 bg-white rounded cursor-pointer hover:bg-slate-50 text-sm">
            {uploading ? "Yükleniyor..." : "Yeniden Yükle"}
            <input
              type="file"
              accept={allowed.map((e) => `.${e}`).join(",")}
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
      <label className="cursor-pointer block">
        <div className="text-sm text-slate-700 font-medium mb-1">
          Cevabınızı dosya olarak yükleyin
        </div>
        <div className="text-xs text-slate-500 mb-3">
          İzin verilen: {allowed.join(", ")} · Max 10MB
        </div>
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm">
          {uploading ? "Yükleniyor..." : "Dosya Seç"}
        </span>
        <input
          type="file"
          accept={allowed.map((e) => `.${e}`).join(",")}
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
      </label>
    </div>
  );
}

function MatrixInput({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: AnswerState;
  onChange: (partial: AnswerState) => void;
}) {
  const cfg = question.matrixConfig;
  if (!cfg || !Array.isArray(cfg.rows) || !Array.isArray(cfg.cols)) {
    return (
      <div className="text-red-600 text-sm">Matris konfigürasyonu eksik</div>
    );
  }
  const ans = answer.matrixAnswer ?? {};

  function setCell(rowIdx: number, colIdx: number) {
    const next = { ...ans, [String(rowIdx)]: colIdx };
    onChange({ matrixAnswer: next });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-slate-300 bg-slate-50 p-2 text-left text-xs font-medium" />
            {cfg.cols.map((c, idx) => (
              <th
                key={idx}
                className="border border-slate-300 bg-slate-50 p-2 text-xs font-medium"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cfg.rows.map((r, rIdx) => (
            <tr key={rIdx}>
              <td className="border border-slate-300 p-2 font-medium">{r}</td>
              {cfg.cols.map((_, cIdx) => (
                <td
                  key={cIdx}
                  className="border border-slate-300 p-2 text-center"
                >
                  <input
                    type="radio"
                    name={`matrix-${question.id}-${rIdx}`}
                    checked={ans[String(rIdx)] === cIdx}
                    onChange={() => setCell(rIdx, cIdx)}
                    className="w-4 h-4 cursor-pointer"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
