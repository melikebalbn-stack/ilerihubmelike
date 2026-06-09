"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Pencil,
  Trash2,
  Play,
  FileText,
  FileCode,
  HelpCircle,
  ListChecks,
  CheckCircle2,
} from "lucide-react";
import type { AdminContentItem } from "@/types/akademi-admin";

const TYPE_ICONS = {
  VIDEO: Play,
  PDF: FileText,
  DOCUMENT: FileCode,
  QUIZ: HelpCircle,
  GOREV: ListChecks,
};

const TYPE_GLOW: Record<string, string> = {
  VIDEO: "var(--ak-purple-glow)",
  PDF: "var(--ak-red-glow)",
  DOCUMENT: "var(--ak-teal-glow)",
  QUIZ: "var(--ak-orange-glow)",
  GOREV: "var(--ak-accent-glow)",
};

const TYPE_COLOR: Record<string, string> = {
  VIDEO: "var(--ak-purple)",
  PDF: "var(--ak-red)",
  DOCUMENT: "var(--ak-teal)",
  QUIZ: "var(--ak-orange)",
  GOREV: "var(--ak-accent)",
};

interface Props {
  content: AdminContentItem;
  onEdit: (c: AdminContentItem) => void;
  onDelete: (c: AdminContentItem) => void;
}

export function AdminContentRow({ content, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: content.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : content.isActive ? 1 : 0.6,
  };

  const Icon = TYPE_ICONS[content.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="ak-card-static p-3 flex items-center gap-3"
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="p-1 cursor-grab active:cursor-grabbing touch-none"
        title="Sürükle"
      >
        <GripVertical
          className="w-4 h-4"
          style={{ color: "var(--ak-text-tertiary)" }}
        />
      </button>

      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: TYPE_GLOW[content.type] }}
      >
        <Icon className="w-4 h-4" style={{ color: TYPE_COLOR[content.type] }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold truncate"
            style={{ color: "var(--ak-text-primary)" }}
          >
            {content.title}
          </span>
          {content.filePath && (
            <CheckCircle2
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: "var(--ak-green)" }}
            />
          )}
          {!content.isActive && (
            <span className="text-xs text-gray-400">(pasif)</span>
          )}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span>{content.type === "GOREV" ? "Görev" : content.type}</span>
          {content.type === "GOREV" && content.ifsMeta?.ifsEkran && (
            <>
              <span>·</span>
              <span>{content.ifsMeta.ifsEkran}</span>
            </>
          )}
          {content.duration && (
            <>
              <span>·</span>
              <span>{content.duration} dk</span>
            </>
          )}
          {content.fileSize && (
            <>
              <span>·</span>
              <span>{(content.fileSize / 1024 / 1024).toFixed(1)} MB</span>
            </>
          )}
          {!content.filePath &&
            content.type !== "QUIZ" &&
            content.type !== "GOREV" && (
            <>
              <span>·</span>
              <span className="text-orange-500">Dosya yüklenmedi</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(content)}
          className="p-2 rounded-md hover:bg-gray-100"
          title="Düzenle"
        >
          <Pencil
            className="w-4 h-4"
            style={{ color: "var(--ak-text-secondary)" }}
          />
        </button>
        <button
          type="button"
          onClick={() => onDelete(content)}
          className="p-2 rounded-md hover:bg-red-50"
          title="Sil"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>
    </div>
  );
}
