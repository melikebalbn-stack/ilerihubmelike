import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import {
  IFS_EGITIM_OKUMA,
  ifsEgitimKapsami,
  ifsKapsamYok,
} from "@/lib/akademi/ifs-kapsam";
import { ifsPaketKisileri } from "@/lib/akademi/ifs-rapor-veri";

// IFS — bir paketteki (departmandaki) KİŞİ listesi (READ).
// Yetki: OR(akademi.kurs.edit, ifs.keyuser); kapsam ifs-kapsam.ts'te,
// hesap ifs-rapor-veri.ts'te (export ucu da oradan besleniyor).
export async function GET(req: NextRequest) {
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

  const packageId = req.nextUrl.searchParams.get("packageId")?.trim();
  if (!packageId) {
    return NextResponse.json({ error: "packageId gerekli" }, { status: 400 });
  }

  const veri = await ifsPaketKisileri(kapsam, callerId, packageId);
  if (!veri) {
    return NextResponse.json({ error: "IFS paketi bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(veri);
}
