"use client";

import { useState } from "react";
import {
  Play,
  FileText,
  FileCode,
  HelpCircle,
  ListChecks,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { getContentTypeLabel, formatDuration } from "@/lib/akademi-helpers";
import type { ContentItem } from "@/types/akademi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  content: ContentItem;
  index: number;
  onOpen: (content: ContentItem) => void;
  onMarkComplete: (contentId: string) => Promise<void>;
  // IFS-4: GOREV görevleri için "Örnek Yaptım" / geri al.
  // "Örnek Yaptım" (done=true) artık zorunlu açıklama taşır.
  onGorevDone?: (
    contentId: string,
    done: boolean,
    aciklama?: string
  ) => Promise<void>;
  isMarking: boolean;
}

const ICONS = {
  VIDEO: Play,
  PDF: FileText,
  DOCUMENT: FileCode,
  QUIZ: HelpCircle,
  GOREV: ListChecks,
};

const COLORS = {
  VIDEO: "purple",
  PDF: "red",
  DOCUMENT: "teal",
  QUIZ: "orange",
  GOREV: "accent",
} as const;

export function ContentRow({
  content,
  index,
  onOpen,
  onMarkComplete,
  onGorevDone,
  isMarking,
}: Props) {
  const Icon = ICONS[content.type];
  const colorKey = COLORS[content.type];
  const isCompleted = content.completedByCurrentUser;
  const isGorev = content.type === "GOREV";
  const canView = Boolean(content.filePath || content.fileUrl);

  // "Örnek Yaptım" zorunlu-açıklama modal'ı.
  const [modalOpen, setModalOpen] = useState(false);
  const [aciklama, setAciklama] = useState("");

  const openOrnekModal = () => {
    // Yeniden işaretlemede mevcut açıklamayı önele (düzenlenebilir).
    setAciklama(content.ornekAciklama ?? "");
    setModalOpen(true);
  };

  const confirmOrnek = async () => {
    const text = aciklama.trim();
    if (!text) return;
    await onGorevDone?.(content.id, true, text);
    setModalOpen(false);
  };

  return (
    <>
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
          className="text-xs flex items-center gap-2 flex-wrap"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          <span>{getContentTypeLabel(content.type)}</span>
          {isGorev && content.ifsMeta?.modul && (
            <>
              <span>•</span>
              <span>
                {content.ifsMeta.modul}
                {content.ifsMeta.altModul
                  ? ` / ${content.ifsMeta.altModul}`
                  : ""}
              </span>
            </>
          )}
          {isGorev && content.ifsMeta?.ifsEkran && (
            <>
              <span>•</span>
              <span>{content.ifsMeta.ifsEkran}</span>
            </>
          )}
          {!isGorev && content.duration && (
            <>
              <span>•</span>
              <span>{formatDuration(content.duration)}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isGorev ? (
          <>
            {content.ifsMeta?.refDocUrl && (
              <a
                href={content.ifsMeta.refDocUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-xs font-semibold rounded-[10px] flex items-center gap-1 transition-colors"
                style={{
                  background: "var(--ak-teal-glow)",
                  color: "var(--ak-teal)",
                }}
              >
                <FileText className="w-3.5 h-3.5" />
                Doküman
              </a>
            )}
            {content.ifsMeta?.refVideoUrl && (
              <a
                href={content.ifsMeta.refVideoUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-xs font-semibold rounded-[10px] flex items-center gap-1 transition-colors"
                style={{
                  background: "var(--ak-purple-glow)",
                  color: "var(--ak-purple)",
                }}
              >
                <Play className="w-3.5 h-3.5" />
                Video
              </a>
            )}
            {isCompleted ? (
              <button
                onClick={() => onGorevDone?.(content.id, false)}
                disabled={isMarking}
                className="px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-colors disabled:opacity-50"
                style={{
                  background: "var(--ak-surface-secondary)",
                  color: "var(--ak-text-secondary)",
                }}
              >
                {isMarking ? "..." : "Geri Al"}
              </button>
            ) : (
              <button
                onClick={openOrnekModal}
                disabled={isMarking}
                className="px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-colors disabled:opacity-50"
                style={{ background: "var(--ak-green)", color: "#fff" }}
              >
                {isMarking ? "..." : "Örnek Yaptım"}
              </button>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>

      {/* "Örnek Yaptım" — zorunlu kursiyer açıklaması (done=true). */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ne yaptınız? (kısa açıklama)</DialogTitle>
            <DialogDescription>
              {content.title} görevinde örnek olarak ne yaptığınızı kısaca
              yazın. Değerlendiren ekip bu açıklamayı okuyacak.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            placeholder="Örn. IFS ekranında ... kaydını oluşturdum / ... işlemini uyguladım."
            rows={4}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={isMarking}
            >
              Vazgeç
            </Button>
            <Button
              onClick={confirmOrnek}
              disabled={isMarking || aciklama.trim() === ""}
            >
              {isMarking ? "Kaydediliyor..." : "Örnek Yaptım"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
