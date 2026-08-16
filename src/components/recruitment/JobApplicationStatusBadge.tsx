"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { JobApplicationStatus } from "@/generated/prisma"
import { STATUS_LABELS_TR } from "@/lib/recruitment/transitions"

// Başvuru statüsü rozeti — TEK KAYNAK.
// Etiket: STATUS_LABELS_TR (transitions.ts) — ayrı bir etiket haritası TUTULMAZ.
// Renk: aşağıdaki harita (eski detay sayfasındaki renklerden taşındı, tüm 18 statüyü kapsar).
//
// Record<JobApplicationStatus, ...> exhaustive: enum'a yeni statü eklenirse burada
// derleme hatası verir (renk atanması unutulmasın).
const STATUS_COLORS: Record<JobApplicationStatus, string> = {
  CONSENT_PENDING: "bg-gray-100 text-gray-700",
  HEALTH_PENDING: "bg-gray-100 text-gray-700",
  PENDING: "bg-yellow-100 text-yellow-800",
  // Top adayda — İV/müdür kademelerinden ayrışsın diye sky (bekleyen.ts ADAY rengiyle aynı aile).
  ADAYA_GERI_GONDERILDI: "bg-sky-100 text-sky-800",
  REVIEWING: "bg-blue-100 text-blue-800",
  REVIEWED: "bg-blue-100 text-blue-800",
  SHORTLISTED: "bg-purple-100 text-purple-800",
  MUDUR_DEGERLENDIRME: "bg-amber-100 text-amber-800",
  MUDUR_MULAKATI: "bg-orange-100 text-orange-800",
  // Mavi yaka zinciri — onay kademesi yükseldikçe koyulaşan tek renk ailesi (amber→orange),
  // müdür kademesiyle akraba ama ayırt edilebilir kalsın diye rose ile taçlanır.
  DEGERLENDIRICI: "bg-amber-50 text-amber-700",
  URETIM_MUDUR_YRD: "bg-orange-100 text-orange-800",
  FABRIKA_MUDURU: "bg-rose-100 text-rose-800",
  INTERVIEW: "bg-indigo-100 text-indigo-800",
  SINAV: "bg-cyan-100 text-cyan-800",
  TELEFON_MULAKATI: "bg-sky-100 text-sky-800",
  IK_MULAKATI: "bg-indigo-100 text-indigo-800",
  TEKNIK_MULAKAT: "bg-teal-100 text-teal-800",
  // 2. kademe: 1. kademeyle aynı renk ailesi, bir ton koyu (kademe yükseldikçe koyulaşır —
  // müdür kademesindeki amber→orange deseninin karşılığı).
  TEKNIK_MULAKAT_UST_ONAY: "bg-teal-200 text-teal-900",
  // Faz 6 — işbaşı öncesi evrak aşaması. Teklif/işbaşı ailesiyle akraba (emerald→green)
  // ama arada bir bekleme adımı olduğu için amber gövdeli.
  EVRAK_HAZIRLIK: "bg-amber-100 text-amber-800",
  TEKLIF: "bg-emerald-100 text-emerald-800",
  TEKLIF_KABUL: "bg-green-100 text-green-800",
  ISE_BASLADI: "bg-green-100 text-green-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
}

export function JobApplicationStatusBadge({
  status,
  className,
}: {
  status: JobApplicationStatus | string
  className?: string
}) {
  const known = status as JobApplicationStatus
  const color = STATUS_COLORS[known] ?? "bg-gray-100 text-gray-800"
  const label = STATUS_LABELS_TR[known] ?? status
  return <Badge className={cn(color, className)}>{label}</Badge>
}

// ── Sınav sonucu rozeti ──────────────────────────────────────────────────────
// Statü rozetiyle AYNI desende (renk haritası + <Badge>), ayrı bir bileşen dosyası
// açılmadan yanına konuldu. Liste ve detay AYNI bileşeni kullanır → iki yerde farklı
// renk/metin oluşamaz.
//
// Kaynak alanlar MEVCUT: AssessmentSession.result/score + CandidateAssessment.passingScore.
// Yeni alan/tablo YOK. `durum` lazy-expiry uygulanmış hâldedir (assessment-session.ts).
//
// NOT — otomatik geçiş YOK: sınav bitince başvurunun STATÜSÜ değişmez. Bu rozet yalnız
// sonucu GÖRÜNÜR yapar; bir sonraki aşamayı her zaman İV seçer.

