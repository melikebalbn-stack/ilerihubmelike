import { jsPDF } from "jspdf"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { PoppinsRegular, PoppinsBold, PoppinsSemiBold } from "./fonts/poppins"

// IV-FR-24 — PERSONEL KADRO İSTEK VE ONAY FORMU. A4 dikey, tek sayfa.
// Türkçe: Poppins gömülü. Checkbox'lar vektör (kare + X) — glyph bağımlılığı yok.

type Decision = "APPROVED" | "REJECTED" | "RETURNED" | "FORWARDED" | null

export interface KadroTalepApprovalForPDF {
  step: number
  kademe: string
  role: string
  approverName: string | null
  decision: Decision
  comment: string | null
  decidedAt: Date | null
}

export interface KadroTalepForPDF {
  requestNumber: string
  status: string
  department: string
  title: string
  headcount: number
  formHazirlanmaTarihi: Date | null
  ikTeslimTarihi: Date | null
  preferredStartDate: Date | null
  responsibilities: string | null
  kisilikOzellikleri: string | null
  // yetkinlikler
  egitimSeviyesi: string | null
  egitimDiger: string | null
  tecrubeDurumu: string | null
  tecrubeSuresi: string | null
  yabanciDilGerekli: boolean | null
  yabanciDiller: unknown
  bilgisayarBilgisi: string | null
  kaliteSistemBilgisi: string | null
  ehliyetGerekli: boolean | null
  ehliyetSinifi: string | null
  digerBelgeIhtiyaci: string | null
  cinsiyetTercihi: string | null
  yasAraligiMin: number | null
  yasAraligiMax: number | null
  askerlikGerekli: boolean | null
  // talep nedeni
  requestType: string
  ayrilanPersonelAdi: string | null
  justification: string
  // İnsan Varlıkları bölümü
  adayKaynaklari: unknown
  ilanPortallari: string | null
  adayKaynagiDiger: string | null
  kadroDoldurulmaTarihi: Date | null
  iseBaslayanPersonelAdi: string | null
  ivOnayName: string | null
  ivOnayTarihi: Date | null
  // nihai karar damgası
  approvedByName: string | null
  approvedAt: Date | null
  rejectedByName: string | null
  rejectedAt: Date | null
  rejectionReason: string | null
  approvals: KadroTalepApprovalForPDF[]
}

const PRIMARY: [number, number, number] = [27, 79, 114] // #1B4F72
const RED: [number, number, number] = [192, 57, 43] // #C0392B
const DARK: [number, number, number] = [55, 55, 55]
const GRAY: [number, number, number] = [120, 120, 120]
const LINE: [number, number, number] = [170, 170, 170]

function fmtDate(d: Date | null): string {
  return d ? format(d, "dd.MM.yyyy", { locale: tr }) : ""
}

function dillerText(v: unknown): string {
  if (!v) return ""
  if (typeof v === "string") return v
  if (Array.isArray(v)) {
    return v
      .map((x) =>
        x && typeof x === "object"
          ? [(x as Record<string, unknown>).dil, (x as Record<string, unknown>).seviye]
              .filter(Boolean)
              .join(" ")
          : String(x),
      )
      .filter(Boolean)
      .join(", ")
  }
  return ""
}

function kaynakArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x))
  if (typeof v === "string" && v.trim()) return [v]
  return []
}

/**
 * @param data Talep verisi; boş form için null.
 * @param opts.bosForm true ise elle doldurulacak boş form (filigran yok).
 */
