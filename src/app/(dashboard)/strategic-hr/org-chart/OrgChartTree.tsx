"use client"

import { useState, useRef, useEffect } from "react"
import { toast } from "sonner"
import { User, Briefcase, Users, AlertTriangle, Printer } from "lucide-react"
import VekilAtamaModal from "./VekilAtamaModal"
import PozisyonDuzenleModal from "./PozisyonDuzenleModal"

// F5.2 — Yatay şema görünümüne CSS pseudo-element bağlantı çizgileri eklendi.
// Sarı dolgu / dış kaynak stili SONRAKİ adımda (G3) — burada yalnız çizgi.
//
// Teknik: klasik "CSS org chart tree connector" deseni. Her çocuk sarmalayıcısı
// kendi ::before (sol yarı yatay) ve ::after (sağ yarı yatay + dikey iniş)
// pseudo-element'lerini taşır; ilk çocukta sol yarı, son çocukta sağ yarı
// bastırılır (kenar düzeltmesi). Tek çocukta ikisi de gizlenir — üst gövdedeki
// tek gövde çizgisi zaten çocuğun tam ortasına denk geldiği için düz iner.
// Üst gövde (trunk), çocuk satırının kendi ::before'u ile parent kutudan iner.
//
// NOT: Tailwind'in JIT tarayıcısı sınıf adlarını kaynak dosyadaki DÜZ METİNDE
// arar — çalışma zamanında `${değişken}` ile birleştirilmiş sınıf adlarını
// GÖRMEZ (üretilen CSS'e hiç girmez). Bu yüzden aşağıdaki tüm sınıf adları
// TAM LİTERAL string olarak yazılmıştır, hiçbiri interpolation içermez.

interface OrgEmployee {
  id: string
  displayName: string
  employmentStatus: string
  orgUnitId: string
  cinsiyet?: "MALE" | "FEMALE" | null
  /** NULL ise koltuk Personnel kaydına bağlı değil — kartta uyarı işareti çıkar. */
  personnelId?: string | null
}

interface OrgUnit {
  id: string
  code?: string
  name: string
  unitType: string
  approvedHeadcount?: number | null
  isExternal?: boolean
  positionStatus?: "AKTIF" | "DONDURULDU" | "PLANLANAN"
  children?: OrgUnit[]
  employees?: OrgEmployee[]
  vekaletDurumu?: boolean
  vekilAdi?: string | null
}

interface OrgChartTreeProps {
  units: OrgUnit[]
  hasFullAccess?: boolean
  onRefresh?: () => void
  // DEPARTMENT/GROUP kartına tıklayınca o birimi seçili yap (dropdown ile aynı etki).
  onSelectUnit?: (unitId: string) => void
}

// page.tsx'teki kadroRozeti ile aynı renk paletiyle tutarlı (bg-X-100 text-X-800).
// approvedHeadcount (N) tanımsızsa (full-access olmayan oturum) rozet gizli kalır — aynı gating.
function kadroRozeti(unit: OrgUnit, m: number): { text: string; cls: string } | null {
  if (unit.unitType !== "POSITION") return null
  if (unit.positionStatus === "DONDURULDU") {
    return { text: "—", cls: "bg-gray-100 text-gray-500" }
  }
  const n = unit.approvedHeadcount
  if (n == null) return null
  if (m === 0) return { text: `0/${n}`, cls: "bg-yellow-100 text-yellow-800" }
  if (m < n) return { text: `${m}/${n}`, cls: "bg-orange-100 text-orange-800" }
  if (m === n) return { text: `${m}/${n}`, cls: "bg-green-100 text-green-800" }
  return { text: `${m}/${n}`, cls: "bg-red-100 text-red-800" }
}

