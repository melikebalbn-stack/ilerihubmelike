import { jsPDF } from "jspdf"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { PoppinsRegular, PoppinsBold, PoppinsSemiBold } from "./fonts/poppins"

// IV-FR-03 — TUTANAK FORMU. A4 dikey, tek sayfa (şahit sayısı artarsa tablo taşar,
// taşma satırları ikinci sayfaya geçer). Türkçe: Poppins gömülü (kadro-talep deseni).
//
// Düzen IV-FR-03 kâğıt formuna uyar:
//   1) Başlık bloğu  — form adı/kodu, tutanak no, tarih, personel kimliği
//   2) Tutanak İçeriği — sebep (işaretli kutu) + açıklama metni
//   3) Tutanak Sahipleri — şahitler + onaylayanlar TEK tabloda (kâğıt formdaki
//      imza tablosunun karşılığı: ad, görevi/rolü, kararı, tarihi)
//   4) Alt bilgi — ISO dipnotu + "GİZLİ" ibaresi

export type TutanakPdfKarar = "BEKLIYOR" | "ONAYLADI" | "REDDETTI" | "KAPATTI" | "BILGI"

export interface TutanakSahibiForPDF {
  /** Tabloda görünen rol: "Şahit", "Yönetici (1. kademe)", "İnsan Varlıkları"… */
  rol: string
  adSoyad: string
  bolum: string | null
  karar: TutanakPdfKarar
  kararAt: Date | null
  not: string | null
}

export interface TutanakForPDF {
  tutanakNo: string
  tutanakTarihi: Date
  durum: string
  durumEtiketi: string
  adSoyad: string
  sicilNo: string | null
  bolum: string
  gorev: string | null
  sebep: string
  sebepEtiketi: string
  /** Formda işaretlenecek tüm sebep seçenekleri (kod + etiket), sırayla. */
  sebepSecenekleri: { kod: string; etiket: string }[]
  aciklama: string
  acanAd: string
  acanRolEtiketi: string
  sahipler: TutanakSahibiForPDF[]
}

const PRIMARY: [number, number, number] = [27, 79, 114]
const RED: [number, number, number] = [192, 57, 43]
const GREEN: [number, number, number] = [30, 110, 70]
const DARK: [number, number, number] = [55, 55, 55]
const GRAY: [number, number, number] = [120, 120, 120]
const LINE: [number, number, number] = [170, 170, 170]

const KARAR_ETIKETLERI: Record<TutanakPdfKarar, string> = {
  BEKLIYOR: "Bekliyor",
  ONAYLADI: "Onayladı",
  REDDETTI: "Reddetti",
  KAPATTI: "Kapattı",
  BILGI: "Bilgilendirildi",
}

function fmtDate(d: Date | null): string {
  return d ? format(d, "dd.MM.yyyy", { locale: tr }) : ""
}

function fmtDateTime(d: Date | null): string {
  return d ? format(d, "dd.MM.yyyy HH:mm", { locale: tr }) : ""
}

