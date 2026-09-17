"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * İzleme takipli video oynatıcı (Dalga 2, 17.09.2026).
 *
 * SAYAÇ KURALI — gerçek izlenen süre, ileri sarma sayılmaz:
 *  - timeupdate'te delta = currentTime − lastTime; yalnız 0 < delta ≤ 1.5 sn
 *    ise (oynatma hızına bölünerek) watched'a eklenir. Seek sıçraması büyük
 *    delta, geri sarma negatif delta → sayılmaz.
 *  - seeking/seeked: lastTime = currentTime (sıçrama sonrası taban sıfırlanır).
 *  - ratechange: delta / playbackRate (2× izlemede gerçek süre yarısı sayılır).
 *
 * KAYIT — 15 sn'de bir ve pause/ended/visibilitychange(hidden)/beforeunload'da
 * POST contents/[id]/watch; sayfa kapanırken navigator.sendBeacon (text/plain).
 * Ağ kopmasında sayaç istemcide birikmeye devam eder, ilk başarılı kayıtta yakalar
 * (sunucu monoton max aldığı için tekrar gönderim zararsız).
 *
 * Açılışta lastPositionSec'e atlar; ileri sarmayı ENGELLEMEZ (karar: yalnız takip).
 */
type Props = {
  contentId: string;
  src: string;
  initialWatchedSeconds: number;
  initialPositionSec: number;
  initialDurationSec: number | null;
  onProgress: (p: { watchedSeconds: number; watchedPercent: number; durationSec: number | null }) => void;
};

const HEARTBEAT_MS = 15_000;
const MAX_DELTA_SEC = 1.5;

export function VideoWatchPlayer({
  contentId,
  src,
  initialWatchedSeconds,
  initialPositionSec,
  initialDurationSec,
  onProgress,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const watchedRef = useRef(initialWatchedSeconds);
  const lastTimeRef = useRef<number | null>(null);
  const durationRef = useRef<number | null>(initialDurationSec);
  const lastSentRef = useRef(initialWatchedSeconds);
  const [percent, setPercent] = useState(() => pct(initialWatchedSeconds, initialDurationSec));

  const url = `/api/akademi/contents/${contentId}/watch`;

  const payload = useCallback(() => {
    const v = videoRef.current;
    return JSON.stringify({
      watchedSeconds: Math.floor(watchedRef.current),
      positionSec: Math.floor(v?.currentTime ?? 0),
      durationSec: durationRef.current ? Math.floor(durationRef.current) : undefined,
    });
  }, []);

  const send = useCallback(
    async (beacon = false) => {
      // Değişiklik yoksa gönderme (konum yine de güncellensin diye 5 sn tolerans).
      if (!beacon && Math.floor(watchedRef.current) === Math.floor(lastSentRef.current)) {
        return;
      }
      const body = payload();
      if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
        lastSentRef.current = watchedRef.current;
        return;
      }
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body,
          keepalive: true,
        });
        if (res.ok) lastSentRef.current = watchedRef.current;
      } catch {
        /* ağ kopması: sayaç istemcide birikir, sonraki heartbeat yakalar */
      }
    },
    [payload, url]
  );

  const report = useCallback(() => {
    const p = pct(watchedRef.current, durationRef.current);
    setPercent(p);
    onProgress({
      watchedSeconds: Math.floor(watchedRef.current),
      watchedPercent: p,
      durationSec: durationRef.current,
    });
  }, [onProgress]);

  // Olaylar
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoadedMetadata = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) durationRef.current = v.duration;
      if (initialPositionSec > 0 && initialPositionSec < (v.duration || Infinity) - 1) {
        v.currentTime = initialPositionSec;
      }
      lastTimeRef.current = v.currentTime;
      report();
    };
    const onTimeUpdate = () => {
      const now = v.currentTime;
      const last = lastTimeRef.current;
      if (last !== null && !v.paused && !v.seeking) {
        const delta = now - last;
        if (delta > 0 && delta <= MAX_DELTA_SEC) {
          const rate = v.playbackRate > 0 ? v.playbackRate : 1;
          watchedRef.current += delta / rate;
          if (durationRef.current) {
            watchedRef.current = Math.min(watchedRef.current, durationRef.current);
          }
          report();
        }
      }
      lastTimeRef.current = now;
    };
    const onSeek = () => {
      lastTimeRef.current = v.currentTime;
    };
    const onPauseOrEnd = () => {
      lastTimeRef.current = v.currentTime;
      void send(false);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void send(true);
    };
    const onBeforeUnload = () => void send(true);

    v.addEventListener("loadedmetadata", onLoadedMetadata);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("seeking", onSeek);
    v.addEventListener("seeked", onSeek);
    v.addEventListener("ratechange", onSeek);
    v.addEventListener("pause", onPauseOrEnd);
    v.addEventListener("ended", onPauseOrEnd);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    const timer = window.setInterval(() => void send(false), HEARTBEAT_MS);

    return () => {
      window.clearInterval(timer);
      v.removeEventListener("loadedmetadata", onLoadedMetadata);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("seeking", onSeek);
      v.removeEventListener("seeked", onSeek);
      v.removeEventListener("ratechange", onSeek);
      v.removeEventListener("pause", onPauseOrEnd);
      v.removeEventListener("ended", onPauseOrEnd);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Modal kapanırken son durumu kaydet.
      void send(true);
    };
    // initialPositionSec yalnız ilk yüklemede; send/report ref tabanlı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId, send, report]);

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="h-1.5 w-full bg-white/15 shrink-0" title={`%${percent} izlendi`}>
        <div
          className="h-full transition-[width] duration-500"
          style={{
            width: `${percent}%`,
            background: percent >= 90 ? "var(--ak-green)" : "var(--ak-accent)",
          }}
        />
      </div>
      <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-md text-[11px] font-semibold text-white bg-black/60">
        %{percent} izlendi
      </div>
      <video ref={videoRef} src={src} controls autoPlay className="w-full flex-1 min-h-0" />
    </div>
  );
}

function pct(watched: number, duration: number | null): number {
  if (!duration || duration <= 0) return 0;
  return Math.min(100, Math.round((watched / duration) * 100));
}
