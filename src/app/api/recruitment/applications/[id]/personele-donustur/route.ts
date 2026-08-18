import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import {
  YakaRengi,
  YakaDetayi,
  DirektEndirekt,
  AsansorMekanik,
  Gender,
} from "@/generated/prisma";
import {
  personeleDonustur,
  otomatikAlanlar,
  egitimCoz,
  tcKontrol,
  baglamaUygunMu,
  mevcutKaydaBagla,
  DonusumError,
  type BasvuruKaynak,
} from "@/lib/recruitment/personele-donustur";
import { donusturEngeli } from "@/lib/recruitment/personele-donustur-bayrak";

export const dynamic = "force-dynamic";

// Faz 6 — "Personele Dönüştür" ucu.
//
// GET  : form ÖN-DOLU verisi (otomatik 13 alan önizlemesi + bölüm listesi/hiyerarşisi + TC kontrolü)
// POST : dönüşümü uygular (tek transaction — personele-donustur.ts)
//
// Middleware /api/* KAPSAMAZ → guard route içinde (mevcut desen).
// Yetki: YALNIZ İK (recruitment.admin / hr.admin) — yeni yetki anahtarı UYDURULMADI.

const BASVURU_SELECT = {
  id: true,
  applicationNumber: true,
  status: true,
  fullName: true,
  gender: true,
  bloodType: true,
  email: true,
  mobilePhone: true,
  homeAddress: true,
  tcKimlikNo: true,
  birthDate: true,
  educationLevel: true,
  educationHistory: true,
  shoeSize: true,
  clothingSizeUpper: true,
  clothingSizeLower: true,
  requestedPosition: true,
  availableStartDate: true,
} as const;

function ikMi(permissions: string[] | undefined): boolean {
  const p = permissions ?? [];
  return p.includes("recruitment.admin") || p.includes("hr.admin");
}

function ip(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    null
  );
}

/** Bölüm listesi + her bölümün hiyerarşi adları (FK'dan — serbest metin DEĞİL).
 *  N+1 yok: bölümler ve koltuk sahipleri ikişer sorguda çözülür. */
async function bolumSecenekleri() {
  const depts = await prisma.departmentDefinition.findMany({
    where: { isActive: true },
    select: {
      name: true,
      mudurId: true,
      sorumlu1Id: true,
      sorumlu2Id: true,
      sorumlu3Id: true,
    },
    orderBy: { name: "asc" },
  });
  const pidler = [
    ...new Set(
      depts
        .flatMap((d) => [d.mudurId, d.sorumlu1Id, d.sorumlu2Id, d.sorumlu3Id])
        .filter((x): x is string => !!x),
    ),
  ];
  const kisiler = pidler.length
    ? await prisma.personnel.findMany({
        where: { id: { in: pidler } },
        select: { id: true, adSoyad: true, aktif: true },
      })
    : [];
  const adById = new Map(kisiler.map((p) => [p.id, p]));
  const ad = (id: string | null) => {
    if (!id) return null;
    const p = adById.get(id);
    // Pasif koltuk sahibi adı YİNE de gösterilir (kaynak FK) — keşifteki "V." önekli
    // elle yazım sorunu tekrarlamasın; pasif olduğu ayrıca işaretlenir.
    return p ? p.adSoyad : null;
  };
  return depts.map((d) => ({
    name: d.name,
    hiyerarsi: {
      bolumMuduru: ad(d.mudurId),
      birimSorumlusu: ad(d.sorumlu1Id),
      sorumlu2: ad(d.sorumlu2Id),
      sorumlu3: ad(d.sorumlu3Id),
    },
    pasifKoltuk: [d.mudurId, d.sorumlu1Id, d.sorumlu2Id, d.sorumlu3Id]
      .filter((x): x is string => !!x)
      .some((x) => adById.get(x)?.aktif === false),
  }));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!ikMi(session.user.permissions)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  }
  // Bayrak kapalıysa uç TAMAMEN kapalı (403: yetki değil, ÖZELLİK kapalı).
  const engel = donusturEngeli(null, true);
  if (engel) return NextResponse.json({ error: engel }, { status: 403 });

  const { id } = await params;
  const app = await prisma.publicJobApplication.findUnique({
    where: { id },
    select: BASVURU_SELECT,
  });
  if (!app) return NextResponse.json({ error: "Başvuru bulunamadı" }, { status: 404 });

  const kaynak = app as unknown as BasvuruKaynak;
  const oto = otomatikAlanlar(kaynak);
  const egitim = egitimCoz(app.educationHistory, app.educationLevel);
  const tc = await tcKontrol(prisma, oto.tcKimlikNo);

  // Mükerrer TC + AKTİF personel → "mevcut kayda bağla ve kapat" mümkün mü? Kural TEK
  // KAYNAK (baglamaUygunMu); ekran yalnız bu bayrağa bakar, kendi kuralını yürütmez.
  if (tc.durum === "AKTIF_VAR") {
    const p = await prisma.personnel.findUnique({
      where: { id: tc.personnelId },
      select: { aktif: true, jobApplicationId: true, adSoyad: true },
    });
    const u = p
      ? baglamaUygunMu({
          basvuruStatus: app.status,
          personelAktif: p.aktif,
          personelJobApplicationId: p.jobApplicationId,
          personelAdSoyad: p.adSoyad,
          basvuruAdSoyad: app.fullName,
        })
      : ({ uygun: false, sebep: "Personel kaydı bulunamadı" } as const);
    tc.baglanabilir = u.uygun;
    if (!u.uygun) tc.baglanamamaSebebi = u.sebep;
  }

  return NextResponse.json({
    basvuru: {
      id: app.id,
      applicationNumber: app.applicationNumber,
      status: app.status,
      fullName: app.fullName,
    },
    // ÖN-DOLU: İV bunları düzeltebilir.
    onDolu: {
      gorev: app.requestedPosition ?? "",
      iseGirisTarihi: app.availableStartDate
        ? app.availableStartDate.toISOString().slice(0, 10)
        : "",
      egitimYeri: oto.egitimYeri,
      egitimAlani: oto.egitimAlani,
      mezuniyetYili: oto.mezuniyetYili,
      // Başvuruda cinsiyet yoksa form bunu ZORUNLU alan olarak gösterir.
      cinsiyetEksik: oto.cinsiyet === null,
    },
    // ÖNİZLEME: otomatik aktarılacak alanlar. TC MASKELİ — ekranda tam TC gösterilmez.
    otomatik: {
      adSoyad: oto.adSoyad,
      cinsiyet: oto.cinsiyet,
      kanGrubu: oto.kanGrubu,
      mailAdresi: oto.mailAdresi,
      telefon: oto.telefon,
      ikametAdresi: oto.ikametAdresi,
      tcKimlikNoMaskeli: oto.tcKimlikNo
        ? `${oto.tcKimlikNo.slice(0, 3)}${"*".repeat(Math.max(0, oto.tcKimlikNo.length - 5))}${oto.tcKimlikNo.slice(-2)}`
        : null,
      dogumTarihi: oto.dogumTarihi,
      egitimTipi: oto.egitimTipi,
      egitimYeri: oto.egitimYeri,
      egitimAlani: oto.egitimAlani,
      mezuniyetYili: oto.mezuniyetYili,
      egitimKaynagi: egitim.kaynak,
      beden: oto.beden,
    },
    bolumler: await bolumSecenekleri(),
    tcKontrol: tc,
  });
}

