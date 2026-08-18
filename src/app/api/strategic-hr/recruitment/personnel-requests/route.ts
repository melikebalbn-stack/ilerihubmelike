import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PersonnelRequestStatus, PersonnelRequestType, EmploymentType, JobPriority } from "@/generated/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { talepAlanlariSchema, tarihDon } from "@/lib/recruitment/personnel-request-alanlar";
import { kadroTalepYetkisi, kadroTalepYetkisiz } from "@/lib/kadro-talep/kadro-talep-yetki";
import { kadroTalepGorunurluk, maasKapisi } from "@/lib/kadro-talep/kadro-talep-gorunurluk";

// Talep numarası oluştur
async function generateRequestNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PR-${year}-`;

  const lastRequest = await prisma.personnelRequest.findFirst({
    where: {
      requestNumber: { startsWith: prefix }
    },
    orderBy: { requestNumber: "desc" }
  });

  let nextNumber = 1;
  if (lastRequest) {
    const lastNumber = parseInt(lastRequest.requestNumber.replace(prefix, ""), 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(3, "0")}`;
}

// GET - Personel taleplerini listele
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (role/department/email session'dan)
    const { session, error } = await requireSession();
    if (error) return error;

    // PR-RECRUIT-RBAC kapsamı TEK KAYNAK: kadro-talep-gorunurluk.ts.
    // (Kural burada tekrarlanmaz — export ucu da aynı yerden besleniyor, ıraksamasınlar.)
    const { searchParams } = new URL(request.url);
    const { hasFullAccess, where } = kadroTalepGorunurluk(session, searchParams);

    const requests = await prisma.personnelRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        jobOpening: {
          select: {
            id: true,
            title: true,
            code: true,
            status: true
          }
        },
        // Onay zinciri (liste + detay dialog için) — onaycı adı/karar/tarih.
        approvals: {
          orderBy: { step: "asc" },
          include: { approver: { select: { id: true, name: true, email: true } } }
        }
      }
    });

    // Bütçe alanları yalnız admin'e (maasKapisi) — admin olmayanda anahtar HİÇ YOK.
    return NextResponse.json(maasKapisi(requests, hasFullAccess));
  } catch (error) {
    console.error("Personel talepleri listesi hatası:", error);
    return NextResponse.json(
      { error: "Personel talepleri alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - Yeni eleman talebi oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (requesterId = userId)
    const { session, userId, error } = await requireSession();
    if (error) return error;

    // Talep açma yetkisi SUNUCUDA zorlanır (menüde gizlemek yeterli değil):
    // müdür / müdür yardımcısı / İK dışındakiler 403. Tek kaynak: kadroTalepYetkisi.
    const { yetki, error: yetkiError } = await kadroTalepYetkisi();
    if (yetkiError) return yetkiError;
    if (!yetki.talepAcabilir) return kadroTalepYetkisiz();

    const body = await request.json();
    const {
      title,
      requestType,
      headcount,
      employmentType,
      justification,
      responsibilities,
      requirements,
      preferredStartDate,
      location,
      workModel,
      priority,
      // NOT: `status` body'den ALINMAZ — create DAİMA DRAFT yazar (aşağıya bakınız).
      // NOT: salaryMin/salaryMax/hasBudget body'den ALINMAZ — İK sonradan girer.
    } = body;

    if (!title || !justification) {
      return NextResponse.json(
        { error: "Pozisyon adı ve gerekçe zorunludur" },
        { status: 400 }
      );
    }

    // IV-FR-24 talep eden alanları — zod doğrulama (yaş min<=max dahil).
    // İV kapanış alanları POST'ta ALINMAZ (maaş gibi; İK sonradan PUT ile girer).
    const alanKontrol = talepAlanlariSchema.safeParse(body);
    if (!alanKontrol.success) {
      return NextResponse.json(
        { error: alanKontrol.error.issues[0]?.message || "Geçersiz alan." },
        { status: 400 }
      );
    }
    const a = alanKontrol.data;

    const requestNumber = await generateRequestNumber();

    const personnelRequest = await prisma.personnelRequest.create({
      data: {
        requestNumber,
        requesterId: userId,
        requesterEmail: session.user.email || "",
        requesterName: session.user.name || "",
        department: session.user.department || "",
        title,
        requestType: (requestType as PersonnelRequestType) || "NEW_POSITION",
        headcount: headcount || 1,
        employmentType: (employmentType as EmploymentType) || "FULL_TIME",
        justification,
        responsibilities,
        requirements,
        preferredStartDate: preferredStartDate ? new Date(preferredStartDate) : null,
        location,
        workModel,
        // Maaş/bütçe TALEP FORMUNDA girilmez (birim müdürü görmez). İK talep detayında
        // sonradan girer (recruitment.admin). Create'te daima boş bırakılır.
        salaryMin: null,
        salaryMax: null,
        hasBudget: false,
        priority: (priority as JobPriority) || "MEDIUM",
        // DAİMA DRAFT — body'deki `status` KABUL EDİLMEZ.
        //
        // NEDEN: onay zinciri (PersonnelRequestApproval satırları) YALNIZ `submit`
        // aksiyonunda kuruluyor (bkz. [id]/route.ts → resolveApprovers + createMany).
        // Create body'den "PENDING" kabul ettiği sürece ikinci bir kod yolu oluşuyordu:
        // talep PENDING doğuyor, submit'e hiç uğramıyor, zincir HİÇ kurulmuyor. Sonuç
        // sessiz kilit — ekranda Onayla/Reddet butonu render edilmiyor (approvals boş),
        // API'den zorlansa 400 "Bu talebin onay zinciri yok", "Onaya Gönder" de çıkmıyor
        // (o yalnız DRAFT'ta görünür) → talebi kurtarmanın UI yolu kalmıyor.
        // 2026-08 ölçümü: prod'daki 6 talebin ALTISI da bu yoldan gelmiş,
        // PersonnelRequestApproval tablosu tamamen BOŞ (0 satır).
        //
        // Artık PENDING'e geçişin TEK yolu submit — zincir kurulumu tek yerde kalır.
        status: "DRAFT" as PersonnelRequestStatus,
        // IV-FR-24 — talep eden alanları (İV kapanış alanları HARİÇ)
        formHazirlanmaTarihi: tarihDon(a.formHazirlanmaTarihi),
        ikTeslimTarihi: tarihDon(a.ikTeslimTarihi),
        kisilikOzellikleri: a.kisilikOzellikleri ?? null,
        egitimSeviyesi: a.egitimSeviyesi ?? null,
        egitimDiger: a.egitimDiger ?? null,
        tecrubeDurumu: a.tecrubeDurumu ?? null,
        tecrubeSuresi: a.tecrubeSuresi ?? null,
        yabanciDilGerekli: a.yabanciDilGerekli ?? null,
        yabanciDiller: a.yabanciDiller ?? null,
        bilgisayarBilgisi: a.bilgisayarBilgisi ?? null,
        kaliteSistemBilgisi: a.kaliteSistemBilgisi ?? null,
        ehliyetGerekli: a.ehliyetGerekli ?? null,
        ehliyetSinifi: a.ehliyetSinifi ?? null,
        digerBelgeIhtiyaci: a.digerBelgeIhtiyaci ?? null,
        cinsiyetTercihi: a.cinsiyetTercihi ?? null,
        yasAraligiMin: a.yasAraligiMin ?? null,
        yasAraligiMax: a.yasAraligiMax ?? null,
        askerlikGerekli: a.askerlikGerekli ?? null,
        ayrilanPersonelAdi: a.ayrilanPersonelAdi ?? null,
      }
    });

    return NextResponse.json(personnelRequest, { status: 201 });
  } catch (error) {
    console.error("Personel talebi oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Personel talebi oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
