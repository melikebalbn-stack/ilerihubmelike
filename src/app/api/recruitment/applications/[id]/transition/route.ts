import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { JobApplicationStatus } from "@/generated/prisma";
import {
  allowedTargetsForRoles,
  canTransitionAny,
  requiresAssignedManager,
  requiresRejectionReason,
  requiresAssessment,
  roluKademedeMi,
  sadeceFormlaMi,
} from "@/lib/recruitment/transitions";
import { resolveTransitionRolesFull } from "@/lib/recruitment/resolve-roles";
import { transitionApplicationStatus } from "@/lib/recruitment/stage-log";
import { AssessmentSessionError } from "@/lib/recruitment/assessment-session";
import {
  otomatikAtamaliMi,
  otomatikAtananKullanici,
  OtomatikAtamaError,
} from "@/lib/recruitment/otomatik-atama";
import {
  bayragaGoreSuz,
  geriGondermeEngeli,
  geriGondermeNotu,
} from "@/lib/recruitment/adaya-geri-gonder";
import {
  ikiKademeSuz,
  ikiKademeEngeli,
} from "@/lib/recruitment/teknik-mulakat-bayrak";
import { ustAmirCoz, TEKNIK_MULAKAT_CHAIN } from "@/lib/recruitment/teknik-mulakat-zinciri";
import { donusturSuz, donusturEngeli } from "@/lib/recruitment/personele-donustur-bayrak";

export const dynamic = "force-dynamic";

// NOT (middleware raporu): src/middleware.ts matcher'ı /api/* KAPSAMAZ (yalnız sayfa
// route'ları: /dashboard, /personnel, /envanter ...). Bu yüzden API auth'u route içinde
// yapılır — requireSession aşağıda oturumu zorunlu kılar. Bilinçli/gerekli guard.

