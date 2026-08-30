import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { getLinkedBolums, resolveUserBolum } from "@/lib/user-personnel";

// IFS RAPOR — SEVİYE 1: departman özeti (parametresiz).
// Kapsam: TÜM IFS kursları (tek kurs değil) — bölüm başına tek satır.
//
// Yetki + scope: `ifs-evaluations` GET ile BİREBİR aynı — akademi.report.view,
// akademi.admin => tüm bölümler, aksi halde yalnız kendi bölümü.
//
// METRİK TANIMLARI (seviye 2 ucu ile aynı sayımlar):
//   egitimAlanKisi : o bölümde EN AZ BİR IfsTaskEvaluation satırı olan kişi
//                    sayısı — bölümün tüm personeli DEĞİL (dokunmamış kişi
//                    paydayı şişirmesin).
//   basariPct      : ornekStatus=BASARILI / değerlendirilmiş satır toplamı.
//   egitimGerekli  : kursiyerDurum=EGITIM_GEREKLI satır sayısı.
//   degerlendirilmisSatir : eğitmen kararı VERİLMİŞ satır (BASARILI veya
//                    TEKRAR_GEREKLI). 0 ise basariPct'nin %0 olması başarısızlık
//                    değil "henüz değerlendirilmedi" demektir — ekran ikisini
//                    ayırabilsin diye döner.
export async function GET() {
  const { session, error } = await requirePermission("akademi.report.view");
  if (error) return error;

  const callerId = await resolveAkademiUserId(session);
  if (!callerId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }

  const perms = await getUserPermissions(callerId);
  const fullScope = perms.has("akademi.admin");
  const ownBolum = fullScope ? null : await resolveUserBolum(callerId);
  const bolums = fullScope
    ? await getLinkedBolums()
    : ownBolum
      ? [ownBolum]
      : [];

  if (bolums.length === 0) {
    return NextResponse.json({ scope: fullScope ? "full" : "own", bolums: [] });
  }

  // IFS kurslarının GOREV içerikleri — değerlendirme satırlarını IFS'e kısıtlar
  // (akademi'de IFS dışı içerik de var).
  const gorevler = await prisma.content.findMany({
    where: { type: "GOREV", isActive: true, course: { isIfs: true } },
    select: { id: true },
  });
  const gorevIds = gorevler.map((g) => g.id);

  const users = await prisma.user.findMany({
    where: { personnel: { bolum: { in: bolums } } },
    select: { id: true, personnel: { select: { bolum: true } } },
  });
  const bolumOf = new Map(
    users.map((u) => [u.id, u.personnel?.bolum ?? ""] as const)
  );

  const rows =
    users.length && gorevIds.length
      ? await prisma.ifsTaskEvaluation.findMany({
          where: {
            userId: { in: users.map((u) => u.id) },
            contentId: { in: gorevIds },
          },
          select: { userId: true, ornekStatus: true, kursiyerDurum: true },
        })
      : [];

  const kisiSet = new Map<string, Set<string>>();
  const degerlendirilen = new Map<string, number>();
  const basarili = new Map<string, number>();
  const egitimGerekli = new Map<string, number>();
  const kararVerilmis = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) =>
    m.set(k, (m.get(k) ?? 0) + 1);

  for (const r of rows) {
    const b = bolumOf.get(r.userId);
    if (!b) continue;
    const s = kisiSet.get(b) ?? new Set<string>();
    s.add(r.userId);
    kisiSet.set(b, s);
    bump(degerlendirilen, b);
    if (r.ornekStatus === "BASARILI") bump(basarili, b);
    if (r.ornekStatus === "BASARILI" || r.ornekStatus === "TEKRAR_GEREKLI")
      bump(kararVerilmis, b);
    if (r.kursiyerDurum === "EGITIM_GEREKLI") bump(egitimGerekli, b);
  }

  const out = bolums.map((b) => {
    const toplam = degerlendirilen.get(b) ?? 0;
    const bas = basarili.get(b) ?? 0;
    return {
      bolum: b,
      egitimAlanKisi: kisiSet.get(b)?.size ?? 0,
      basariPct: toplam > 0 ? Math.round((bas / toplam) * 100) : 0,
      degerlendirilmisSatir: kararVerilmis.get(b) ?? 0,
      egitimGerekli: egitimGerekli.get(b) ?? 0,
    };
  });

  return NextResponse.json({
    scope: fullScope ? "full" : "own",
    bolums: out,
  });
}
