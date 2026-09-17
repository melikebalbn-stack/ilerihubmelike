import { prisma } from "@/lib/prisma";
import { isExternalContentUrl } from "@/lib/akademi-helpers";

/** VIDEO içerik için tamamlama şartı: gerçek izlenen süre / gerçek süre. */
export const VIDEO_TAMAMLAMA_ORANI = 0.9;

export type VideoIzlemeDurumu = {
  /** %90 şartı bu içerikte uygulanır mı (yüklenmiş video, IFS dışı kurs). */
  sartUygulanir: boolean;
  watchedSeconds: number;
  lastPositionSec: number;
  videoDurationSec: number | null;
  /** 0–100; süre bilinmiyorsa 0. */
  watchedPercent: number;
  /** şart uygulanmıyorsa true; uygulanıyorsa watchedPercent >= 90. */
  tamamlanabilir: boolean;
};

type ContentLite = {
  type: string;
  fileUrl: string | null;
  videoDurationSec: number | null;
  course: { isIfs: boolean };
};

/**
 * %90 şartı YALNIZ: type=VIDEO + yüklenmiş dosya (harici SharePoint/Stream
 * linki DEĞİL) + IFS dışı kurs. Harici URL'de süre ölçülemez → manuel
 * tamamlama; IFS kurslarının kendi GOREV mantığı var (karar 17.09.2026).
 */
export function videoSartiUygulanir(c: ContentLite): boolean {
  return c.type === "VIDEO" && !isExternalContentUrl(c.fileUrl) && !c.course.isIfs;
}

export function izlemeYuzdesi(
  watchedSeconds: number,
  videoDurationSec: number | null
): number {
  if (!videoDurationSec || videoDurationSec <= 0) return 0;
  return Math.min(100, Math.round((watchedSeconds / videoDurationSec) * 100));
}

export function izlemeDurumu(
  c: ContentLite,
  prog: { watchedSeconds: number | null; lastPositionSec: number | null } | null | undefined
): VideoIzlemeDurumu {
  const sartUygulanir = videoSartiUygulanir(c);
  const watchedSeconds = prog?.watchedSeconds ?? 0;
  const watchedPercent = izlemeYuzdesi(watchedSeconds, c.videoDurationSec);
  return {
    sartUygulanir,
    watchedSeconds,
    lastPositionSec: prog?.lastPositionSec ?? 0,
    videoDurationSec: c.videoDurationSec,
    watchedPercent,
    tamamlanabilir: !sartUygulanir || watchedPercent >= VIDEO_TAMAMLAMA_ORANI * 100,
  };
}

/**
 * Sınav kilidi: kursun aktif, GOREV dışı tüm içerikleri kullanıcı tarafından
 * tamamlanmış olmalı. IFS kursları HARİÇ (kilit yok). Fail-closed: içerik
 * listesi okunamazsa kilitli sayılır.
 */
export async function sinavKilidi(
  userId: string,
  courseId: string
): Promise<{ locked: boolean; lockReason: string | null; completed: number; required: number }> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      isIfs: true,
      contents: {
        where: { isActive: true, type: { not: "GOREV" } },
        select: { id: true, progress: { where: { userId }, select: { completed: true }, take: 1 } },
      },
    },
  });
  if (!course) return { locked: true, lockReason: "Kurs bulunamadı", completed: 0, required: 0 };
  if (course.isIfs) return { locked: false, lockReason: null, completed: 0, required: 0 };
  const required = course.contents.length;
  const completed = course.contents.filter((c) => c.progress[0]?.completed).length;
  if (required === 0 || completed >= required) {
    return { locked: false, lockReason: null, completed, required };
  }
  return {
    locked: true,
    lockReason: `Önce tüm eğitim içeriklerini tamamlayın (${completed}/${required})`,
    completed,
    required,
  };
}
