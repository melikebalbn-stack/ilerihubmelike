"use client";

import { useState } from "react";
import DOMPurify from "dompurify";
import { X } from "lucide-react";
import { SplitBadge } from "@/components/akademi/SplitBadge";
import {
  canClosePopup,
  categoryLabel,
  categoryColor,
  type CategoryLike,
} from "@/lib/announcements/announcement-ui";

export type AnnouncementPopupData = {
  id: string;
  title: string;
  content: string;
  authorName: string;
  publishedAt?: string | Date | null;
  requireAcknowledgment: boolean;
  eylemUrl?: string | null;
  eylemMetni?: string | null;
  category?: CategoryLike;
};

function trTarih(d?: string | Date | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Duyuru popup'ı. Onay gerektiren duyuruda yalnız "Okudum, anladım" işaretlenince
 * kapanabilir (✕ ve dış tıklama kapatmaz); değilse "Sonra|Kapat" ile kapanır.
 * onDismiss = görüldü (readAt), onAcknowledge = onaylandı (acknowledgedAt).
 */
export function AnnouncementModal({
  a,
  onDismiss,
  onAcknowledge,
}: {
  a: AnnouncementPopupData;
  onDismiss: () => void;
  onAcknowledge: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const closable = canClosePopup(a.requireAcknowledgment, checked);
  const catColor = categoryColor(a.category ?? null);

  const tryClose = () => {
    if (closable) onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={tryClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Başlık bandı — lacivert degrade */}
        <div
          className="relative px-6 py-5 text-white"
          style={{ background: "linear-gradient(135deg,#0f2c54,#1A5AA0)" }}
        >
          <div
            className="mb-1 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
            style={{ background: "rgba(255,255,255,.15)" }}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: catColor }} />
            YENİ DUYURU · {categoryLabel(a.category ?? null)}
          </div>
          <h2 className="pr-8 text-xl font-bold leading-snug">{a.title}</h2>
          <div className="mt-1 text-[13px] text-white/80">
            {a.authorName}
            {trTarih(a.publishedAt) ? ` · ${trTarih(a.publishedAt)}` : ""}
          </div>
          {closable && (
            <button
              type="button"
              aria-label="Kapat"
              onClick={onDismiss}
              className="absolute right-4 top-4 rounded-full p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* İçerik */}
        <div className="max-h-[55vh] overflow-y-auto px-6 py-5">
          <div
            className="prose prose-sm max-w-none text-[#0f172a]"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(a.content) }}
          />
        </div>

        {/* Alt aksiyon */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e9f0] px-6 py-4">
          {a.requireAcknowledgment ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[#334155]">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Okudum, anladım
            </label>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center gap-2">
            {a.eylemUrl && (
              <SplitBadge
                color="blue"
                left={a.eylemMetni?.trim() || "Detay"}
                right="Git"
                onClick={() => window.open(a.eylemUrl!, "_blank", "noopener,noreferrer")}
              />
            )}
            {a.requireAcknowledgment ? (
              <SplitBadge
                color="blue"
                left="Onayla"
                right="Kapat"
                onClick={onAcknowledge}
                disabled={!checked}
              />
            ) : (
              <SplitBadge color="gray" left="Sonra" right="Kapat" onClick={onDismiss} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
