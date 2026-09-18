"use client";

import { Play, CheckCircle2, Clock, Video } from "lucide-react";
import { ProgressBar } from "@/components/akademi/shared/ProgressBar";
import { formatDuration } from "@/lib/akademi-helpers";
import type { ContentItem } from "@/types/akademi";

/**
 * "1. ADIM — EĞİTİM" içindeki VIDEO kartı (Dalga 3): büyük önizleme bloğu,
 * süre, izleme yüzdesi çubuğu ve durum rozeti. İzleme verisi
 * courses/[id]'den gelir (watchedPercent / videoDurationSec); takipsiz
 * (harici URL, IFS) videolarda yüzde çubuğu gösterilmez.
 */
interface Props {
  content: ContentItem;
  index: number;
  onOpen: (content: ContentItem) => void;
}

function sureMetni(c: ContentItem): string {
  if (c.videoDurationSec && c.videoDurationSec > 0) {
    const m = Math.floor(c.videoDurationSec / 60);
    const s = c.videoDurationSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return formatDuration(c.duration);
}

export function VideoContentCard({ content, index, onOpen }: Props) {
  const takipli = content.izlemeSartiUygulanir === true;
  const percent = content.watchedPercent ?? 0;
  const done = content.completedByCurrentUser;

  const rozet = done
    ? { text: "Tamamlandı", bg: "var(--ak-green)", icon: <CheckCircle2 className="w-3.5 h-3.5" /> }
    : takipli && percent > 0
    ? { text: `%${percent} izlendi`, bg: "var(--ak-accent)", icon: <Play className="w-3.5 h-3.5" /> }
    : { text: "İzlenmedi", bg: "rgba(100,116,139,0.9)", icon: <Video className="w-3.5 h-3.5" /> };

  return (
    <div
      className="ak-card-static overflow-hidden ak-animate-in"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <button
        type="button"
        onClick={() => onOpen(content)}
        className="relative w-full aspect-video max-h-72 flex items-center justify-center text-white group"
        style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #0f172a 100%)" }}
        aria-label={`${content.title} — videoyu aç`}
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 30% 30%, #fff 0, transparent 40%)" }} />
        <div className="w-16 h-16 rounded-full flex items-center justify-center bg-white/15 group-hover:bg-white/25 transition-colors">
          <Play className="w-8 h-8 ml-1" />
        </div>
        <span
          className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold"
          style={{ background: rozet.bg }}
        >
          {rozet.icon}
          {rozet.text}
        </span>
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-black/60">
          <Clock className="w-3 h-3" />
          {sureMetni(content)}
        </span>
      </button>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold truncate" style={{ color: "var(--ak-text-primary)" }}>
              {content.title}
            </div>
            {content.description && (
              <div className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--ak-text-secondary)" }}>
                {content.description}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpen(content)}
            className="shrink-0 px-3 py-1.5 rounded-[10px] text-xs font-semibold text-white"
            style={{ background: done ? "var(--ak-green)" : "var(--ak-accent)" }}
          >
            {done ? "Tekrar izle" : percent > 0 ? "Devam et" : "İzle"}
          </button>
        </div>

        {takipli && !done && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] mb-1" style={{ color: "var(--ak-text-tertiary)" }}>
              <span>İzleme</span>
              <span>%{percent} · tamamlamak için %90</span>
            </div>
            <ProgressBar value={percent} size="sm" color={percent >= 90 ? "green" : "accent"} />
          </div>
        )}
      </div>
    </div>
  );
}