export type SinavRozetiVeri = {
  durum: string
  puan: number | null
  gecmeNotu: number
  gecti: boolean | null
}

// Sonuçlanmamış oturum durumları için renk + metin. Sonuçlananlar (gecti true/false)
// aşağıda ayrı ele alınır — onlarda puan da gösterilir.
const OTURUM_GORUNUM: Record<string, { renk: string; metin: string }> = {
  ATANDI: { renk: "bg-slate-100 text-slate-700", metin: "Sinav: Atandi" },
  BASLADI: { renk: "bg-slate-100 text-slate-700", metin: "Sinav: Devam ediyor" },
  SURESI_DOLDU: { renk: "bg-slate-100 text-slate-700", metin: "Sinav: Suresi doldu" },
  IPTAL: { renk: "bg-slate-100 text-slate-700", metin: "Sinav: Iptal" },
}

export function SinavSonucBadge({
  rozet,
  className,
}: {
  rozet: SinavRozetiVeri | null | undefined
  className?: string
}) {
  // Oturum yoksa rozet HİÇ çizilmez.
  if (!rozet) return null

  // Sonuçlanmış: geçti/kaldı + puan/geçme notu.
  if (rozet.gecti !== null) {
    const renk = rozet.gecti
      ? "bg-green-100 text-green-800"
      : "bg-red-100 text-red-800"
    const puanKismi = rozet.puan !== null ? ` · ${rozet.puan}/${rozet.gecmeNotu}` : ""
    return (
      <Badge className={cn(renk, className)}>
        {`Sinav: ${rozet.gecti ? "Gecti" : "Kaldi"}${puanKismi}`}
      </Badge>
    )
  }

  // Sonuçlanmamış: nötr rozet, puan yok.
  const g = OTURUM_GORUNUM[rozet.durum]
  if (!g) return null
  return <Badge className={cn(g.renk, className)}>{g.metin}</Badge>
}

// ── Mükerrer (tekrar) başvuru rozeti ────────────────────────────────────────
// Statü/sınav rozetleriyle AYNI desen (renk + <Badge>), ayrı bileşen dosyası açılmadan
// yanlarına konuldu. Veri SUNUCUDAN gelir (mukerrer-basvuru.ts) — client kural yürütmez.
//
// NEDEN EN ESKİ KAYITTA DA ÇIKAR: rozetin işi "bu adayın birden fazla başvurusu var"
// bilgisini vermek. En eski kayıtta gizlense, İV eski bir dosyayı (örn. reddedilmiş bir
// başvuruyu) açtığında adayın yeniden başvurduğunu GÖREMEZDİ — en çok ihtiyaç duyulan an
// tam da orası. Sıra numarası kronolojiyi okunur tutar; "Son başvuru" bilgisi en yeni
// kayda işaret eder.

export type MukerrerRozetVeri = {
  toplam: number
  sira: number
  sonBasvuruTarihi: string
  sonBasvuruStatus: string
}

export function MukerrerBasvuruBadge({
  rozet,
  className,
}: {
  rozet: MukerrerRozetVeri | null | undefined
  className?: string
}) {
  // Tek başvurusu olan adayda sunucu null döner → rozet HİÇ çizilmez.
  if (!rozet || rozet.toplam < 2) return null
  const sonTarih = new Date(rozet.sonBasvuruTarihi).toLocaleDateString("tr-TR")
  const sonStatu =
    STATUS_LABELS_TR[rozet.sonBasvuruStatus as JobApplicationStatus] ?? rozet.sonBasvuruStatus
  return (
    <Badge
      className={cn("bg-violet-100 text-violet-800", className)}
      title={`Bu adayin ${rozet.toplam} basvurusu var. Son basvuru: ${sonTarih} — ${sonStatu}`}
    >
      {`${rozet.sira}. basvuru / ${rozet.toplam}`}
    </Badge>
  )
}