// Her çocuk sarmalayıcısı için ::before/::after sınıflarını üretir (tam literal parçalar).
function childConnectorClasses(isFirst: boolean, isLast: boolean, isOnly: boolean): string {
  if (isOnly) {
    // Tek çocuk: yatay bar gereksiz — gövde çizgisi zaten ortasına iniyor.
    return "before:hidden after:hidden"
  }

  const classes: string[] = [
    // ::before — sol yarı yatay (varsayılan: aktif)
    "before:content-[''] before:absolute before:top-0 before:right-1/2 before:w-1/2 before:h-4",
    "before:border-t before:border-gray-300",
    // ::after — sağ yarı yatay + dikey iniş (varsayılan: aktif)
    "after:content-[''] after:absolute after:top-0 after:left-1/2 after:w-1/2 after:h-4",
    "after:border-t after:border-l after:border-gray-300",
  ]

  if (isFirst) {
    // İlk çocukta soldan gelen yatay segment yok
    classes.push("before:border-t-0")
  }

  if (isLast) {
    // Son çocukta sağa giden yatay segment ve after'ın dikey inişi yok —
    // dikey inişi before'un sağ kenarına (= bu çocuğun ortası) taşı
    classes.push("after:border-t-0 after:border-l-0")
    classes.push("before:border-r before:border-gray-300")
  }

  return classes.join(" ")
}

// GÖRÜNÜM YARDIMCILARI — hiçbiri veriyi değiştirmez.

/** Gruplama ölçütü: upper-TR + fazla boşluk temizliği. */
function normalizeAd(s: string): string {
  return (s ?? "").toLocaleUpperCase("tr-TR").replace(/\s+/g, " ").trim()
}

/** Alt ağaçtaki TOPLAM dolu koltuk (kapalı dal sayacı için). */
function altAgacKoltuk(u: OrgUnit): number {
  const kendi = (u.employees ?? []).filter((e) => e.employmentStatus !== "VACANT").length
  const cocuklar = (u.children ?? []).filter((c) => c.positionStatus !== "DONDURULDU")
  return kendi + cocuklar.reduce((t, c) => t + altAgacKoltuk(c), 0)
}

/**
 * Katmanlı açılım: ilk İKİ kademe açık, derinlik >= 2 olan dallar kapalı başlar.
 * Yalnız görünüm — kapalı dalın altındaki kutular DOM'a hiç basılmaz.
 */
function varsayilanKapaliIdler(kokler: OrgUnit[]): Set<string> {
  const kapali = new Set<string>()
  const gez = (u: OrgUnit, derinlik: number) => {
    const cocuklar = (u.children ?? []).filter((c) => c.positionStatus !== "DONDURULDU")
    if (cocuklar.length > 0 && derinlik >= 2) kapali.add(u.id)
    cocuklar.forEach((c) => gez(c, derinlik + 1))
  }
  kokler.forEach((k) => gez(k, 0))
  return kapali
}

/** Ağaçtaki alt birimi olan tüm kutular (Tümünü kapat için). */
function dalliIdler(kokler: OrgUnit[]): Set<string> {
  const out = new Set<string>()
  const gez = (u: OrgUnit) => {
    const cocuklar = (u.children ?? []).filter((c) => c.positionStatus !== "DONDURULDU")
    if (cocuklar.length > 0) out.add(u.id)
    cocuklar.forEach(gez)
  }
  kokler.forEach(gez)
  return out
}

interface KardesGrubu {
  key: string
  ad: string
  uyeler: OrgUnit[]
}

/**
 * Aynı üst birim altındaki AYNI ADLI yaprak pozisyonları tek gruba toplar.
 * YALNIZ GÖRÜNÜM: DB'de kutular ayrı kalır, hiçbir şey birleştirilmez.
 * Alt birimi olan kutular gruplanmaz (alt ağaç gizlenmesin).
 */
function kardesGruplari(ustId: string, cocuklar: OrgUnit[]): KardesGrubu[] {
  const out: KardesGrubu[] = []
  const indeks = new Map<string, KardesGrubu>()
  cocuklar.forEach((c) => {
    const gruplanabilir =
      c.unitType === "POSITION" &&
      (c.children ?? []).filter((x) => x.positionStatus !== "DONDURULDU").length === 0
    if (!gruplanabilir) { out.push({ key: c.id, ad: c.name, uyeler: [c] }); return }
    const anahtar = `${ustId}|${normalizeAd(c.name)}`
    const mevcut = indeks.get(anahtar)
    if (mevcut) { mevcut.uyeler.push(c); return }
    const g: KardesGrubu = { key: anahtar, ad: c.name, uyeler: [c] }
    indeks.set(anahtar, g)
    out.push(g)
  })
  return out
}

