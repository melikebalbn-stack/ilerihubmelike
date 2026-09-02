import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import {
  IFS_EGITIM_OKUMA,
  ifsEgitimKapsami,
  ifsKapsamYok,
} from "@/lib/akademi/ifs-kapsam";
import { ifsKisiGorevleri } from "@/lib/akademi/ifs-rapor-veri";

// IFS — bir kişinin bir PAKETTEKİ görev dökümü (READ).
// Yetki: OR(akademi.kurs.edit, ifs.keyuser); kapsam ifs-kapsam.ts'te — key user
// kapsamı dışındaki kişiyi sorgularsa 403. Hesap ifs-rapor-veri.ts'te.
//
// ?tumu=1 verilmezse yalnız DEĞERLENDİRME SATIRI OLAN görevler döner; verilirse
// paketteki bütün görevler döner (dokunulmamışlar BEKLIYOR/PENDING ile).
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

  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  const packageId = req.nextUrl.searchParams.get("packageId")?.trim();
  const tumu = req.nextUrl.searchParams.get("tumu") === "1";
  if (!userId) {
    return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
  }
  if (!packageId) {
    return NextResponse.json({ error: "packageId gerekli" }, { status: 400 });
  }

  const sonuc = await ifsKisiGorevleri(kapsam, userId, packageId, tumu);
  if (sonuc.hata === "kisi-yok") {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  }
  if (sonuc.hata === "kapsam-disi") {
    return NextResponse.json(ifsKapsamYok(), { status: 403 });
  }
  if (sonuc.hata === "paket-yok") {
    return NextResponse.json({ error: "IFS paketi bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(sonuc.veri);
}
