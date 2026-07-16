import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-permission";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { resolveUserBolum, getLinkedBolums } from "@/lib/user-personnel";
import {
  computeIfsBolumReport,
  hasBelirsizIfsUsers,
  BOLUM_BELIRSIZ,
} from "@/lib/akademi/ifs-aggregate";

// PR-IFS-RAPOR-2b: Bölüm-öncelikli IFS raporu.
// - bolum param YOK → meta { scope, bolums } (dropdown; admin'de "Bölümü Belirsiz" dahil).
// - bolum param VAR → o bölümün birleşik IFS durumu.
// Scope ifs-aggregate ile AYNI: admin=tüm bölümler; değilse yalnız kendi bölümü.
const querySchema = z.object({
  bolum: z.string().trim().min(1).optional(),
});

export async function GET(req: NextRequest) {
  const { session, error } = await requirePermission("akademi.report.view");
  if (error) return error;
  const callerId = await resolveAkademiUserId(session);
  if (!callerId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz parametre" },
      { status: 400 }
    );
  }
  const { bolum } = parsed.data;

  const perms = await getUserPermissions(callerId);
  const fullScope = perms.has("akademi.admin");
  const ownBolum = fullScope ? null : await resolveUserBolum(callerId);

  // ── META (bolum yok) ──
  if (!bolum) {
    // "Bölümü Belirsiz" YALNIZ admin scope'ta ve gerçekten bağsız/bolumsüz IFS-atamalı
    // kullanıcı varsa listelenir (boş grup gösterme). Admin-olmayan scope hiç görmez.
    const bolums = fullScope
      ? [
          ...(await getLinkedBolums()),
          ...((await hasBelirsizIfsUsers()) ? [BOLUM_BELIRSIZ] : []),
        ]
      : ownBolum
        ? [ownBolum]
        : [];
    return NextResponse.json({
      scope: fullScope ? "full" : "own",
      bolums,
    });
  }

  // ── RAPOR (bolum seçili) ──
  if (!fullScope && ownBolum !== bolum) {
    return NextResponse.json(
      { error: "Bu bölümü görüntüleme yetkiniz yok" },
      { status: 403 }
    );
  }

  const report = await computeIfsBolumReport({ bolum, now: new Date() });
  return NextResponse.json(report);
}