interface OrgChartNodeProps {
  unit: OrgUnit
  derinlik: number
  collapsedIds: Set<string>
  onToggleCollapse: (id: string) => void
  acikGruplar: Set<string>
  onToggleGrup: (key: string) => void
  // Yazdırma: ekrandaki aç/kapa durumundan BAĞIMSIZ olarak her şey açık çizilir.
  // Kullanıcının collapsedIds/acikGruplar state'i değiştirilmez.
  zorlaAcik: boolean
  // Kağıda sığmayan düğümler: çocukları alt alta sayfalanır (ölçüm sonucu).
  bolunenIdler: Set<string>
  hasFullAccess: boolean
  // POSITION kartı tıklama → düzenleme modalı; DEPARTMENT/GROUP → o birimi seç.
  onCardClick: (unit: OrgUnit) => void
  onSelectUnit: (unitId: string) => void
}

function OrgChartNode({
  unit,
  derinlik,
  collapsedIds,
  onToggleCollapse,
  acikGruplar,
  onToggleGrup,
  zorlaAcik,
  bolunenIdler,
  hasFullAccess,
  onCardClick,
  onSelectUnit,
}: OrgChartNodeProps) {
  const activeEmployees = (unit.employees ?? []).filter((e) => e.employmentStatus !== "VACANT")
  const activeCount = activeEmployees.length
  // DONDURULDU pozisyonlar şemadan tamamen gizlenir — Pozisyon Yönetimi panelindeki
  // "Pasif Pozisyonlar" listesi bunları ayrıca gösterir. Yalnız yaprak kutular
  // dondurulabildiği için (backend kısıtı) alt ağaç kaybı riski yok.
  const children = (unit.children ?? []).filter((c) => c.positionStatus !== "DONDURULDU")
  const hasChildren = children.length > 0
  const isCollapsed = zorlaAcik ? false : collapsedIds.has(unit.id)
  const gruplar = kardesGruplari(unit.id, children)
  const kapaliAltKoltuk = isCollapsed
    ? children.reduce((t, c) => t + altAgacKoltuk(c), 0)
    : 0

  // "BOŞ KADRO" + sarı YALNIZ gerçek boş POSITION kadrosunda — DEPARTMENT/GROUP
  // (konteyner, kadro değil) bu görünümü hiç almaz. Liste görünümündeki
  // kadroRozeti mantığıyla aynı: unitType !== "POSITION" → rozet/sarı yok.
  const isVacantPosition =
    unit.unitType === "POSITION" && (unit.approvedHeadcount ?? 0) > 0 && activeCount === 0
  // Çok kişili kutularda her isim kendi satırında (virgülle yan yana değil).
  // Boş kadro artık "BOŞ KADRO" metni yerine ayrı bir rozetle gösteriliyor (aşağıda).
  // Personele bağlı olmayan koltuklar (personnelId NULL) uyarı işaretiyle gösterilir.
  // İstisna YOK: dış kaynak/şirket kaydı olsa da işaret çıkar, kararı İK verir.
  const isimSatirlari = activeCount > 0
    ? activeEmployees.map((e) => ({ ad: e.displayName, bagsiz: !e.personnelId }))
    : []
  const bagsizVar = isimSatirlari.some((x) => x.bagsiz)
  const rozet = kadroRozeti(unit, activeCount)

  // Tüm işlemler (kişi ata/çıkar, vekil, pozisyon çıkar) artık POSITION kartına tıklayınca
  // açılan düzenleme modalında. DEPARTMENT/GROUP kartına tıklama o birimi seçer.
  const isPosition = unit.unitType === "POSITION"
  const kartTiklama = () => {
    if (isPosition) onCardClick(unit)
    else onSelectUnit(unit.id)
  }

  const boxClasses = [
    // Genişlik ölçümle seçildi (prod, 300 POSITION): unvan uzunluğu ort 22 /
    // medyan 21 / p90 33 / p95 37 / max 42 karakter; kişi adı p90 17 / max 24.
    // 208px kart → metin sütunu ~154px; 12px yazıda satır başına ~25 karakter,
    // iki satırda ~50 karakter → p95 dahil tüm unvanlar kırpılmadan sığar.
    "rounded-lg px-2 py-1.5 shadow-sm min-w-[180px] max-w-[208px] text-left",
    "print:break-inside-avoid",
    "cursor-pointer hover:ring-2 hover:ring-blue-300 transition-shadow",
    isVacantPosition
      ? "border-2 border-dashed border-yellow-400 bg-yellow-50"
      : "border border-gray-200 bg-card",
  ].join(" ")

  // Avatar cinsiyete göre: boş kadroda sarı daire + çanta (Briefcase). Doluda TEK kişi
  // varsa o kişinin cinsiyetine göre renk (MALE→mavi, FEMALE→pembe, yoksa/eşleşmeyen→gri
  // nötr); ÇOK kişili kutuda (ör. operatör grubu) tek cinsiyet göstermek yanıltıcı olacağı
  // için nötr grup görünümü kullanılır.
  const tekKisi = activeCount === 1 ? activeEmployees[0] : null
  const cinsiyet = tekKisi?.cinsiyet ?? null

  const avatarClasses = [
    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
    isVacantPosition
      ? "bg-yellow-100"
      : cinsiyet === "MALE"
        ? "bg-blue-100"
        : cinsiyet === "FEMALE"
          ? "bg-pink-100"
          : "bg-slate-100",
  ].join(" ")

  const avatarIconClasses = [
    "w-4 h-4",
    cinsiyet === "MALE" ? "text-blue-600" : cinsiyet === "FEMALE" ? "text-pink-600" : "text-slate-500",
  ].join(" ")

  const bolunuyor = bolunenIdler.has(unit.id)

  return (
    <div className="flex flex-col items-center" data-dugum={unit.id}>
      <div className={boxClasses} onClick={kartTiklama} role="button" tabIndex={0}>
        <div className="flex flex-row items-start gap-1.5">
          <div className={avatarClasses}>
            {isVacantPosition ? (
              <Briefcase className="w-4 h-4 text-yellow-600" />
            ) : activeCount > 1 ? (
              <Users className={avatarIconClasses} />
            ) : (
              <User className={avatarIconClasses} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isVacantPosition ? (
              <>
                <div className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800">
                  Boş Pozisyon
                </div>
                <div className="font-semibold text-xs leading-snug mt-0.5 line-clamp-2" title={unit.name}>
                  {unit.name}
                </div>
              </>
            ) : isimSatirlari.length > 0 ? (
              <>
                <div className="font-semibold text-xs leading-snug line-clamp-2" title={unit.name}>
                  {unit.name}
                </div>
                {isimSatirlari.map((satir, i) => (
                  <div
                    key={i}
                    className={[
                      "text-[11px] mt-0.5 min-w-0 flex items-center gap-1",
                      satir.bagsiz ? "text-amber-700 font-medium" : "text-muted-foreground",
                    ].join(" ")}
                    title={satir.bagsiz ? `${satir.ad} — personel kaydına bağlı değil` : satir.ad}
                  >
                    {satir.bagsiz && (
                      <AlertTriangle
                        className="h-3 w-3 shrink-0 text-amber-600"
                        aria-label="Personel kaydına bağlı değil"
                      />
                    )}
                    <span className="truncate print:font-semibold">{satir.ad}</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="font-semibold text-xs leading-snug line-clamp-2" title={unit.name}>
                {unit.name}
              </div>
            )}
          </div>
        </div>
        {bagsizVar && (
          <div className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
            Personel kaydına bağlı değil
          </div>
        )}
        {unit.isExternal && (
          <div className="text-[10px] text-slate-500 mt-1">(Dış Kaynak)</div>
        )}
        {unit.vekaletDurumu === true && (
          <div
            className="text-[10px] italic text-red-600 mt-1 truncate"
            title={`Vekaleten: ${unit.vekilAdi || "(atanmadı)"}`}
          >
            Vekaleten: {unit.vekilAdi || "(atanmadı)"}
          </div>
        )}
        {rozet && (
          <div className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${rozet.cls}`}>
            {rozet.text}
          </div>
        )}
      </div>

      {hasChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse(unit.id)
          }}
          aria-label={isCollapsed ? "Dalı aç" : "Dalı kapat"}
          title={isCollapsed ? "Dalı aç" : "Dalı kapat"}
          className="mt-1 w-5 h-5 rounded-full border border-gray-300 bg-white text-xs leading-none flex items-center justify-center text-gray-600 hover:bg-gray-100"
        >
          {isCollapsed ? "+" : "−"}
        </button>
      )}

      {hasChildren && isCollapsed && kapaliAltKoltuk > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse(unit.id)
          }}
          title={`Bu dalda ${kapaliAltKoltuk} kişi gizli — açmak için tıkla`}
          className="mt-1 text-[10px] text-blue-600 hover:underline"
        >
          + {kapaliAltKoltuk} kişi
        </button>
      )}

      {hasChildren && !isCollapsed && (
        <div
          className={[
            "relative flex flex-row items-start",
            "before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-px before:h-4 before:bg-gray-300",
            // Kağıda sığmayan düğümlerin çocukları yazdırmada alt alta sayfalanır;
            // böylece ölçek tüm ağaca değil sayfaya sığan EN GENİŞ BÖLÜME göre
            // hesaplanır ve yazı okunur kalır. Bölünme noktaları ÖLÇÜLEREK seçilir.
            // Yerleşim globals.css'teki data-öznitelik kurallarıyla yapılır:
            // oradaki `.flex { display: flex !important }` Tailwind print: sınıflarını eziyor.
            bolunuyor ? "print:before:hidden" : "",
          ].join(" ")}
          data-bolum-kabi={bolunuyor ? "1" : undefined}
        >
          {gruplar.map((grup, idx) => {
            const isFirst = idx === 0
            const isLast = idx === gruplar.length - 1
            const isOnly = gruplar.length === 1
            const anaDal = bolunuyor
            const sarmalayici = [
              "relative px-3 pt-4",
              childConnectorClasses(isFirst, isLast, isOnly),
              anaDal ? "print:before:hidden print:after:hidden" : "",
            ].join(" ")

            // Tek üyeli grup = normal kutu (tek kişilik unvanlar gruplanmaz).
            if (grup.uyeler.length === 1) {
              const child = grup.uyeler[0]
              return (
                <div
                  key={child.id}
                  className={sarmalayici}
                  data-dal-koku={anaDal ? "1" : undefined}
                  data-ilk-dal={anaDal && isFirst ? "1" : undefined}
                >
                  <OrgChartNode
                    unit={child}
                    derinlik={derinlik + 1}
                    collapsedIds={collapsedIds}
                    onToggleCollapse={onToggleCollapse}
                    acikGruplar={acikGruplar}
                    onToggleGrup={onToggleGrup}
                    zorlaAcik={zorlaAcik}
                    bolunenIdler={bolunenIdler}
                    hasFullAccess={hasFullAccess}
                    onCardClick={onCardClick}
                    onSelectUnit={onSelectUnit}
                  />
                </div>
              )
            }

            // ÇOK ÜYELİ GRUP — yalnız görünüm. Kapalıyken tek kart, açıkken
            // üyelerin her biri kendi kutusuyla (tüm işlemler kutu bazında kalır).
            const grupAcik = zorlaAcik || acikGruplar.has(grup.key)
            const grupKisi = grup.uyeler.reduce(
              (t, u) => t + (u.employees ?? []).filter((e) => e.employmentStatus !== "VACANT").length,
              0,
            )
            const grupBagsiz = grup.uyeler.some((u) =>
              (u.employees ?? []).some((e) => e.employmentStatus !== "VACANT" && !e.personnelId),
            )
            const grupBos = grup.uyeler.filter(
              (u) => (u.employees ?? []).filter((e) => e.employmentStatus !== "VACANT").length === 0,
            ).length

            return (
              <div
                key={grup.key}
                className={sarmalayici}
                data-dal-koku={anaDal ? "1" : undefined}
                data-ilk-dal={anaDal && isFirst ? "1" : undefined}
              >
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => onToggleGrup(grup.key)}
                    aria-expanded={grupAcik}
                    data-grup-karti={grup.uyeler.length}
                    title={`${grup.ad} — ${grup.uyeler.length} kutu, ${grupKisi} kişi (${grupAcik ? "kapat" : "aç"})`}
                    className="rounded-lg px-2 py-1.5 shadow-sm min-w-[180px] max-w-[208px] text-left border border-slate-300 bg-slate-50 cursor-pointer hover:ring-2 hover:ring-blue-300 transition-shadow print:break-inside-avoid"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold leading-snug text-gray-900 line-clamp-2" title={grup.ad}>
                          {grup.ad}
                        </div>
                        <div className="text-[11px] text-gray-600">
                          {grupKisi} kişi{grupBos > 0 ? ` · ${grupBos} boş` : ""}
                        </div>
                      </div>
                      {grupBagsiz && (
                        <AlertTriangle
                          className="h-3 w-3 shrink-0 text-amber-600"
                          aria-label="Personel kaydına bağlı olmayan koltuk var"
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-blue-600 mt-0.5 print:hidden">
                      {grupAcik ? "− kapat" : `+ ${grup.uyeler.length} kutu`}
                    </div>
                  </button>

                  {grupAcik && (
                    <div className="relative flex flex-row items-start pt-3 before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-px before:h-3 before:bg-gray-300">
                      {grup.uyeler.map((u, i) => (
                        <div
                          key={u.id}
                          className={`relative px-2 pt-3 ${childConnectorClasses(i === 0, i === grup.uyeler.length - 1, grup.uyeler.length === 1)}`}
                        >
                          <OrgChartNode
                            unit={u}
                            derinlik={derinlik + 1}
                            collapsedIds={collapsedIds}
                            onToggleCollapse={onToggleCollapse}
                            acikGruplar={acikGruplar}
                            onToggleGrup={onToggleGrup}
                            zorlaAcik={zorlaAcik}
                            bolunenIdler={bolunenIdler}
                            hasFullAccess={hasFullAccess}
                            onCardClick={onCardClick}
                            onSelectUnit={onSelectUnit}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function OrgChartTree({ units, hasFullAccess = false, onRefresh, onSelectUnit }: OrgChartTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  // Grup açılımı yalnız oturum içi state — localStorage/kalıcı kayıt YOK.
  const [acikGruplar, setAcikGruplar] = useState<Set<string>>(new Set())
  const [merkezleIstegi, setMerkezleIstegi] = useState(0)
  // Yazdırma: ekran state'i korunur, çizim geçici olarak tam açık yapılır.
  const [yazdirmaModu, setYazdirmaModu] = useState(false)
  const [yazdirmaOlcegi, setYazdirmaOlcegi] = useState(1)
  const [bolunenIdler, setBolunenIdler] = useState<Set<string>>(new Set())
  const [atamaModal, setAtamaModal] = useState<{ unit: OrgUnit; mode: "vekil" | "uye" } | null>(null)
  const [duzenleModal, setDuzenleModal] = useState<OrgUnit | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Üst yatay kaydırma barı: ana kap ile çift-yönlü senkron; yalnız içerik taşarken görünür.
  const scrollRef = useRef<HTMLDivElement>(null)
  const topBarRef = useRef<HTMLDivElement>(null)
  const [tasiyor, setTasiyor] = useState(false)
  const [icerikGenislik, setIcerikGenislik] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const olc = () => {
      setIcerikGenislik(el.scrollWidth)
      setTasiyor(el.scrollWidth > el.clientWidth + 1)
    }
    olc()
    const ro = new ResizeObserver(olc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [units])

  // Birim değişince: katmanlı varsayılan (ilk iki kademe açık) + grup açılımları sıfır.
  useEffect(() => {
    setCollapsedIds(varsayilanKapaliIdler(units))
    setAcikGruplar(new Set())
    setMerkezleIstegi((n) => n + 1)
  }, [units])

  // Kök kart yatayda ortada: şema kökten aşağı simetrik büyüdüğü için scrollLeft=0
  // ilk açılışta boş sol kenarı gösteriyordu. Ortalama → kök kart her zaman görünür.
  useEffect(() => {
    if (merkezleIstegi === 0) return
    const kare = requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      const hedef = Math.max(0, Math.round((el.scrollWidth - el.clientWidth) / 2))
      el.scrollLeft = hedef
      if (topBarRef.current) topBarRef.current.scrollLeft = hedef
    })
    return () => cancelAnimationFrame(kare)
  }, [merkezleIstegi])

  const onContainerScroll = () => {
    if (topBarRef.current && scrollRef.current) topBarRef.current.scrollLeft = scrollRef.current.scrollLeft
  }
  const onTopScroll = () => {
    if (topBarRef.current && scrollRef.current) scrollRef.current.scrollLeft = topBarRef.current.scrollLeft
  }

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleGrup = (key: string) => {
    setAcikGruplar((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // A4 yatay, 8mm kenar boşluğu → kullanılabilir genişlik ≈ 281mm ≈ 1062px @96dpi.
  const YAZDIRMA_GENISLIGI = 1062

  const yazdir = () => setYazdirmaModu(true)

  // Tam açık çizim DOM'a bastıktan sonra: (1) sayfaya sığmayan düğümleri ÖLÇ ve
  // bölünme noktalarını seç, (2) ölçeği en geniş bölüme göre hesapla, (3) yazdır.
  useEffect(() => {
    if (!yazdirmaModu) return
    document.body.classList.add("org-yazdir")

    const zamanlayici = setTimeout(() => {
      const el = scrollRef.current
      if (!el) { window.print(); return }

      const genislikler = new Map<string, number>()
      el.querySelectorAll<HTMLElement>("[data-dugum]").forEach((d) => {
        genislikler.set(d.dataset.dugum ?? "", d.getBoundingClientRect().width)
      })

      // Sayfaya sığmayan düğüme in: çocukları ayrı sayfalara bölünür.
      const bolunen = new Set<string>()
      let enGenisBolum = 0
      const gez = (u: OrgUnit) => {
        const g = genislikler.get(u.id) ?? 0
        const cocuklar = (u.children ?? []).filter((c) => c.positionStatus !== "DONDURULDU")
        if (g <= YAZDIRMA_GENISLIGI || cocuklar.length === 0) {
          enGenisBolum = Math.max(enGenisBolum, g)
          return
        }
        // Bölünen düğümün kendi kartı tek başına kalır (kart genişliği < sayfa),
        // çocukları ayrı sayfalara iner.
        bolunen.add(u.id)
        cocuklar.forEach(gez)
      }
      units.forEach(gez)
      // Hiçbir bölüm ölçülemediyse tüm ağaca göre ölçekle (güvenli varsayılan).
      if (enGenisBolum === 0) enGenisBolum = el.scrollWidth

      setBolunenIdler(bolunen)
      setYazdirmaOlcegi(Math.min(1, YAZDIRMA_GENISLIGI / enGenisBolum))
      requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
    }, 300)

    return () => clearTimeout(zamanlayici)
  }, [yazdirmaModu, units])

  useEffect(() => {
    const bitti = () => {
      setYazdirmaModu(false)
      setYazdirmaOlcegi(1)
      setBolunenIdler(new Set())
      document.body.classList.remove("org-yazdir")
    }
    window.addEventListener("afterprint", bitti)
    return () => {
      window.removeEventListener("afterprint", bitti)
      document.body.classList.remove("org-yazdir")
    }
  }, [])

  const tumunuAc = () => {
    setCollapsedIds(new Set())
    setMerkezleIstegi((n) => n + 1)
  }
  const tumunuKapat = () => {
    // Kökler açık kalır (yoksa ekran tamamen boşalır), altı kapanır.
    const hepsi = dalliIdler(units)
    units.forEach((u) => hepsi.delete(u.id))
    setCollapsedIds(hepsi)
    setAcikGruplar(new Set())
    setMerkezleIstegi((n) => n + 1)
  }

  const handleRemoveVekil = async (unit: OrgUnit) => {
    try {
      const res = await fetch("/api/strategic-hr/org-chart/vekil-ata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgUnitId: unit.id, kaldir: true }),
      })
      if (res.status === 403) { toast.error("Bu işlem için yetkiniz yok"); return }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Vekalet kaldırılamadı"); return
      }
      toast.success("Vekalet kaldırıldı")
      onRefresh?.()
    } catch (err) {
      console.error("Vekalet kaldırma hatası:", err)
      toast.error("Vekalet kaldırılamadı")
    }
  }

  // Kişiyi çıkar → uye-ata {kaldir:true}. Yıkıcı; onay modalda alınır.
  const handleKisiCikar = async (unit: OrgUnit, orgEmployeeId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch("/api/strategic-hr/org-chart/uye-ata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgUnitId: unit.id, orgEmployeeId, kaldir: true }),
      })
      if (res.status === 403) { toast.error("Bu işlem için yetkiniz yok"); return }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Kişi çıkarılamadı"); return
      }
      toast.success("Kişi pozisyondan çıkarıldı")
      setDuzenleModal(null)
      onRefresh?.()
    } catch (err) {
      console.error("Kişi çıkarma hatası:", err)
      toast.error("Kişi çıkarılamadı")
    } finally {
      setSubmitting(false)
    }
  }

  // Pozisyonu çıkar (dondur) → pozisyon-cikar {gerekce}. Gerekçe modalda zorunlu.
  const handlePozisyonCikar = async (unit: OrgUnit, gerekce: string) => {
    setSubmitting(true)
    try {
      const res = await fetch("/api/strategic-hr/org-chart/pozisyon-cikar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgUnitId: unit.id, gerekce }),
      })
      if (res.status === 403) { toast.error("Bu işlem için yetkiniz yok"); return }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Pozisyon çıkarılamadı"); return
      }
      toast.success("Pozisyon pasife çekildi")
      setDuzenleModal(null)
      onRefresh?.()
    } catch (err) {
      console.error("Pozisyon çıkarma hatası:", err)
      toast.error("Pozisyon çıkarılamadı")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 px-4 pt-2 pb-1 print:hidden">
        <button
          type="button"
          onClick={tumunuAc}
          className="text-xs px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          Tümünü aç
        </button>
        <button
          type="button"
          onClick={tumunuKapat}
          className="text-xs px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          Tümünü kapat
        </button>
        <button
          type="button"
          onClick={yazdir}
          disabled={yazdirmaModu}
          className="text-xs px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-1"
        >
          <Printer className="h-3.5 w-3.5" />
          {yazdirmaModu ? "Hazırlanıyor…" : "Yazdır"}
        </button>
        <span className="text-[11px] text-gray-500">
          Aynı unvanlı kutular tek kartta toplanır — kart yalnız görünümdür, kayıtlar ayrıdır.
        </span>
      </div>

      {/* Üst yatay kaydırma barı — sticky, yalnız taşarken. Ana kapla senkron. */}
      {tasiyor && (
        <div
          ref={topBarRef}
          onScroll={onTopScroll}
          className="overflow-x-auto overflow-y-hidden sticky top-0 z-10 bg-card border-b"
          aria-hidden
        >
          <div style={{ width: icerikGenislik }} className="h-3" />
        </div>
      )}

      <div
        id="org-yazdir-alani"
        style={{ ["--org-olcek" as string]: String(yazdirmaOlcegi) } as React.CSSProperties}
      >
        {/* Yalnız kağıtta görünen üst bilgi */}
        <div className="hidden print:block mb-3 border-b border-gray-400 pb-2">
          <div className="text-base font-bold">{units[0]?.name ?? "Organizasyon Şeması"}</div>
          <div className="text-xs text-gray-700">
            İleri Group · Organizasyon Şeması · {new Date().toLocaleDateString("tr-TR")}
          </div>
        </div>

      <div
        ref={scrollRef}
        onScroll={onContainerScroll}
        className="overflow-auto w-full max-h-[70vh] print:max-h-none print:overflow-visible"
      >
        <div className="flex flex-row items-start p-4 min-w-fit">
          {units.map((unit) => (
            <div key={unit.id} className="px-4">
              <OrgChartNode
                unit={unit}
                derinlik={0}
                collapsedIds={collapsedIds}
                onToggleCollapse={toggleCollapse}
                acikGruplar={acikGruplar}
                onToggleGrup={toggleGrup}
                zorlaAcik={yazdirmaModu}
                bolunenIdler={bolunenIdler}
                hasFullAccess={hasFullAccess}
                onCardClick={(u) => setDuzenleModal(u)}
                onSelectUnit={(id) => onSelectUnit?.(id)}
              />
            </div>
          ))}
        </div>
      </div>
      </div>

      {atamaModal && (
        <VekilAtamaModal
          open={!!atamaModal}
          onOpenChange={(open) => { if (!open) setAtamaModal(null) }}
          orgUnitId={atamaModal.unit.id}
          unitName={atamaModal.unit.name}
          mode={atamaModal.mode}
          onAssigned={() => { setAtamaModal(null); onRefresh?.() }}
        />
      )}

      <PozisyonDuzenleModal
        unit={duzenleModal}
        hasFullAccess={hasFullAccess}
        submitting={submitting}
        onClose={() => setDuzenleModal(null)}
        onAtaDegistir={() => { const u = duzenleModal; setDuzenleModal(null); if (u) setAtamaModal({ unit: u, mode: "uye" }) }}
        onVekilAta={() => { const u = duzenleModal; setDuzenleModal(null); if (u) setAtamaModal({ unit: u, mode: "vekil" }) }}
        onVekilKaldir={() => { const u = duzenleModal; setDuzenleModal(null); if (u) handleRemoveVekil(u) }}
        onKisiCikar={(orgEmployeeId) => { if (duzenleModal) handleKisiCikar(duzenleModal, orgEmployeeId) }}
        onPozisyonCikar={(gerekce) => { if (duzenleModal) handlePozisyonCikar(duzenleModal, gerekce) }}
      />
    </div>
  )
}