const BodySchema = z.object({
  toStatus: z.nativeEnum(JobApplicationStatus),
  note: z.string().trim().max(2000).optional(),
  assignedManagerId: z.string().trim().min(1).optional(),
  rejectionReasonId: z.string().trim().min(1).optional(),
  assessmentId: z.string().trim().min(1).optional(),
  // Faz 1 — ADAYA_GERI_GONDERILDI hedefinde İK'nın işaretlediği alanlar. Alan ADLARI gelir;
  // etikete çevirme ve beyaz liste süzmesi SUNUCUDA (adaya-geri-gonder.ts). Client'tan gelen
  // liste doğrudan not'a yazılmaz — beyaz liste dışı ad sessizce düşer.
  duzeltilecekAlanlar: z.array(z.string().trim().min(1)).max(60).optional(),
  // Faz 4 — teknik mülakat kademe kararı. OLUMSUZ görüşte yorum ZORUNLU (aşağıda guard).
  kademeYorumu: z.string().trim().max(2000).optional(),
  // 2026-08 — müdür kademesi kararı. Müdürden YALNIZ iki sonuç çıkar ve İKİSİ DE
  // REVIEWING'e döner; hedef statü ayırt etmediği için karar AÇIKÇA gelir.
  mudurKarari: z.enum(["APPROVED", "REJECTED"]).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1) Oturum
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;

  // Body doğrula
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz istek gövdesi", detay: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { toStatus, note, assignedManagerId, rejectionReasonId, assessmentId, duzeltilecekAlanlar, kademeYorumu, mudurKarari } =
    parsed.data;

  // 2) Başvuruyu çek
  const application = await prisma.publicJobApplication.findUnique({
    where: { id },
    select: { id: true, status: true, assignedManagerId: true, fullName: true },
  });
  if (!application) {
    return NextResponse.json({ error: "Başvuru bulunamadı" }, { status: 404 });
  }

  // 3) Rol(ler): kullanıcı BİRDEN ÇOK role sahip olabilir (hem İK hem atanan müdür).
  //    Rol belirleme TEK KAYNAK'tan (resolve-roles) — stage-log route'u da aynısını kullanır.
  //    Full sürüm: izin/atama tabanlı rollere ek olarak DEPARTMAN tabanlı zincir rollerini
  //    (URETIM_MUDUR_YRD, FABRIKA_MUDURU) de çözer.
  const roles = await resolveTransitionRolesFull({
    permissions: session.user.permissions,
    userId: session.user.id,
    assignedManagerId: application.assignedManagerId,
    // Faz 4: TEKNIK_MULAKATCI / TEKNIK_UST_AMIR rolleri bekleyen approval satırından çözülür.
    applicationId: id,
  });
  if (roles.length === 0) {
    return NextResponse.json(
      { error: "Bu başvuru için geçiş yetkiniz yok" },
      { status: 403 },
    );
  }

  const current = application.status;

  // 4) İzin matrisi — rollerin BİRLEŞİK (union) izinli hedefleri. Otorite transitions.ts'te.
  if (!canTransitionAny(current, toStatus, roles)) {
    return NextResponse.json(
      {
        error: "Bu geçişe izin yok",
        from: current,
        to: toStatus,
        roles,
        allowedTargets: donusturSuz(ikiKademeSuz(bayragaGoreSuz(allowedTargetsForRoles(current, roles)))),
      },
      { status: 400 },
    );
  }

  // 4b) Faz 1 KILL SWITCH — matris izin verse bile bayrak kapalıysa ADAYA_GERI_GONDERILDI'ya
  //     geçilemez. UI'da buton zaten çizilmez (stage-log ucu hedefi süzüyor); bu, doğrudan
  //     API çağrısına karşı sunucu-taraflı kapı. 403: yetki değil, ÖZELLİK kapalı.
  //     Gerekçe (blue-green rollback penceresi) → adaya-geri-gonder.ts.
  const bayrakEngeli = geriGondermeEngeli(toStatus);
  if (bayrakEngeli) {
    return NextResponse.json({ error: bayrakEngeli }, { status: 403 });
  }

  // 4c) FAZ 4 KILL SWITCH — aynı desen, TEKNIK_MULAKAT_UST_ONAY için.
  const ikiKademeEngel = ikiKademeEngeli(toStatus);
  if (ikiKademeEngel) {
    return NextResponse.json({ error: ikiKademeEngel }, { status: 403 });
  }

  // 4d) FAZ 6 KILL SWITCH — aynı desen, EVRAK_HAZIRLIK için.
  const donusturEngel = donusturEngeli(toStatus);
  if (donusturEngel) {
    return NextResponse.json({ error: donusturEngel }, { status: 403 });
  }

  // 4e) FAZ 6 — ISE_BASLADI bu uçtan GEÇİLEMEZ. Matriste satırı vardır (yetkiyi matris
  //     tanımlar) ama işbaşı, personel kaydı oluşturulmadan işaretlenemez: dönüşüm ve statü
  //     AYNI transaction'da yazılır (personele-donustur.ts). Bayraktan BAĞIMSIZ kural.
  if (sadeceFormlaMi(toStatus)) {
    return NextResponse.json(
      {
        error:
          "İşe başladı işaretlemesi yalnız 'Personele Dönüştür' formuyla yapılır (personel kaydı ile aynı işlemde).",
        kod: "DONUSUM_FORMU_GEREKLI",
      },
      { status: 400 },
    );
  }

  // 5) Atama gerektiren hedefler — İK'nın seçtiği (requiresAssignedManager) vs sistemin
  //    atadığı (otomatikAtamaliMi) ayrımı. İkisi ASLA aynı hedefte olmaz.
  //
  // 5a) OTOMATİK atama: hedef zincir kademesiyse kişiyi sistem belirler; istemciden gelen
  //     assignedManagerId YOK SAYILIR (İK araya girmesin). Çözülemezse 400 — sessizce
  //     atamasız geçiş YAPILMAZ.
  let otomatikAtanan: { userId: string; ad: string | null } | null = null;
  if (otomatikAtamaliMi(toStatus)) {
    try {
      // TEKNIK_MULAKAT_UST_ONAY bu tabloda YOK (zincirden çözülür) → null döner,
      // aşağıdaki Faz 4 bloğu devralır. Mavi yaka kademeleri eskisi gibi çalışır.
      otomatikAtanan = await otomatikAtananKullanici(toStatus);
    } catch (err) {
      if (err instanceof OtomatikAtamaError) {
        return NextResponse.json({ error: err.message }, { status: err.httpStatus });
      }
      throw err;
    }
  }

  // ── FAZ 4: TEKNİK MÜLAKAT İKİ KADEME ────────────────────────────────────────
  // PER-STEP GUARD (personnel-requests/[id]/route.ts:203-206 deseni):
  // Bir kademenin geçişini YALNIZ o kademenin bekleyen onaycısı yapabilir. Rol zaten
  // approval satırından çözülüyor (resolve-roles), ama İK aynı hedefe matristen de
  // gidebildiği için burada AÇIKÇA doğruluyoruz: TEKNIK_MULAKATCI/TEKNIK_UST_AMIR
  // rolüyle gelen kişi gerçekten SIRADAKİ adımın onaycısı mı?
  const teknikKademeKarari =
    (roles.includes("TEKNIK_MULAKATCI") && current === "TEKNIK_MULAKAT") ||
    (roles.includes("TEKNIK_UST_AMIR") && current === "TEKNIK_MULAKAT_UST_ONAY");

  // İV OVERRIDE: İK, 1. kademeyi ATLAYARAK doğrudan 2. kademeye geçiriyor.
  // (Matriste İK'nın TEKNIK_MULAKAT → TEKNIK_MULAKAT_UST_ONAY yolu var.) Bu durumda
  // mülakatçı görüşü ALINMAMIŞTIR — satır "Bekliyor" kalmamalı, ama İK mülakatçı adına
  // APPROVED da yazmamalı. FORWARDED ("bir sonraki aşamaya iletildi") tam bu anlam;
  // ApprovalDecision enum'unda ZATEN VAR, migration gerekmiyor.
  const ivAtlamasi =
    !teknikKademeKarari &&
    current === "TEKNIK_MULAKAT" &&
    toStatus === "TEKNIK_MULAKAT_UST_ONAY";

  // ── FAZ 5: MÜDÜR DEĞERLENDİRMESİ ───────────────────────────────────────────
  // Atanan müdür artık REJECTED VEREMEZ (matris satırından çıkarıldı); olumsuz görüşünü
  // REVIEWING'e dönerek bildirir. "Müdür kademesindeyiz" bilgisi matristen TÜRETİLİR
  // (roluKademedeMi) — sabit statü listesi gömülmez.
  //
  // Kullanıcı hem İK hem atanan müdür olabilir: bu durumda da yorum istenir. Bilinçli —
  // rol birleşimi geçiş HAKKINI genişletir, ama kararı veren yine atanan kişidir.
  const mudurKademesinde = roles.includes("MUDUR") && roluKademedeMi(current, "MUDUR");

  // 2026-08 — müdür kademesinde İKİ karar da REVIEWING'e döner; hedef statü artık
  // olumlu/olumsuz ayrımını taşımıyor. Bu yüzden karar AÇIKÇA istenir.
  if (mudurKademesinde && toStatus === "REVIEWING" && !mudurKarari) {
    return NextResponse.json(
      { error: "Müdür kararı zorunlu (olumlu/olumsuz)" },
      { status: 400 },
    );
  }

  // OLUMSUZ görüş = kademeden REVIEWING'e dönüş. Yorum ZORUNLU (İV neden döndüğünü görsün).
  // Teknik mülakat (Faz 4) ve müdür (Faz 5) kademeleri AYNI kuralı paylaşır.
  const teknikOlumsuz = teknikKademeKarari && toStatus === "REVIEWING";
  const mudurOlumsuz = mudurKademesinde && toStatus === "REVIEWING" && mudurKarari === "REJECTED";
  const olumsuzGorus = teknikOlumsuz || mudurOlumsuz;
  if (olumsuzGorus && !kademeYorumu) {
    return NextResponse.json(
      { error: "Olumsuz görüş için yorum zorunludur" },
      { status: 400 },
    );
  }

  // 1. kademe OLUMLU → üst amiri ÇÖZ. Çözülemezse geçiş BLOKE (sessiz geçme YOK).
  // Üst amir seçilen kişinin kendisiyse kademe ATLANIR → hedef REVIEWING'e çevrilir.
  let ustAmir: { approverId: string; ad: string; unvan: string; yol: string } | null = null;
  let kademeAtlandi: string | null = null;
  let efektifToStatus: JobApplicationStatus = toStatus;

  if (toStatus === "TEKNIK_MULAKAT_UST_ONAY") {
    // Üst amir, 1. kademenin ONAYCISININ bölümünden çözülür (başvurunun değil).
    const birinci = await prisma.publicJobApplicationApproval.findUnique({
      where: { applicationId_step: { applicationId: id, step: 1 } },
      select: { approverId: true },
    });
    const mulakatciId = birinci?.approverId ?? application.assignedManagerId;
    if (!mulakatciId) {
      return NextResponse.json(
        { error: "1. kademe mülakatçısı bulunamadı — üst amir zinciri kurulamıyor." },
        { status: 400 },
      );
    }
    const sonuc = await ustAmirCoz(prisma, mulakatciId);
    if (!sonuc.ok) {
      return NextResponse.json({ error: sonuc.error }, { status: 400 });
    }
    if (sonuc.atlandi) {
      // 2. kademe ATLANIR: karar İV'ye döner. Statü REVIEWING olur.
      kademeAtlandi = sonuc.sebep;
      efektifToStatus = "REVIEWING";
    } else {
      ustAmir = {
        approverId: sonuc.approverId,
        ad: sonuc.ad,
        unvan: sonuc.unvan,
        yol: sonuc.yol,
      };
      otomatikAtanan = { userId: sonuc.approverId, ad: sonuc.ad };
    }
  }

  // 5b) İK'nın kişi seçtiği hedefler (MUDUR_DEGERLENDIRME / DEGERLENDIRICI).
  //     (mevcut atama varsa ve yeni verilmediyse onu kullan; ikisi de yoksa 400.)
  const efektifManagerId = assignedManagerId ?? application.assignedManagerId ?? null;
  if (requiresAssignedManager(toStatus) && !efektifManagerId) {
    return NextResponse.json(
      { error: `${toStatus} için assignedManagerId zorunludur` },
      { status: 400 },
    );
  }

  // Devir izi: StageLog'da atama ALANI yok (yalnız from/to/changedBy/note). Otomatik devirde
  // assignedManagerId ÜZERİNE YAZILDIĞI için, kime devredildiği not'a yazılmazsa iz kaybolur.
  // Ayrılan taraf zaten changedBy olarak kayıtlı; burada devralan tarafı ekliyoruz.
  //
  // ADAYA_GERI_GONDERILDI: not FORMATLI kurulur — "Eksik alanlar: <etiket...> | <İK notu>".
  // Solu adaya gider (yalnız etiket), sağı İK iç notudur. Biçim TEK KAYNAK
  // (adaya-geri-gonder.ts); public uç aynı modülle geri ayrıştırır.
  // FAZ 4/5 not parçaları — mevcut " | " ayraçlı zenginleştirme deseni.
  const kademeNotParcalari: string[] = [];
  if (teknikOlumsuz) {
    const kademeAdi = current === "TEKNIK_MULAKAT" ? "1. kademe" : "2. kademe";
    kademeNotParcalari.push(`Teknik mülakat ${kademeAdi} olumsuz: ${kademeYorumu}`);
  } else if (teknikKademeKarari && kademeYorumu) {
    const kademeAdi = current === "TEKNIK_MULAKAT" ? "1. kademe" : "2. kademe";
    kademeNotParcalari.push(`Teknik mülakat ${kademeAdi} olumlu: ${kademeYorumu}`);
  }
  // FAZ 5 — müdür görüşü. Hangi müdür statüsünden dönüldüğü StageLog.fromStatus'ta zaten
  // kayıtlı; not tek biçimli kalsın diye kademe adı ayrıca yazılmaz.
  if (mudurOlumsuz) {
    kademeNotParcalari.push(`Müdür değerlendirmesi olumsuz: ${kademeYorumu}`);
  } else if (mudurKademesinde && mudurKarari === "APPROVED") {
    kademeNotParcalari.push(
      kademeYorumu
        ? `Müdür değerlendirmesi olumlu: ${kademeYorumu}`
        : "Müdür değerlendirmesi olumlu",
    );
  }
  if (ivAtlamasi) {
    kademeNotParcalari.push("1. kademe İV tarafından atlandı — mülakatçı görüşü alınmadı");
  }
  if (kademeAtlandi) kademeNotParcalari.push(`2. kademe atlandı: ${kademeAtlandi}`);
  if (ustAmir) {
    kademeNotParcalari.push(
      `Üst amire atandı: ${ustAmir.ad} (${ustAmir.yol === "MUDUR_YRD" ? "müdür yardımcısı" : "müdür"})`,
    );
  }

  const efektifNote =
    toStatus === "ADAYA_GERI_GONDERILDI"
      ? geriGondermeNotu({ alanlar: duzeltilecekAlanlar ?? [], ikNotu: note ?? null }) || null
      : kademeNotParcalari.length > 0
        ? [note, ...kademeNotParcalari].filter(Boolean).join(" | ")
        : otomatikAtanan
          ? [note, `Otomatik atandı: ${otomatikAtanan.ad ?? otomatikAtanan.userId}`]
              .filter(Boolean)
              .join(" | ")
          : (note ?? null);

  // 5c) REJECTED → ret nedeni zorunlu (kök-neden analizi). Sunucu-taraflı guard; UI disabled tek
  //     başına yeterli değil. requiresRejectionReason TEK KAYNAK (transitions.ts).
  if (requiresRejectionReason(toStatus) && !rejectionReasonId) {
    return NextResponse.json({ error: "Ret nedeni zorunlu" }, { status: 400 });
  }

  // 5d) SINAV → sınav seçimi zorunlu (geçişle aynı anda oturum açılır). Sunucu-taraflı guard.
  //     requiresAssessment TEK KAYNAK (transitions.ts).
  if (requiresAssessment(toStatus) && !assessmentId) {
    return NextResponse.json({ error: "Sınav seçimi zorunlu" }, { status: 400 });
  }

  // 6) Geçiş (tx + commit sonrası bildirim, stage-log wrapper'ında)
  //    efektifToStatus: 2. kademe ATLANDIYSA hedef REVIEWING'e çevrilmiştir.
  try {
    const updated = await transitionApplicationStatus({
      applicationId: id,
      toStatus: efektifToStatus,
      note: efektifNote,
      changedBy: session.user.id,
      // Otomatik kademede sistem atar; diğerlerinde yalnız yeni atama verildiyse yaz
      // (verilmediyse mevcut korunur).
      assignedManagerId: otomatikAtanan?.userId ?? assignedManagerId ?? undefined,
      actorName: session.user.name ?? null,
      // REJECTED'da guard'dan geçti; helper AYNI tx'te rejectionReasonId yazar + note'a etiket ekler.
      rejectionReasonId: rejectionReasonId ?? undefined,
      // SINAV'da guard'dan geçti; helper AYNI tx'te AssessmentSession açar + note'a sınav adı ekler.
      assessmentId: assessmentId ?? undefined,
      // 2026-08 — müdür kararı statüyle AYNI tx'te yazılır (karar + gerekçe + kim + ne zaman).
      mudurKarari: mudurKademesinde ? (mudurKarari ?? undefined) : undefined,
      mudurKarariNotu: mudurKademesinde ? (kademeYorumu ?? undefined) : undefined,
    });

    // 7) FAZ 4 — approval satırları. Geçiş COMMIT olduktan SONRA yazılır: satır yazımı
    //    başarısız olsa bile statü geçişi kalıcıdır (kadro talebindeki gibi zincir
    //    kaydı ayrı adımdır). Hata sessizce yutulmaz, loglanır.
    try {
      // (a) Karar veren kademe varsa satırına decision + comment + decidedAt yaz.
      if (teknikKademeKarari) {
        const step = current === "TEKNIK_MULAKAT" ? 1 : 2;
        await prisma.publicJobApplicationApproval.updateMany({
          where: { applicationId: id, step, decision: null },
          data: {
            decision: teknikOlumsuz ? "REJECTED" : "APPROVED",
            comment: kademeYorumu ?? null,
            decidedAt: new Date(),
          },
        });
      }

      // (a2) İV OVERRIDE — step 1 bekleyen satırı FORWARDED ile işaretlenir.
      //      approverId DEĞİŞMEZ (seçilen mülakatçı kayıtta kalır); yalnız kararın
      //      alınmadığı, İV'nin ilettiği bilgisi yazılır. Mülakatçı adına APPROVED YAZILMAZ.
      if (ivAtlamasi) {
        await prisma.publicJobApplicationApproval.updateMany({
          where: { applicationId: id, step: 1, decision: null },
          data: {
            decision: "FORWARDED",
            comment: "İV tarafından atlandı — mülakatçı görüşü alınmadı",
            decidedAt: new Date(),
          },
        });
      }

      // (b) İK 1. kademeyi başlatıyor (TEKNIK_MULAKAT'a geçiş) → step 1 satırını aç/güncelle.
      //     upsert: aynı başvuruda mülakatçı DEĞİŞTİRİLEBİLİR (İK yeniden atama yolu).
      if (efektifToStatus === "TEKNIK_MULAKAT" && efektifManagerId) {
        const u = await prisma.user.findUnique({
          where: { id: efektifManagerId },
          select: { jobTitle: true },
        });
        await prisma.publicJobApplicationApproval.upsert({
          where: { applicationId_step: { applicationId: id, step: 1 } },
          create: {
            applicationId: id,
            step: 1,
            kademe: TEKNIK_MULAKAT_CHAIN[0].kademe,
            role: u?.jobTitle ?? TEKNIK_MULAKAT_CHAIN[0].label,
            approverId: efektifManagerId,
          },
          // Yeniden atama: karar sıfırlanır (yeni mülakatçı kendi kararını verir).
          update: {
            approverId: efektifManagerId,
            role: u?.jobTitle ?? TEKNIK_MULAKAT_CHAIN[0].label,
            decision: null,
            comment: null,
            decidedAt: null,
          },
        });
      }

      // (c) 2. kademe açıldıysa satırını oluştur (üst amir çözülmüş demektir).
      if (efektifToStatus === "TEKNIK_MULAKAT_UST_ONAY" && ustAmir) {
        await prisma.publicJobApplicationApproval.upsert({
          where: { applicationId_step: { applicationId: id, step: 2 } },
          create: {
            applicationId: id,
            step: 2,
            kademe: TEKNIK_MULAKAT_CHAIN[1].kademe,
            role: ustAmir.unvan,
            approverId: ustAmir.approverId,
          },
          update: {
            approverId: ustAmir.approverId,
            role: ustAmir.unvan,
            decision: null,
            comment: null,
            decidedAt: null,
          },
        });
      }
    } catch (err) {
      console.error("[teknik-mulakat] approval satiri yazilamadi (gecis kalici):", err);
    }

    // 8) Güncel kayıt + kademe atlandıysa UI'ın gösterebilmesi için bilgi.
    //
    // SAF MÜDÜR KISITI (2026-08): `updated` HAM kayıttır (Prisma update, select yok) —
    // notes/tcKimlikNo/rejectionReasonId dahil HER alanı taşır. Müdür kendi kararını
    // gönderdiğinde bu yanıt, detay ucundaki MANAGER_SELECT'i baypas ediyordu.
    // İK yolunda gövde AYNEN eskisi gibi döner. Tek çağıran (detay ekranı) başarı
    // gövdesini okumuyor (yalnız res.ok'a bakıp yeniden çekiyor), bu yüzden kısıt
    // hiçbir akışı bozmaz.
    const govde = roles.includes("IK")
      ? updated
      : {
          id: updated.id,
          applicationNumber: updated.applicationNumber,
          status: updated.status,
          assignedManagerId: updated.assignedManagerId,
          mudurKarari: updated.mudurKarari,
          mudurKarariTarihi: updated.mudurKarariTarihi,
        };
    return NextResponse.json(
      kademeAtlandi ? { ...govde, kademeAtlandi } : govde,
      { status: 200 },
    );
  } catch (err) {
    // Sınav oturumu açılamadı (sınav yok/pasif) → geçiş geri alındı, anlaşılır 400.
    if (err instanceof AssessmentSessionError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    console.error("Başvuru geçişi başarısız:", err);
    return NextResponse.json(
      { error: "Geçiş sırasında hata oluştu" },
      { status: 500 },
    );
  }
}