const BodySchema = z.object({
  sicilNo: z.string().trim().min(1).max(40),
  yakaRengi: z.nativeEnum(YakaRengi),
  bolum: z.string().trim().min(1),
  gorev: z.string().trim().min(1).max(200),
  iseGirisTarihi: z.string().trim().min(4),
  direktEndirekt: z.nativeEnum(DirektEndirekt),
  // Başvuruda cinsiyet boşsa İV seçer (Personnel.cinsiyet zorunlu).
  cinsiyet: z.nativeEnum(Gender).nullish(),
  // Opsiyoneller
  yakaDetayi: z.nativeEnum(YakaDetayi).nullish(),
  sinif: z.string().trim().max(100).nullish(),
  masrafMerkezi: z.string().trim().max(100).nullish(),
  asansorMekanik: z.nativeEnum(AsansorMekanik).nullish(),
  bolumDetay: z.string().trim().max(200).nullish(),
  // İV düzeltmesi (eğitim satırı yanlış kademeden gelmiş olabilir)
  egitimYeri: z.string().trim().max(200).nullish(),
  egitimAlani: z.string().trim().max(200).nullish(),
  mezuniyetYili: z.number().int().min(1900).max(2100).nullish(),
  // Karar: yeni kart mı, mevcut PASİF karta bağlanma mı
  hedefPersonnelId: z.string().trim().min(1).nullish(),
  mukerrerOnaylandi: z.boolean().optional(),
});

/** "Mevcut kayda bağla ve kapat" gövdesi — dönüşüm alanlarının HİÇBİRİ istenmez;
 *  yeni kayıt açılmadığı için sicil/yaka/bölüm gibi girdilerin anlamı yok. */
