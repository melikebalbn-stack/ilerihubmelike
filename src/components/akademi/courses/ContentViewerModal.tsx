"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, Download } from "lucide-react";
import { getContentFileUrl, getContentTypeLabel } from "@/lib/akademi-helpers";
import type { ContentItem } from "@/types/akademi";

interface Props {
  content: ContentItem | null;
  onClose: () => void;
  onMarkComplete: (contentId: string) => Promise<void>;
  isMarking: boolean;
}

export function ContentViewerModal({
  content,
  onClose,
  onMarkComplete,
  isMarking,
}: Props) {
  const open = content !== null;
  const fileUrl = content ? getContentFileUrl(content) : null;

  return (
    <AnimatePresence>
      {open && content && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(15,23,42,0.75)",
            backdropFilter: "blur(8px)",
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-5xl h-[85vh] rounded-2xl flex flex-col overflow-hidden"
            style={{ background: "var(--ak-bg-card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-3 border-b"
              style={{ borderColor: "var(--ak-border-divider)" }}
            >
              <div className="min-w-0">
                <div
                  className="text-xs uppercase tracking-wide"
                  style={{ color: "var(--ak-text-tertiary)" }}
                >
                  {getContentTypeLabel(content.type)}
                </div>
                <div
                  className="text-base font-bold truncate"
                  style={{ color: "var(--ak-text-primary)" }}
                >
                  {content.title}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg"
                style={{
                  background: "var(--ak-bg-search)",
                  color: "var(--ak-text-secondary)",
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto" style={{ background: "#000" }}>
              {!fileUrl ? (
                <div className="h-full flex items-center justify-center text-white/60 text-sm">
                  Dosya yüklenmemiş.
                </div>
              ) : content.type === "VIDEO" ? (
                <video
                  src={fileUrl}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              ) : content.type === "PDF" ? (
                <iframe src={fileUrl} className="w-full h-full border-0" />
              ) : content.type === "QUIZ" ? (
                <div className="h-full flex items-center justify-center text-white/60 text-sm px-8 text-center">
                  Sınav içeriği Sprint 3&apos;te desteklenecek.
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-white/60 text-sm">
                  <div>Bu dosya türü tarayıcıda önizlenemez.</div>
                  <a
                    href={fileUrl}
                    download
                    className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold"
                    style={{ background: "var(--ak-accent)", color: "#fff" }}
                  >
                    <Download className="w-4 h-4" />
                    İndir
                  </a>
                </div>
              )}
            </div>

            <div
              className="flex items-center justify-between px-5 py-3 border-t"
              style={{
                borderColor: "var(--ak-border-divider)",
                background: "var(--ak-bg-card)",
              }}
            >
              <div className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
                {content.completedByCurrentUser
                  ? "✓ Tamamlandı"
                  : "İçeriği bitirince tamamla butonuna bas"}
              </div>
              {!content.completedByCurrentUser && (
                <button
                  onClick={() => onMarkComplete(content.id)}
                  disabled={isMarking}
                  className="px-4 py-2 rounded-[10px] text-sm font-semibold disabled:opacity-50"
                  style={{ background: "var(--ak-green)", color: "#fff" }}
                >
                  {isMarking ? "Kaydediliyor..." : "Tamamlandı olarak işaretle"}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