export function generateTutanakPdfBuffer(data: TutanakForPDF): Buffer {
  // Kapanmamış tutanakta filigran: evrak elden dolaşırsa "henüz tamamlanmadı" görünsün.
  const watermark = data.durum !== "TAMAMLANDI"

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
  const margin = 12
  const cw = pageW - margin * 2
  let y = margin

  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2])
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2])
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2])

  function checkbox(x: number, cy: number, checked: boolean, size = 2.8) {
    setDraw([90, 90, 90])
    doc.setLineWidth(0.25)
    doc.rect(x, cy - size + 0.3, size, size)
    if (checked) {
      doc.setLineWidth(0.5)
      setDraw(PRIMARY)
      doc.line(x + 0.4, cy - size + 0.7, x + size - 0.4, cy - 0.1)
      doc.line(x + size - 0.4, cy - size + 0.7, x + 0.4, cy - 0.1)
    }
  }

  function sectionHeader(title: string) {
    setFill(PRIMARY)
    doc.rect(margin, y, cw, 5, "F")
    doc.setFont("Poppins", "bold")
    doc.setFontSize(8)
    setText([255, 255, 255])
    doc.text(title, margin + 2, y + 3.5)
    y += 5 + 2
  }

  function field(label: string, value: string, x: number, fy: number, w: number) {
    doc.setFont("Poppins", "semibold")
    doc.setFontSize(6.4)
    setText(GRAY)
    doc.text(label.toUpperCase(), x, fy)
    doc.setFont("Poppins", "normal")
    doc.setFontSize(8.5)
    setText(DARK)
    const v = (value || "").trim()
    if (v) {
      doc.text(doc.splitTextToSize(v, w)[0], x, fy + 4)
    } else {
      setDraw(LINE)
      doc.setLineWidth(0.2)
      doc.line(x, fy + 4, x + w, fy + 4)
    }
  }

  // ================= 1) BAŞLIK BLOĞU =================
  doc.setFont("Poppins", "bold")
  doc.setFontSize(13)
  setText(PRIMARY)
  doc.text("TUTANAK FORMU", pageW / 2, y + 5, { align: "center" })
  doc.setFont("Poppins", "normal")
  doc.setFontSize(7)
  setText(GRAY)
  doc.text("İLERİ GROUP · İnsan Varlıkları · Form No: IV-FR-03", pageW / 2, y + 9.5, { align: "center" })
  y += 13

  setDraw(PRIMARY)
  doc.setLineWidth(0.4)
  doc.line(margin, y, pageW - margin, y)
  y += 4

  const kol = cw / 3
  field("Tutanak No", data.tutanakNo, margin, y, kol - 4)
  field("Tutanak Tarihi", fmtDate(data.tutanakTarihi), margin + kol, y, kol - 4)
  field("Durum", data.durumEtiketi, margin + kol * 2, y, kol - 4)
  y += 9
  field("Adı Soyadı", data.adSoyad, margin, y, kol - 4)
  field("Sicil No", data.sicilNo ?? "—", margin + kol, y, kol - 4)
  field("Bölüm", data.bolum, margin + kol * 2, y, kol - 4)
  y += 9
  field("Görevi", data.gorev ?? "—", margin, y, kol - 4)
  field("Tutanağı Tutan", data.acanAd, margin + kol, y, kol * 2 - 4)
  y += 10

  // ================= 2) TUTANAK İÇERİĞİ =================
  sectionHeader("TUTANAK İÇERİĞİ")

  doc.setFont("Poppins", "semibold")
  doc.setFontSize(6.4)
  setText(GRAY)
  doc.text("TUTANAK SEBEBİ", margin, y)
  y += 4
  // Sebep seçenekleri iki sütunda; seçili olan işaretli.
  const sutunG = cw / 2
  data.sebepSecenekleri.forEach((s, i) => {
    const x = margin + (i % 2) * sutunG
    const sy = y + Math.floor(i / 2) * 5
    checkbox(x, sy, s.kod === data.sebep)
    doc.setFont("Poppins", s.kod === data.sebep ? "semibold" : "normal")
    doc.setFontSize(8)
    setText(DARK)
    doc.text(s.etiket, x + 4, sy)
  })
  y += Math.ceil(data.sebepSecenekleri.length / 2) * 5 + 3

  doc.setFont("Poppins", "semibold")
  doc.setFontSize(6.4)
  setText(GRAY)
  doc.text("AÇIKLAMA", margin, y)
  y += 4
  doc.setFont("Poppins", "normal")
  doc.setFontSize(8.5)
  setText(DARK)
  const satirlar = doc.splitTextToSize(data.aciklama || "", cw - 4)
  const kutuH = Math.max(satirlar.length * 4.2 + 4, 24)
  setDraw(LINE)
  doc.setLineWidth(0.2)
  doc.rect(margin, y, cw, kutuH)
  satirlar.forEach((s: string, i: number) => doc.text(s, margin + 2, y + 5 + i * 4.2))
  y += kutuH + 6

  // ================= 3) TUTANAK SAHİPLERİ =================
  sectionHeader("TUTANAK SAHİPLERİ")

  const kolW = [40, 52, 36, 26, cw - 154]
  const basliklar = ["ROL", "ADI SOYADI", "BÖLÜM", "KARAR", "TARİH / NOT"]
  setFill([242, 245, 248])
  doc.rect(margin, y, cw, 5.4, "F")
  doc.setFont("Poppins", "semibold")
  doc.setFontSize(6.4)
  setText(PRIMARY)
  let x = margin + 1.5
  basliklar.forEach((b, i) => {
    doc.text(b, x, y + 3.7)
    x += kolW[i]
  })
  y += 5.4

  for (const s of data.sahipler) {
    if (y > pageH - 28) {
      doc.addPage()
      y = margin
    }
    const notMetni = [fmtDateTime(s.kararAt), s.not ?? ""].filter(Boolean).join(" · ")
    const notSatir = doc.splitTextToSize(notMetni, kolW[4] - 3)
    const satirH = Math.max(5.6, notSatir.length * 3.6 + 2.4)

    setDraw([228, 228, 228])
    doc.setLineWidth(0.15)
    doc.line(margin, y + satirH, pageW - margin, y + satirH)

    doc.setFontSize(7.4)
    x = margin + 1.5
    doc.setFont("Poppins", "normal")
    setText(DARK)
    doc.text(doc.splitTextToSize(s.rol, kolW[0] - 3)[0], x, y + 3.9)
    x += kolW[0]
    doc.setFont("Poppins", "semibold")
    doc.text(doc.splitTextToSize(s.adSoyad, kolW[1] - 3)[0], x, y + 3.9)
    x += kolW[1]
    doc.setFont("Poppins", "normal")
    setText(GRAY)
    doc.text(doc.splitTextToSize(s.bolum ?? "—", kolW[2] - 3)[0], x, y + 3.9)
    x += kolW[2]
    doc.setFont("Poppins", "semibold")
    setText(s.karar === "REDDETTI" ? RED : s.karar === "BEKLIYOR" || s.karar === "BILGI" ? GRAY : GREEN)
    doc.text(KARAR_ETIKETLERI[s.karar], x, y + 3.9)
    x += kolW[3]
    doc.setFont("Poppins", "normal")
    doc.setFontSize(6.6)
    setText(GRAY)
    notSatir.forEach((n: string, i: number) => doc.text(n, x, y + 3.5 + i * 3.6))

    y += satirH
  }
  y += 2

  doc.setFont("Poppins", "normal")
  doc.setFontSize(6.4)
  setText(GRAY)
  doc.text(
    "Onaylar ILERIHub üzerinden elektronik ortamda alınmıştır; ıslak imza gerekmez.",
    margin,
    y + 3,
  )

  // ================= 4) ALT BİLGİ =================
  const footerY = pageH - 6
  setDraw([220, 220, 220])
  doc.setLineWidth(0.2)
  doc.line(margin, footerY - 3, pageW - margin, footerY - 3)
  doc.setFont("Poppins", "normal")
  doc.setFontSize(6.6)
  setText(GRAY)
  doc.text("ISO 9001:2015 / IATF 16949   Form No: IV-FR-03", margin, footerY)
  doc.text(`Tutanak No: ${data.tutanakNo}`, pageW / 2, footerY, { align: "center" })
  doc.setFont("Poppins", "semibold")
  setText(RED)
  doc.text("GİZLİ", pageW - margin, footerY, { align: "right" })

  if (watermark) {
    try {
      // @ts-expect-error jsPDF GState çalışma zamanında mevcut
      doc.setGState(new doc.GState({ opacity: 0.08 }))
      doc.setFont("Poppins", "bold")
      doc.setFontSize(64)
      setText([0, 0, 0])
      doc.text("TAMAMLANMADI", pageW / 2, pageH / 2, { align: "center", angle: 38 })
      // @ts-expect-error aynı
      doc.setGState(new doc.GState({ opacity: 1 }))
    } catch {
      // GState yoksa filigran atlanır — PDF yine üretilir.
    }
  }

  return Buffer.from(doc.output("arraybuffer"))
}
