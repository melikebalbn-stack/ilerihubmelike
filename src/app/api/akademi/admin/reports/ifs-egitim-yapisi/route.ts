import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import {
  IFS_EGITIM_OKUMA,
  ifsEgitimKapsami,
  ifsKapsamYok,
} from "@/lib/akademi/ifs-kapsam";
import { ifsEgitimYapisi } from "@/lib/akademi/ifs-rapor-veri";

// IFS EĞİTİM YAPISI — /ifs/egitimler ekranının veri kaynağı (READ).
//
// Yetki: OR(akademi.kurs.edit, ifs.keyuser) — kapsam TEK KAYNAK'ta
// (ifs-kapsam.ts). Hesap da TEK KAYNAK'ta (ifs-rapor-veri.ts) — export ucu
// aynı fonksiyonu çağırıyor, ekranla dosya ayrışamaz.
export async function GET() {
  const { session, error } = await requirePermission(IFS_EGITIM_OKUMA);
  if (error) return error;
  const callerId = await resolveAkademiUserId(session);
  if (!callerId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }
  const kapsam = await ifsEgitimKapsami(callerId);
  if (!kapsam.yetkili) {
    return NextResponse.json(ifsKapsamYok(), { status: 403 });
  }

  return NextResponse.json(await ifsEgitimYapisi(kapsam));
}
