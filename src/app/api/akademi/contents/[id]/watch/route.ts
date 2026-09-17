import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { NextResponse } from "next/server";
import { izlemeDurumu } from "@/lib/akademi/video-izleme";

/**
 * VIDEO izleme kalp atışı (heartbeat). Oynatıcı 15 sn'de bir ve
 * pause/ended/visibilitychange/beforeunload'da çağırır (navigator.sendBeacon
 * text/plain gövdeyle gönderebilir → Content-Type'a bakılmaz, gövde JSON parse edilir).
 *
 * - watchedSeconds: birikimli GERÇEK izleme (istemci ileri sarmayı saymaz);
 *   sunucuda MONOTON (max) ve videoDurationSec ile sınırlı (clamp).
 * - positionSec: kaldığı yer.
 * - durationSec: video.duration; Content.videoDurationSec boşsa bir kez yazılır.
 * completed/XP/kurs ilerlemesine DOKUNMAZ — bunlar contents/[id]/progress'te.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let body: { watchedSeconds?: unknown; positionSec?: unknown; durationSec?: unknown } = {};
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Geçersiz gövde" }, { status: 400 });
  }
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
  const watchedIn = num(body.watchedSeconds);
  const positionIn = num(body.positionSec);
  const durationIn = num(body.durationSec);

  const content = await prisma.content.findFirst({
    where: { id, isActive: true, type: "VIDEO" },
    select: {
      id: true,
      type: true,
      fileUrl: true,
      videoDurationSec: true,
      course: { select: { isIfs: true } },
    },
  });
  if (!content) {
    return NextResponse.json({ error: "Video içerik bulunamadı" }, { status: 404 });
  }

  // Gerçek süre bir kez yazılır (ilk oynatma); sonra sabit.
  let videoDurationSec = content.videoDurationSec;
  if (!videoDurationSec && durationIn && durationIn > 0) {
    await prisma.content.update({
      where: { id: content.id },
      data: { videoDurationSec: durationIn },
    });
    videoDurationSec = durationIn;
  }

  const existing = await prisma.contentProgress.findUnique({
    where: { userId_contentId: { userId, contentId: content.id } },
    select: { watchedSeconds: true, lastPositionSec: true },
  });

  const clamp = (v: number) => (videoDurationSec ? Math.min(v, videoDurationSec) : v);
  const watched = Math.max(existing?.watchedSeconds ?? 0, watchedIn !== null ? clamp(watchedIn) : 0);
  const position = positionIn !== null ? clamp(positionIn) : existing?.lastPositionSec ?? 0;

  const prog = await prisma.contentProgress.upsert({
    where: { userId_contentId: { userId, contentId: content.id } },
    create: { userId, contentId: content.id, watchedSeconds: watched, lastPositionSec: position },
    update: { watchedSeconds: watched, lastPositionSec: position },
    select: { watchedSeconds: true, lastPositionSec: true },
  });

  return NextResponse.json(izlemeDurumu({ ...content, videoDurationSec }, prog));
}
