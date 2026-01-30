import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ISO 27001:2022 Annex A Kontrolleri
const ANNEX_A_CONTROLS = {
  "5": {
    name: "Organizasyonel Kontroller",
    controls: [
      { id: "5.1", title: "Bilgi guvenligi politikalari" },
      { id: "5.2", title: "Bilgi guvenligi rolleri ve sorumluluklari" },
      { id: "5.3", title: "Gorevlerin ayrilmasi" },
      { id: "5.4", title: "Yonetim sorumluluklari" },
      { id: "5.5", title: "Yetkililerle iletisim" },
      { id: "5.6", title: "Ozel ilgi gruplariyla iletisim" },
      { id: "5.7", title: "Tehdit istihbarati" },
      { id: "5.8", title: "Proje yonetiminde bilgi guvenligi" },
      { id: "5.9", title: "Bilgi ve diger iliskili varliklarin envanteri" },
      { id: "5.10", title: "Bilgi ve diger iliskili varliklarin kabul edilebilir kullanimi" },
      { id: "5.11", title: "Varliklarin iadesi" },
      { id: "5.12", title: "Bilginin siniflandirilmasi" },
      { id: "5.13", title: "Bilginin etiketlenmesi" },
      { id: "5.14", title: "Bilgi transferi" },
      { id: "5.15", title: "Erisim kontrolu" },
      { id: "5.16", title: "Kimlik yonetimi" },
      { id: "5.17", title: "Kimlik dogrulama bilgileri" },
      { id: "5.18", title: "Erisim haklari" },
      { id: "5.19", title: "Tedarikci iliskilerinde bilgi guvenligi" },
      { id: "5.20", title: "Tedarikci sozlesmelerinde bilgi guvenliginin ele alinmasi" },
      { id: "5.21", title: "ICT tedarik zincirinde bilgi guvenliginin yonetimi" },
      { id: "5.22", title: "Tedarikci hizmetlerinin izlenmesi, gozden gecirilmesi ve degisiklik yonetimi" },
      { id: "5.23", title: "Bulut hizmetlerinin kullanimi icin bilgi guvenligi" },
      { id: "5.24", title: "Bilgi guvenligi olay yonetimi planlamasi ve hazirlik" },
      { id: "5.25", title: "Bilgi guvenligi olaylarinin degerlendirilmesi ve karara baglanmasi" },
      { id: "5.26", title: "Bilgi guvenligi olaylarina mudahale" },
      { id: "5.27", title: "Bilgi guvenligi olaylarindan ogrenme" },
      { id: "5.28", title: "Kanit toplama" },
      { id: "5.29", title: "Kesinti sirasinda bilgi guvenligi" },
      { id: "5.30", title: "Is surekliligi icin ICT hazirligi" },
      { id: "5.31", title: "Yasal, duzenleyici ve sozlesmesel gereksinimler" },
      { id: "5.32", title: "Fikri mulkiyet haklari" },
      { id: "5.33", title: "Kayitlarin korunmasi" },
      { id: "5.34", title: "Gizlilik ve kisisel bilgilerin korunmasi" },
      { id: "5.35", title: "Bilgi guvenliginin bagimsiz gozden gecirilmesi" },
      { id: "5.36", title: "Bilgi guvenligi politikalari, kurallari ve standartlarina uyum" },
      { id: "5.37", title: "Belgelendirilmis isletim prosedürleri" },
    ],
  },
  "6": {
    name: "Insan Kaynaklari Kontrolleri",
    controls: [
      { id: "6.1", title: "Tarama" },
      { id: "6.2", title: "Istihdam hukum ve kosullari" },
      { id: "6.3", title: "Bilgi guvenligi farkindalik, egitim ve ogretimi" },
      { id: "6.4", title: "Disiplin sureci" },
      { id: "6.5", title: "Istihdam sonlandirma veya degisiklik sonrasi sorumluluklar" },
      { id: "6.6", title: "Gizlilik veya ifsa etmeme sozlesmeleri" },
      { id: "6.7", title: "Uzaktan calisma" },
      { id: "6.8", title: "Bilgi guvenligi olay raporlamasi" },
    ],
  },
  "7": {
    name: "Fiziksel Kontroller",
    controls: [
      { id: "7.1", title: "Fiziksel guvenlik cevresi" },
      { id: "7.2", title: "Fiziksel giris" },
      { id: "7.3", title: "Ofislerin, odalarin ve tesislerin guvenliginin saglanmasi" },
      { id: "7.4", title: "Fiziksel guvenlik izleme" },
      { id: "7.5", title: "Fiziksel ve cevresel tehditlere karsi koruma" },
      { id: "7.6", title: "Guvenli alanlarda calisma" },
      { id: "7.7", title: "Temiz masa ve temiz ekran" },
      { id: "7.8", title: "Ekipman yerlesimi ve koruma" },
      { id: "7.9", title: "Tesis disi varliklarin guvenligi" },
      { id: "7.10", title: "Depolama ortami" },
      { id: "7.11", title: "Destekleyici hizmetler" },
      { id: "7.12", title: "Kablolama guvenligi" },
      { id: "7.13", title: "Ekipman bakimi" },
      { id: "7.14", title: "Ekipmanin guvenli imhasi veya yeniden kullanimi" },
    ],
  },
  "8": {
    name: "Teknolojik Kontroller",
    controls: [
      { id: "8.1", title: "Kullanici uc noktasi cihazlari" },
      { id: "8.2", title: "Ayricalikli erisim haklari" },
      { id: "8.3", title: "Bilgi erisim kisitlamasi" },
      { id: "8.4", title: "Kaynak koduna erisim" },
      { id: "8.5", title: "Guvenli kimlik dogrulama" },
      { id: "8.6", title: "Kapasite yonetimi" },
      { id: "8.7", title: "Kotu amacli yazilimlara karsi koruma" },
      { id: "8.8", title: "Teknik acikliklarin yonetimi" },
      { id: "8.9", title: "Konfigürasyon yonetimi" },
      { id: "8.10", title: "Bilgi silme" },
      { id: "8.11", title: "Veri maskeleme" },
      { id: "8.12", title: "Veri sizintisi onleme" },
      { id: "8.13", title: "Bilgi yedekleme" },
      { id: "8.14", title: "Bilgi isleme tesislerinin yedeklenmesi" },
      { id: "8.15", title: "Kayit tutma" },
      { id: "8.16", title: "Izleme faaliyetleri" },
      { id: "8.17", title: "Saat senkronizasyonu" },
      { id: "8.18", title: "Ayricalikli yardimci programlarin kullanimi" },
      { id: "8.19", title: "Isletim sistemlerine yazilim kurulumu" },
      { id: "8.20", title: "Ag guvenligi" },
      { id: "8.21", title: "Ag hizmetlerinin guvenligi" },
      { id: "8.22", title: "Aglarin ayrilmasi" },
      { id: "8.23", title: "Web filtreleme" },
      { id: "8.24", title: "Kriptografinin kullanimi" },
      { id: "8.25", title: "Guvenli gelistirme yasam dongusu" },
      { id: "8.26", title: "Uygulama guvenligi gereksinimleri" },
      { id: "8.27", title: "Guvenli sistem mimarisi ve muhendislik ilkeleri" },
      { id: "8.28", title: "Guvenli kodlama" },
      { id: "8.29", title: "Gelistirme ve kabul testinde guvenlik testi" },
      { id: "8.30", title: "Dis kaynak gelistirme" },
      { id: "8.31", title: "Gelistirme, test ve uretim ortamlarinin ayrilmasi" },
      { id: "8.32", title: "Degisiklik yonetimi" },
      { id: "8.33", title: "Test bilgisi" },
      { id: "8.34", title: "Denetim testleri sirasinda bilgi sistemlerinin korunmasi" },
    ],
  },
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || "json"

    // Veritabanından kontrolleri çek
    const dbControls = await prisma.iso27001Control.findMany({
      include: {
        documents: {
          include: {
            document: {
              select: { id: true, title: true, documentNumber: true },
            },
          },
        },
        evidences: {
          select: { id: true, title: true, evidenceType: true },
        },
      },
      orderBy: { controlId: "asc" },
    })

    // Tüm kontrolleri birleştir
    const allControls: any[] = []

    Object.entries(ANNEX_A_CONTROLS).forEach(([catNum, category]) => {
      category.controls.forEach((control) => {
        const dbControl = dbControls.find((c) => c.controlId === control.id)

        allControls.push({
          controlId: control.id,
          title: control.title,
          category: category.name,
          categoryNumber: catNum,
          applicable: dbControl?.applicability !== false,
          applicableJustification: dbControl?.applicability === false ? dbControl.justification : null,
          status: dbControl?.status || "NOT_IMPLEMENTED",
          implementationNotes: dbControl?.implementationNotes || null,
          justification: dbControl?.justification || null,
          responsiblePerson: dbControl?.responsibleName || null,
          implementationDate: dbControl?.implementationDate || null,
          reviewDate: dbControl?.lastReviewDate || null,
          documents: dbControl?.documents?.map((d) => ({
            id: d.document.id,
            title: d.document.title,
            documentNumber: d.document.documentNumber,
          })) || [],
          evidences: dbControl?.evidences || [],
        })
      })
    })

    // İstatistikler
    const applicable = allControls.filter((c) => c.applicable)
    const stats = {
      total: allControls.length,
      applicable: applicable.length,
      notApplicable: allControls.length - applicable.length,
      implemented: applicable.filter((c) => c.status === "IMPLEMENTED").length,
      partiallyImplemented: applicable.filter((c) => c.status === "PARTIALLY").length,
      notImplemented: applicable.filter((c) => c.status === "NOT_IMPLEMENTED" || !c.status).length,
      complianceRate: applicable.length > 0
        ? Math.round((applicable.filter((c) => c.status === "IMPLEMENTED").length / applicable.length) * 100)
        : 0,
    }

    // Kategori bazlı istatistikler
    const categoryStats = Object.entries(ANNEX_A_CONTROLS).map(([catNum, category]) => {
      const catControls = allControls.filter((c) => c.categoryNumber === catNum)
      const catApplicable = catControls.filter((c) => c.applicable)
      const catImplemented = catApplicable.filter((c) => c.status === "IMPLEMENTED")

      return {
        category: category.name,
        categoryNumber: catNum,
        total: catControls.length,
        applicable: catApplicable.length,
        implemented: catImplemented.length,
        complianceRate: catApplicable.length > 0
          ? Math.round((catImplemented.length / catApplicable.length) * 100)
          : 0,
      }
    })

    const soaReport = {
      title: "Statement of Applicability (SoA)",
      organization: "ILERI Group",
      standard: "ISO/IEC 27001:2022",
      generatedAt: new Date().toISOString(),
      generatedBy: session.user.name || session.user.email,
      summary: stats,
      categoryStats,
      controls: allControls,
    }

    return NextResponse.json(soaReport)
  } catch (error) {
    console.error("SoA export hatasi:", error)
    return NextResponse.json(
      { error: "SoA raporu olusturulamadi" },
      { status: 500 }
    )
  }
}