const BaglaSchema = z.object({
  islem: z.literal("MEVCUDA_BAGLA"),
  personnelId: z.string().trim().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!ikMi(session.user.permissions)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  }
  const engel = donusturEngeli(null, true);
  if (engel) return NextResponse.json({ error: engel }, { status: 403 });

  const { id } = await params;
  const ham = await request.json().catch(() => null);

  // ── ÜÇÜNCÜ YOL: mevcut (AKTİF) personel kaydına bağla ve başvuruyu kapat ──
  // Ayrı şema: dönüşüm alanları beklenmez. Guard'lar mevcutKaydaBagla içinde, TEK
  // TRANSACTION'da ve tx İÇİNDE tekrar doğrulanır.
  const baglaParsed = BaglaSchema.safeParse(ham);
  if (baglaParsed.success) {
    try {
      const sonuc = await mevcutKaydaBagla({
        prisma,
        applicationId: id,
        personnelId: baglaParsed.data.personnelId,
        // Oturum VAR: sabit sentinel değil, işlemi yapan kullanıcı yazılır.
        actorId: session.user.id,
      });
      return NextResponse.json(sonuc, { status: 200 });
    } catch (err) {
      if (err instanceof DonusumError) {
        return NextResponse.json({ error: err.message, kod: err.kod }, { status: err.httpStatus });
      }
      console.error("[personele-donustur] baglama basarisiz:", err);
      return NextResponse.json({ error: "Bağlama sırasında hata oluştu" }, { status: 500 });
    }
  }

  const parsed = BodySchema.safeParse(ham);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz istek gövdesi", detay: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const b = parsed.data;

  const app = await prisma.publicJobApplication.findUnique({
    where: { id },
    select: BASVURU_SELECT,
  });
  if (!app) return NextResponse.json({ error: "Başvuru bulunamadı" }, { status: 404 });

  // Bölüm SEÇİM listesinden gelmeli — serbest metin kabul edilmez (isim eşleşmesi bozulmasın).
  const dept = await prisma.departmentDefinition.findFirst({
    where: { name: b.bolum, isActive: true },
    select: { name: true, mudurId: true, sorumlu1Id: true, sorumlu2Id: true, sorumlu3Id: true },
  });
  if (!dept) {
    return NextResponse.json(
      { error: `Bölüm listede yok veya pasif: ${b.bolum}` },
      { status: 400 },
    );
  }

  // Hiyerarşi adları FK'dan çözülür — istemciden gelen ad KULLANILMAZ.
  const pidler = [dept.mudurId, dept.sorumlu1Id, dept.sorumlu2Id, dept.sorumlu3Id].filter(
    (x): x is string => !!x,
  );
  const kisiler = pidler.length
    ? await prisma.personnel.findMany({
        where: { id: { in: pidler } },
        select: { id: true, adSoyad: true },
      })
    : [];
  const adById = new Map(kisiler.map((p) => [p.id, p.adSoyad]));
  const hiyerarsi = {
    bolumMuduru: dept.mudurId ? (adById.get(dept.mudurId) ?? null) : null,
    birimSorumlusu: dept.sorumlu1Id ? (adById.get(dept.sorumlu1Id) ?? null) : null,
    sorumlu2: dept.sorumlu2Id ? (adById.get(dept.sorumlu2Id) ?? null) : null,
    sorumlu3: dept.sorumlu3Id ? (adById.get(dept.sorumlu3Id) ?? null) : null,
  };

  try {
    const sonuc = await personeleDonustur({
      prisma,
      app: app as unknown as BasvuruKaynak,
      girdi: {
        sicilNo: b.sicilNo,
        yakaRengi: b.yakaRengi,
        bolum: dept.name,
        gorev: b.gorev,
        iseGirisTarihi: b.iseGirisTarihi,
        direktEndirekt: b.direktEndirekt,
        cinsiyet: b.cinsiyet ?? null,
        yakaDetayi: b.yakaDetayi ?? null,
        sinif: b.sinif ?? null,
        masrafMerkezi: b.masrafMerkezi ?? null,
        asansorMekanik: b.asansorMekanik ?? null,
        bolumDetay: b.bolumDetay ?? null,
        ...(b.egitimYeri !== undefined ? { egitimYeri: b.egitimYeri ?? null } : {}),
        ...(b.egitimAlani !== undefined ? { egitimAlani: b.egitimAlani ?? null } : {}),
        ...(b.mezuniyetYili !== undefined ? { mezuniyetYili: b.mezuniyetYili ?? null } : {}),
        mukerrerOnaylandi: b.mukerrerOnaylandi,
      },
      karar: b.hedefPersonnelId
        ? { tip: "MEVCUDA_BAGLA", personnelId: b.hedefPersonnelId }
        : { tip: "YENI" },
      actorId: session.user.id,
      ipAddress: ip(request),
      hiyerarsi,
    });
    return NextResponse.json(sonuc, { status: 200 });
  } catch (err) {
    if (err instanceof DonusumError) {
      return NextResponse.json({ error: err.message, kod: err.kod }, { status: err.httpStatus });
    }
    console.error("[personele-donustur] basarisiz:", err);
    return NextResponse.json({ error: "Dönüşüm sırasında hata oluştu" }, { status: 500 });
  }
}
