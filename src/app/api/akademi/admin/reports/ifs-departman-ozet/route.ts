import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { canIfsRaporView } from "@/lib/ifs/rapor-erisim";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { getLinkedBolums, resolveUserBolum } from "@/lib/user-personnel";
import { ifsYuzde } from "@/lib/akademi/ifs-progress";

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
//   basariPct      : payda TEK KAYNAK'ta — ifs-progress.ts (ifsYuzde).
//                    FARKLI_DEPARTMAN satırı hem paydadan hem paydan düşer
//                    (kapsam dışı = başarısız DEĞİL); ifs-departman-kisiler ve
//                    ifs-aggregate de aynı kuralı uygular.
//   egitimGerekli  : kursiyerDurum=EGITIM_GEREKLI satır sayısı.
//   degerlendirilmisSatir : eğitmen kararı VERİLMİŞ satır (BASARILI veya
//                    TEKRAR_GEREKLI). 0 ise basariPct'nin %0 olması başarısızlık
//                    değil "henüz değerlendirilmedi" demektir — ekran ikisini
//                    ayırabilsin diye döner.
export async function GET() {
  const { session, userId: oturumUserId, error } = await requireSession();
  if (error) return error;
  if (!(await canIfsRaporView(oturumUserId))) {
    return NextResponse.json({ error: "IFS rapor görüntüleme yetkiniz yok" }, { status: 403 });
  }

  const callerId = await resolveAkademiUserId(session);
  if (!callerId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }

  const perms = await getUserPermissions(callerId);
  // KAPSAM KARARI — burada OR BİLEREK duruyor (guard'larda tek anahtara indirildi).
  // Fark: guard kapıyı kapatır, 403 verir, hemen fark edilir. Kapsam kararı ise
  // sessizce AZ VERİ gösterir — yönetici kendini kendi bölümüne daraltılmış bulur
  // ve bunu kimse hata olarak bildirmez. Eski anahtarı burada bırakmak kimseyi
  // içeri ALMAZ (guard zaten ifs.* istiyor); yalnız geçiş döneminde yanlış
  // daraltmayı önler.
  const fullScope = perms.has("ifs.admin") || perms.has("akademi.admin");
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
  const farkliDepartman = new Map<string, number>();
  const basariliVeFarkli = new Map<string, number>();
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
    if (r.kursiyerDurum === "FARKLI_DEPARTMAN") {
      bump(farkliDepartman, b);
      if (r.ornekStatus === "BASARILI") bump(basariliVeFarkli, b);
    }
  }

  const out = bolums.map((b) => {
    const toplam = degerlendirilen.get(b) ?? 0;
    const bas = basarili.get(b) ?? 0;
    return {
      bolum: b,
      egitimAlanKisi: kisiSet.get(b)?.size ?? 0,
      basariPct: ifsYuzde(
        Math.max(bas - (basariliVeFarkli.get(b) ?? 0), 0),
        toplam,
        farkliDepartman.get(b) ?? 0
      ),
      degerlendirilmisSatir: kararVerilmis.get(b) ?? 0,
      egitimGerekli: egitimGerekli.get(b) ?? 0,
    };
  });

  return NextResponse.json({
    scope: fullScope ? "full" : "own",
    bolums: out,
  });
}
