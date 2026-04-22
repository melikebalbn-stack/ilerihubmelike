"use client";

import {
  Play,
  FileText,
  FileCode,
  HelpCircle,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { getContentTypeLabel, formatDuration } from "@/lib/akademi-helpers";
import type { ContentItem } from "@/types/akademi";

interface Props {
  content: ContentItem;
  index: number;
  onOpen: (content: ContentItem) => void;
  onMarkComplete: (contentId: string) => Promise<void>;
  isMarking: boolean;
}

const ICONS = {
  VIDEO: Play,
  PDF: FileText,
  DOCUMENT: FileCode,
  QUIZ: HelpCircle,
};

const COLORS = {
  VIDEO: "purple",
  PDF: "red",
  DOCUMENT: "teal",
  QUIZ: "orange",
} as const;

export function ContentRow({
  content,
  index,
  onOpen,
  onMarkComplete,
  isMarking,
}: Props) {
  const Icon = ICONS[content.type];
  const colorKey = COLORS[content.type];
  const isCompleted = content.completedByCurrentUser;
  const canView = Boolean(content.filePath || content.fileUrl);

  return (
    <div
      className={`ak-card-static p-4 flex items-center gap-4 ak-animate-in ak-delay-${Math.min(
        index + 1,
        8
      )}`}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: isCompleted
            ? "var(--ak-green-glow)"
            : `var(--ak-${colorKey}-glow)`,
        }}
      >
        {isCompleted ? (
          <CheckCircle2
            className="w-5 h-5"
            style={{ color: "var(--ak-green)" }}
          />
        ) : (
          <Icon
            className="w-5 h-5"
            style={{ color: `var(--ak-${colorKey})` }}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-semibold mb-0.5 truncate"
          style={{ color: "var(--ak-text-primary)" }}
        >
          {index + 1}. {content.title}
        </div>
        <div
          className="text-xs flex items-center gap-2"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          <span>{getContentTypeLabel(content.type)}</span>
          {content.duration && (
            <>
              <span>•</span>
              <span>{formatDuration(content.duration)}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {canView ? (
          <button
            onClick={() => onOpen(content)}
            className="px-3 py-1.5 text-xs font-semibold rounded-[10px] flex items-center gap-1 transition-colors"
            style={{
              background: "var(--ak-accent-glow)",
              color: "var(--ak-accent)",
            }}
          >
            <Eye className="w-3.5 h-3.5" />
            Görüntüle
          </button>
        ) : (
          <div
            className="text-xs italic"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            Dosya yüklenmedi
          </div>
        )}
        {!isCompleted && (
          <button
            onClick={() => onMarkComplete(content.id)}
            disabled={isMarking}
            className="px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-colors disabled:opacity-50"
            style={{ background: "var(--ak-green)", color: "#fff" }}
          >
            {isMarking ? "..." : "Tamamla"}
          </button>
        )}
      </div>
    </div>
  );
}