export function generateKadroTalepPdfBuffer(
  data: KadroTalepForPDF | null,
  opts: { bosForm?: boolean } = {},
): Buffer {
  const bos = opts.bosForm === true || data === null
  // TASLAK filigranı: onaylanmamış (APPROVED değil) gerçek taleplerde. Boş formda YOK.
  const watermark = !bos && data !== null && data.status !== "APPROVED"

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  doc.addFileToVFS("Poppins-Regular.ttf", PoppinsRegular)
  doc.addFileToVFS("Poppins-Bold.ttf", PoppinsBold)
  doc.addFileToVFS("Poppins-SemiBold.ttf", PoppinsSemiBold)
  doc.addFont("Poppins-Regular.ttf", "Poppins", "normal")
  doc.addFont("Poppins-Bold.ttf", "Poppins", "bold")
  doc.addFont("Poppins-SemiBold.ttf", "Poppins", "semibold")
  doc.setFont("Poppins", "normal")

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 10
  const cw = pageW - margin * 2
  let y = margin

  // ---- helpers ----
  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2])
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2])
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2])

  function checkbox(x: number, cy: number, checked: boolean, size = 2.6) {
    setDraw([90, 90, 90])
    doc.setLineWidth(0.25)
    doc.rect(x, cy - size + 0.3, size, size)
    if (checked) {
      doc.setLineWidth(0.45)
      setDraw(PRIMARY)
      doc.line(x + 0.4, cy - size + 0.7, x + size - 0.4, cy - 0.1)
      doc.line(x + size - 0.4, cy - size + 0.7, x + 0.4, cy - 0.1)
      setDraw([90, 90, 90])
    }
  }

  // checkbox + etiket; sonraki x'i döndürür
  function opt(x: number, cy: number, label: string, checked: boolean): number {
    checkbox(x, cy, checked)
    doc.setFont("Poppins", "normal")
    doc.setFontSize(7.5)
    setText(DARK)
    doc.text(label, x + 3.4, cy)
    return x + 3.4 + doc.getTextWidth(label) + 4
  }

  function sectionHeader(title: string) {
    setFill(PRIMARY)
    doc.rect(margin, y, cw, 4.6, "F")
    doc.setFont("Poppins", "bold")
    doc.setFontSize(7.5)
    setText([255, 255, 255])
    doc.text(title, margin + 1.8, y + 3.3)
    y += 4.6 + 1.6
  }

  // etiket + değer/altı çizili boşluk
  function field(label: string, value: string, x: number, fy: number, w: number) {
    doc.setFont("Poppins", "semibold")
    doc.setFontSize(6.3)
    setText(GRAY)
    doc.text(label.toUpperCase(), x, fy)
    doc.setFont("Poppins", "normal")
    doc.setFontSize(8)
    setText(DARK)
    const v = (value || "").trim()
    if (v) {
      const lines = doc.splitTextToSize(v, w)
      doc.text(lines[0], x, fy + 3.6)
    } else {
      setDraw(LINE)
      doc.setLineWidth(0.2)
      doc.line(x, fy + 3.6, x + w, fy + 3.6)
    }
  }

  // metin alanı (çok satır) — etiket + değer veya boş çizgiler
  function textArea(label: string, value: string, fy: number, lineCount: number): number {
    doc.setFont("Poppins", "semibold")
    doc.setFontSize(6.3)
    setText(GRAY)
    doc.text(label.toUpperCase(), margin, fy)
    let ty = fy + 3.4
    const v = (value || "").trim()
    if (v) {
      doc.setFont("Poppins", "normal")
      doc.setFontSize(8)
      setText(DARK)
      const lines = doc.splitTextToSize(v, cw).slice(0, lineCount)
      for (const ln of lines) {
        doc.text(ln, margin, ty)
        ty += 4
      }
      return Math.max(ty, fy + 3.4 + lineCount * 4)
    }
    setDraw(LINE)
    doc.setLineWidth(0.2)
    for (let i = 0; i < lineCount; i++) {
      doc.line(margin, ty, margin + cw, ty)
      ty += 4.5
    }
    return ty
  }

  const val = (v: string | null | undefined) => (bos ? "" : v ?? "")
  const dval = (d: Date | null) => (bos ? "" : fmtDate(d))
  // enum seçili mi (boş formda tüm kutular boş)
  const eq = (a: string | null | undefined, b: string) => !bos && a === b
  const isTrue = (b: boolean | null | undefined) => !bos && b === true
  const isFalse = (b: boolean | null | undefined) => !bos && b === false

  // ================= ÜST BİLGİ =================
  const boxW = 62
  const boxX = pageW - margin - boxW
  const boxH = 16
  setDraw(PRIMARY)
  doc.setLineWidth(0.3)
  doc.rect(boxX, y, boxW, boxH)
  doc.setFontSize(6.4)
  setText(DARK)
  const infoLines = [
    "Doküman No: IV-FR-24",
    "İlk Yayın Tarihi: 18.01.2021",
    "Rev: 1          Sayfa: 1/1",
  ]
  doc.setFont("Poppins", "semibold")
  let iy = y + 4
  for (const l of infoLines) {
    doc.text(l, boxX + 2, iy)
    iy += 4
  }
  // Başlık
  doc.setFont("Poppins", "bold")
  doc.setFontSize(13)
  setText(PRIMARY)
  doc.text("PERSONEL KADRO", margin, y + 6)
  doc.text("İSTEK VE ONAY FORMU", margin, y + 12.5)
  y += boxH + 3

  // ================= BÖLÜM 1 — TALEP BİLGİSİ =================
  sectionHeader("1. TALEP BİLGİSİ")
  const c2 = cw / 2
  field("Personel Talep Eden Birim", val(data?.department), margin, y, c2 - 4)
  field("İstenilen İşbaşı Tarihi", dval(data?.preferredStartDate ?? null), margin + c2, y, c2 - 4)
  y += 8
  field("Formun Hazırlandığı Tarih", dval(data?.formHazirlanmaTarihi ?? null), margin, y, c2 - 4)
  field("İnsan Varlıklarına Teslim Tarihi", dval(data?.ikTeslimTarihi ?? null), margin + c2, y, c2 - 4)
  y += 8
  field("Unvan", val(data?.title), margin, y, c2 * 1.4)
  field(
    "Talep Edilen Personel Sayısı",
    bos ? "" : data ? String(data.headcount) : "",
    margin + c2 * 1.4,
    y,
    cw - c2 * 1.4,
  )
  y += 8
  y = textArea("Görev Tanımı", val(data?.responsibilities), y, 2) + 1
  y = textArea("Kişilik Özellikleri", val(data?.kisilikOzellikleri), y, 2) + 2

  // ================= BÖLÜM 2 — ARANAN YETKİNLİKLER =================
  sectionHeader("2. ARANAN YETKİNLİKLER")
  doc.setFontSize(7.5)
  // Eğitim Seviyesi
  doc.setFont("Poppins", "semibold")
  setText(GRAY)
  doc.text("Eğitim Seviyesi:", margin, y)
  let x = margin + 26
  x = opt(x, y, "Lise", eq(data?.egitimSeviyesi, "LISE"))
  x = opt(x, y, "Teknik Lise", eq(data?.egitimSeviyesi, "TEKNIK_LISE"))
  x = opt(x, y, "Ön Lisans", eq(data?.egitimSeviyesi, "ON_LISANS"))
  x = opt(x, y, "Lisans", eq(data?.egitimSeviyesi, "LISANS"))
  x = opt(x, y, "Yüksek Lisans", eq(data?.egitimSeviyesi, "YUKSEK_LISANS"))
  x = opt(x, y, "Diğer:", eq(data?.egitimSeviyesi, "DIGER"))
  field("", val(data?.egitimDiger), x, y - 3.6, margin + cw - x)
  y += 6

  // Tecrübe
  doc.setFont("Poppins", "semibold")
  setText(GRAY)
  doc.text("Tecrübe:", margin, y)
  x = margin + 26
  x = opt(x, y, "Tecrübeli — Süre:", eq(data?.tecrubeDurumu, "TECRUBELI"))
  field("", val(data?.tecrubeSuresi), x, y - 3.6, 22)
  x += 26
  opt(x, y, "Yeni Mezun", eq(data?.tecrubeDurumu, "YENI_MEZUN"))
  y += 6

  // Yabancı Dil
  doc.setFont("Poppins", "semibold")
  setText(GRAY)
  doc.text("Yabancı Dil:", margin, y)
  x = margin + 26
  x = opt(x, y, "Gerekli", isTrue(data?.yabanciDilGerekli))
  x = opt(x, y, "Gerekli Değil", isFalse(data?.yabanciDilGerekli))
  doc.setFont("Poppins", "normal")
  setText(DARK)
  doc.text("Diller / Seviye:", x, y)
  field("", val(dillerText(data?.yabanciDiller)), x + doc.getTextWidth("Diller / Seviye:") + 2, y - 3.6, margin + cw - (x + 26))
  y += 6

  // Bilgisayar + Kalite
  field("Bilgisayar Bilgisi Beklentisi & Programlar", val(data?.bilgisayarBilgisi), margin, y, c2 - 4)
  field("Kalite Sistem Bilgisi Beklentisi", val(data?.kaliteSistemBilgisi), margin + c2, y, c2 - 4)
  y += 8

  // Ehliyet
  doc.setFont("Poppins", "semibold")
  setText(GRAY)
  doc.text("Ehliyet & Yeterlilik:", margin, y)
  x = margin + 30
  x = opt(x, y, "Gerekli — Sınıfı:", isTrue(data?.ehliyetGerekli))
  field("", val(data?.ehliyetSinifi), x, y - 3.6, 16)
  x += 20
  x = opt(x, y, "Gerekli Değil", isFalse(data?.ehliyetGerekli))
  doc.setFont("Poppins", "normal")
  setText(DARK)
  doc.text("Diğer Belge:", x, y)
  field("", val(data?.digerBelgeIhtiyaci), x + doc.getTextWidth("Diğer Belge:") + 2, y - 3.6, margin + cw - (x + 24))
  y += 6

  // Cinsiyet + Yaş + Askerlik
  doc.setFont("Poppins", "semibold")
  setText(GRAY)
  doc.text("Cinsiyet:", margin, y)
  x = margin + 26
  x = opt(x, y, "Bay", eq(data?.cinsiyetTercihi, "BAY"))
  x = opt(x, y, "Bayan", eq(data?.cinsiyetTercihi, "BAYAN"))
  x = opt(x, y, "Farketmez", eq(data?.cinsiyetTercihi, "FARKETMEZ"))
  doc.setFont("Poppins", "semibold")
  setText(GRAY)
  doc.text("Yaş Aralığı: En az", x, y)
  field("", bos ? "" : data?.yasAraligiMin != null ? String(data.yasAraligiMin) : "", x + doc.getTextWidth("Yaş Aralığı: En az") + 2, y - 3.6, 12)
  x += doc.getTextWidth("Yaş Aralığı: En az") + 16
  doc.setFont("Poppins", "semibold")
  setText(GRAY)
  doc.text("En fazla", x, y)
  field("", bos ? "" : data?.yasAraligiMax != null ? String(data.yasAraligiMax) : "", x + doc.getTextWidth("En fazla") + 2, y - 3.6, 12)
  y += 6
  doc.setFont("Poppins", "semibold")
  setText(GRAY)
  doc.text("Askerliği Tamamlama:", margin, y)
  x = margin + 36
  x = opt(x, y, "Gerekli", isTrue(data?.askerlikGerekli))
  opt(x, y, "Gerekli Değil", isFalse(data?.askerlikGerekli))
  y += 4

  // ================= BÖLÜM 3 — TALEP NEDENİ =================
  sectionHeader("3. TALEP NEDENİ")
  const isReplace = eq(data?.requestType, "REPLACEMENT")
  const isNew = !bos && data ? data.requestType === "NEW_POSITION" || data.requestType === "EXPANSION" : false
  doc.setFontSize(7.5)
  x = margin
  x = opt(x, y, "Boşalacak/Boşalan kadro için — Adı Soyadı:", isReplace)
  field("", isReplace ? val(data?.ayrilanPersonelAdi) : "", x, y - 3.6, margin + cw - x)
  y += 6
  x = margin
  x = opt(x, y, "Eleman Değişikliği — Adı Soyadı:", false)
  field("", "", x, y - 3.6, margin + cw - x)
  y += 6
  opt(margin, y, "Yeni Kadro İhtiyacı", isNew)
  y += 6
  y = textArea("Taleple İlgili Açıklama", val(data?.justification), y, 2) + 2

  // ================= BÖLÜM 4 — ONAYLAR =================
  sectionHeader("4. ONAYLAR")
  const findStep = (kademe: string) => data?.approvals.find((a) => a.kademe === kademe) ?? null
  const bm = findStep("BOLUM_MUDURU")
  const gmy = findStep("DEPUTY_GM")
  const gm = findStep("GM")

  const gap = 3
  const bw = (cw - gap * 2) / 3
  const bh = 24
  const boxY = y

  function approvalBox(bx: number, title: string, ap: KadroTalepApprovalForPDF | null, isGm: boolean) {
    setDraw(PRIMARY)
    doc.setLineWidth(0.3)
    doc.rect(bx, boxY, bw, bh)
    doc.setFont("Poppins", "semibold")
    doc.setFontSize(6.6)
    setText(PRIMARY)
    const tl = doc.splitTextToSize(title, bw - 3)
    doc.text(tl, bx + 1.5, boxY + 3)
    let by = boxY + 3 + tl.length * 3

    if (isGm) {
      // UYGUNDUR / UYGUN DEĞİLDİR
      by += 2
      const uygun = ap?.decision === "APPROVED"
      const degil = ap?.decision === "REJECTED"
      let ux = bx + 1.5
      ux = opt(ux, by, "UYGUNDUR", bos ? false : uygun)
      opt(ux, by, "UYGUN DEĞİLDİR", bos ? false : degil)
      by += 3
    }

    // ad soyad + tarih
    doc.setFont("Poppins", "normal")
    doc.setFontSize(6.8)
    setText(DARK)
    const signed = !bos && ap != null && ap.decision != null && ap.decision !== "RETURNED"
    if (signed && ap) {
      doc.text(ap.approverName || "—", bx + 1.5, boxY + bh - 6.5)
      doc.text(fmtDate(ap.decidedAt), bx + 1.5, boxY + bh - 3.5)
      doc.setFont("Poppins", "semibold")
      doc.setFontSize(5.6)
      setText(RED)
      doc.text("[ ELEKTRONİK ORTAMDA İMZALANMIŞTIR ]", bx + 1.5, boxY + bh - 1)
    } else if (!bos) {
      doc.setFont("Poppins", "normal")
      doc.setFontSize(6.4)
      setText(GRAY)
      doc.text("Onay bekleniyor", bx + 1.5, boxY + bh - 3)
    } else {
      setDraw(LINE)
      doc.setLineWidth(0.2)
      doc.line(bx + 1.5, boxY + bh - 6, bx + bw - 1.5, boxY + bh - 6)
      doc.line(bx + 1.5, boxY + bh - 2, bx + bw - 1.5, boxY + bh - 2)
    }
  }

  approvalBox(margin, "Talep Eden İlgili Bölüm Müdürü Onayı", bm, false)
  approvalBox(margin + bw + gap, "Genel Müdür Yrd. Onayı", gmy, false)
  approvalBox(margin + (bw + gap) * 2, "Genel Müdür Değerlendirme & Onayı", gm, true)
  y = boxY + bh + 1.5

  // Reddedilme açıklaması
  if (!bos && data && (data.status === "REJECTED" || data.rejectionReason)) {
    doc.setFont("Poppins", "semibold")
    doc.setFontSize(6.6)
    setText(RED)
    const rl = doc.splitTextToSize(
      `RED: ${data.rejectedByName || "—"} — ${data.rejectionReason || "Açıklama yok"}`,
      cw,
    )
    doc.text(rl[0], margin, y + 2)
    y += 5
  }
  y += 1

  // ================= BÖLÜM 5 — İNSAN VARLIKLARI BÖLÜMÜ =================
  sectionHeader("5. AŞAĞIDAKİ BÖLÜM İNSAN VARLIKLARI BÖLÜMÜ TARAFINDAN DOLDURULACAKTIR")
  const kaynaklar = kaynakArr(data?.adayKaynaklari)
  const inKaynak = (kw: string) =>
    !bos && kaynaklar.some((k) => k.toLocaleLowerCase("tr").includes(kw))
  doc.setFont("Poppins", "semibold")
  doc.setFontSize(7)
  setText(GRAY)
  doc.text("Adaylara Ulaşılacak Kaynak:", margin, y)
  y += 4
  x = margin
  doc.setFontSize(7.3)
  x = opt(x, y, "İşkur", inKaynak("işkur"))
  x = opt(x, y, "İç Duyuru", inKaynak("iç"))
  x = opt(x, y, "OSB", inKaynak("osb"))
  x = opt(x, y, "Referans", inKaynak("referans"))
  x = opt(x, y, "Mezun Öğrenci Datası", inKaynak("mezun"))
  x = opt(x, y, "Gerekirse Destek Firma", inKaynak("destek"))
  y += 5
  field("İlan Portalları", val(data?.ilanPortallari), margin, y, c2 - 4)
  field("Diğer", val(data?.adayKaynagiDiger), margin + c2, y, c2 - 4)
  y += 8
  field("Kadronun Doldurulduğu Tarih", dval(data?.kadroDoldurulmaTarihi ?? null), margin, y, c2 - 4)
  field("İşbaşı Yapan Personelin Adı-Soyadı", val(data?.iseBaslayanPersonelAdi), margin + c2, y, c2 - 4)
  y += 8

  // İnsan Varlıkları Onayı imza bloğu
  const ivSigned = !bos && data != null && data.ivOnayName != null
  setDraw(PRIMARY)
  doc.setLineWidth(0.3)
  const ivBoxH = 15
  doc.rect(margin, y, cw, ivBoxH)
  doc.setFont("Poppins", "semibold")
  doc.setFontSize(7)
  setText(PRIMARY)
  doc.text("İnsan Varlıkları Onayı", margin + 2, y + 4)
  doc.setFont("Poppins", "normal")
  doc.setFontSize(7)
  setText(DARK)
  if (ivSigned && data) {
    doc.text(`${data.ivOnayName || "—"}    ${fmtDate(data.ivOnayTarihi)}`, margin + 2, y + 9)
    doc.setFont("Poppins", "semibold")
    doc.setFontSize(6)
    setText(RED)
    doc.text("[ ELEKTRONİK ORTAMDA İMZALANMIŞTIR ]", margin + 2, y + 13)
  } else if (!bos) {
    setText(GRAY)
    doc.text("Onay bekleniyor", margin + 2, y + 10)
  } else {
    setDraw(LINE)
    doc.setLineWidth(0.2)
    doc.line(margin + 2, y + 11, margin + cw - 2, y + 11)
  }
  y += ivBoxH + 2

  // ================= ALT BİLGİ =================
  const footerY = pageH - 6
  setDraw([220, 220, 220])
  doc.setLineWidth(0.2)
  doc.line(margin, footerY - 3, pageW - margin, footerY - 3)
  doc.setFont("Poppins", "normal")
  doc.setFontSize(6.6)
  setText(GRAY)
  doc.text("ISO 9001:2015 / IATF 16949   Madde No: 7.2.2", margin, footerY)
  doc.setFont("Poppins", "semibold")
  doc.text("DAHİLİ", pageW - margin, footerY, { align: "right" })
  if (!bos && data) {
    doc.setFont("Poppins", "normal")
    setText(GRAY)
    doc.text(`Talep No: ${data.requestNumber}`, pageW / 2, footerY, { align: "center" })
  }

  // ================= TASLAK FİLİGRANI =================
  if (watermark) {
    try {
      // @ts-expect-error jsPDF GState çalışma zamanında mevcut
      doc.setGState(new doc.GState({ opacity: 0.1 }))
      doc.setFont("Poppins", "bold")
      doc.setFontSize(95)
      setText([120, 120, 120])
      doc.text("TASLAK", pageW / 2, pageH / 2, { align: "center", angle: 45 })
      // @ts-expect-error opaklığı geri al
      doc.setGState(new doc.GState({ opacity: 1 }))
    } catch {
      doc.setFont("Poppins", "bold")
      doc.setFontSize(95)
      setText([232, 232, 232])
      doc.text("TASLAK", pageW / 2, pageH / 2, { align: "center", angle: 45 })
    }
  }

  return Buffer.from(doc.output("arraybuffer"))
}
