"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  ChevronUp,
  ChevronDown,
  Edit2,
  Trash2,
  FileQuestion,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AdminDeleteConfirm } from "@/components/akademi/admin/AdminDeleteConfirm";
import { QuestionEditModal } from "./question-edit-modal";
import {
  TYPE_LABELS,
  AUTO_SCORED_TYPES,
} from "@/lib/akademi/question-types";

const AUTO_TYPES = AUTO_SCORED_TYPES as unknown as string[];

export type QuestionItem = {
  id: string;
  question: string;
  type: string;
  points: number;
  order: number;
  explanation: string | null;
  isManualGraded: boolean;
  matrixConfig?: { rows: string[]; cols: string[] } | null;
  allowedFileTypes?: string | null;
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
    order: number;
  }>;
};

export function QuestionsManager({
  examId,
  onChange,
}: {
  examId: string;
  onChange?: () => void;
}) {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(
    null
  );
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuestionItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/akademi/admin/exams/${examId}/questions`);
      const data = await res.json();
      setQuestions(data.questions ?? []);
    } catch {
      toast.error("Sorular yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = questions.findIndex((q) => q.id === active.id);
    const newIdx = questions.findIndex((q) => q.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    const reordered = arrayMove(questions, oldIdx, newIdx);
    setQuestions(reordered);

    try {
      const res = await fetch(
        `/api/akademi/admin/exams/${examId}/questions/reorder-bulk`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionIds: reordered.map((q) => q.id),
          }),
        }
      );
      if (!res.ok) {
        toast.error("Sıralama kaydedilemedi");
        load();
        return;
      }
      onChange?.();
    } catch {
      toast.error("Sıralama hatası");
      load();
    }
  };

  const handleReorderUpDown = async (
    questionId: string,
    direction: "up" | "down"
  ) => {
    setReorderingId(questionId);
    try {
      const res = await fetch(
        `/api/akademi/admin/exams/${examId}/questions/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, direction }),
        }
      );
      if (!res.ok) {
        toast.error("Sıralama hatası");
        return;
      }
      await load();
      onChange?.();
    } catch {
      toast.error("Sıralama hatası");
    } finally {
      setReorderingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/akademi/admin/exams/${examId}/questions/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Silinemedi");
        return;
      }
      toast.success("Soru silindi");
      setDeleteTarget(null);
      await load();
      onChange?.();
    } catch {
      toast.error("Beklenmeyen hata");
    } finally {
      setDeleting(false);
    }
  };

  const openNew = () => {
    setEditingQuestion(null);
    setModalOpen(true);
  };

  const openEdit = (q: QuestionItem) => {
    setEditingQuestion(q);
    setModalOpen(true);
  };

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const autoCount = questions.filter((q) => AUTO_TYPES.includes(q.type)).length;
  const manualCount = questions.length - autoCount;

  return (
    <div className="ak-card-static p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3
            className="text-sm font-bold flex items-center gap-2"
            style={{ color: "var(--ak-text-primary)" }}
          >
            <FileQuestion size={16} />
            Sorular ({questions.length})
          </h3>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            Toplam {totalPoints} puan · {autoCount} otomatik · {manualCount}{" "}
            manuel
            <span
              className="ml-2"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              · Sürükleyerek sıralayın
            </span>
          </p>
        </div>
        <Button onClick={openNew} className="gap-2" size="sm">
          <Plus className="w-4 h-4" />
          Yeni Soru
        </Button>
      </div>

      {loading && (
        <div
          className="text-sm py-6 text-center"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Yükleniyor...
        </div>
      )}

      {!loading && questions.length === 0 && (
        <div
          className="text-center py-8 text-sm border border-dashed rounded-md"
          style={{
            borderColor: "var(--ak-border-default)",
            color: "var(--ak-text-tertiary)",
          }}
        >
          Henüz soru eklenmemiş. &quot;Yeni Soru&quot; ile başlayın.
        </div>
      )}

      {!loading && questions.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {questions.map((q, idx) => (
                <SortableQuestionRow
                  key={q.id}
                  question={q}
                  index={idx}
                  total={questions.length}
                  reorderingId={reorderingId}
                  onUp={() => handleReorderUpDown(q.id, "up")}
                  onDown={() => handleReorderUpDown(q.id, "down")}
                  onEdit={() => openEdit(q)}
                  onDelete={() => setDeleteTarget(q)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <QuestionEditModal
        examId={examId}
        question={editingQuestion}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingQuestion(null);
        }}
        onSaved={() => {
          setModalOpen(false);
          setEditingQuestion(null);
          load();
          onChange?.();
        }}
      />

      <AdminDeleteConfirm
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Soruyu silmek istediğinize emin misiniz?"
        description={
          deleteTarget
            ? `"${deleteTarget.question.slice(0, 80)}${
                deleteTarget.question.length > 80 ? "..." : ""
              }" ve tüm seçenekleri silinecek.`
            : ""
        }
        confirmLabel="Sil"
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
    </div>
  );
}

function SortableQuestionRow({
  question: q,
  index,
  total,
  reorderingId,
  onUp,
  onDown,
  onEdit,
  onDelete,
}: {
  question: QuestionItem;
  index: number;
  total: number;
  reorderingId: string | null;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: q.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderColor: "var(--ak-border-divider)" }}
      className={`border rounded-md p-3 transition-colors bg-white ${
        isDragging ? "shadow-lg" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="p-1 cursor-grab active:cursor-grabbing rounded hover:bg-slate-100 mt-0.5"
          style={{ color: "var(--ak-text-tertiary)" }}
          title="Sürükle"
        >
          <GripVertical size={14} />
        </button>

        <div className="flex flex-col gap-0.5 pt-0.5">
          <button
            onClick={onUp}
            disabled={index === 0 || reorderingId === q.id}
            className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 transition-opacity"
            title="Yukarı taşı"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={onDown}
            disabled={index === total - 1 || reorderingId === q.id}
            className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 transition-opacity"
            title="Aşağı taşı"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className="text-xs font-mono"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              #{index + 1}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded font-medium"
              style={{
                background: "var(--ak-surface-secondary)",
                color: "var(--ak-text-secondary)",
              }}
            >
              {TYPE_LABELS[q.type] || q.type}
            </span>
            <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-medium">
              {q.points} puan
            </span>
            {q.isManualGraded && (
              <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded font-medium">
                Manuel
              </span>
            )}
          </div>
          <p
            className="text-sm font-medium"
            style={{ color: "var(--ak-text-primary)" }}
          >
            {q.question}
          </p>
          {q.options.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {q.options.map((o) => (
                <div
                  key={o.id}
                  className="text-xs flex items-center gap-2"
                  style={{ color: "var(--ak-text-secondary)" }}
                >
                  {AUTO_TYPES.includes(q.type) && (
                    <span
                      className={
                        o.isCorrect
                          ? "text-green-600 font-bold"
                          : "text-slate-300"
                      }
                    >
                      {o.isCorrect ? "✓" : "○"}
                    </span>
                  )}
                  <span>{o.text}</span>
                </div>
              ))}
            </div>
          )}
          {q.type === "MATRIX" && q.matrixConfig && (
            <div
              className="mt-2 text-xs"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              {q.matrixConfig.rows?.length || 0} satır ×{" "}
              {q.matrixConfig.cols?.length || 0} sütun
            </div>
          )}
          {q.type === "FILE_UPLOAD" && q.allowedFileTypes && (
            <div
              className="mt-2 text-xs font-mono"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              Dosya: {q.allowedFileTypes}
            </div>
          )}
          {q.explanation && (
            <p
              className="mt-2 text-xs italic"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              💡 {q.explanation}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded hover:opacity-70 transition-opacity"
            title="Düzenle"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
            title="Sil"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
