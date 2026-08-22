"use client"

import { useState, useRef, useEffect } from "react"
import { toast } from "sonner"
import { User, Briefcase, Users, AlertTriangle } from "lucide-react"
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

interface OrgChartNodeProps {
  unit: OrgUnit
  collapsedIds: Set<string>
  onToggleCollapse: (id: string) => void
  hasFullAccess: boolean
  // POSITION kartı tıklama → düzenleme modalı; DEPARTMENT/GROUP → o birimi seç.
  onCardClick: (unit: OrgUnit) => void
  onSelectUnit: (unitId: string) => void
}

function OrgChartNode({
  unit,
  collapsedIds,
  onToggleCollapse,
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
  const isCollapsed = collapsedIds.has(unit.id)

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
    "rounded-lg px-3 py-2 shadow-sm min-w-[160px] text-left",
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
    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
    isVacantPosition
      ? "bg-yellow-100"
      : cinsiyet === "MALE"
        ? "bg-blue-100"
        : cinsiyet === "FEMALE"
          ? "bg-pink-100"
          : "bg-slate-100",
  ].join(" ")

  const avatarIconClasses = [
    "w-5 h-5",
    cinsiyet === "MALE" ? "text-blue-600" : cinsiyet === "FEMALE" ? "text-pink-600" : "text-slate-500",
  ].join(" ")

  return (
    <div className="flex flex-col items-center">
      <div className={boxClasses} onClick={kartTiklama} role="button" tabIndex={0}>
        <div className="flex flex-row items-start gap-2">
          <div className={avatarClasses}>
            {isVacantPosition ? (
              <Briefcase className="w-5 h-5 text-yellow-600" />
            ) : activeCount > 1 ? (
              <Users className={avatarIconClasses} />
            ) : (
              <User className={avatarIconClasses} />
            )}
          </div>
          <div className="flex-1">
            {isVacantPosition ? (
              <>
                <div className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800">
                  Boş Pozisyon
                </div>
                <div className="font-semibold text-sm mt-0.5">{unit.name}</div>
              </>
            ) : isimSatirlari.length > 0 ? (
              <>
                <div className="font-semibold text-sm leading-tight">{unit.name}</div>
                {isimSatirlari.map((satir, i) => (
                  <div
                    key={i}
                    className={[
                      "text-xs mt-0.5 whitespace-nowrap flex items-center gap-1",
                      satir.bagsiz ? "text-amber-700 font-medium" : "text-muted-foreground",
                    ].join(" ")}
                    title={satir.bagsiz ? "Personel kaydına bağlı değil" : undefined}
                  >
                    {satir.bagsiz && (
                      <AlertTriangle
                        className="h-3 w-3 shrink-0 text-amber-600"
                        aria-label="Personel kaydına bağlı değil"
                      />
                    )}
                    {satir.ad}
                  </div>
                ))}
              </>
            ) : (
              <div className="font-semibold text-sm">{unit.name}</div>
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
          <div className="text-[11px] italic text-red-600 mt-1">
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

      {hasChildren && !isCollapsed && (
        <div className="relative flex flex-row items-start before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-px before:h-4 before:bg-gray-300">
          {children.map((child, idx) => {
            const isFirst = idx === 0
            const isLast = idx === children.length - 1
            const isOnly = children.length === 1

            return (
              <div
                key={child.id}
                className={`relative px-4 pt-4 ${childConnectorClasses(isFirst, isLast, isOnly)}`}
              >
                <OrgChartNode
                  unit={child}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={onToggleCollapse}
                  hasFullAccess={hasFullAccess}
                  onCardClick={onCardClick}
                  onSelectUnit={onSelectUnit}
                />
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
    // Birim değişince kaydırma pozisyonu sıfırlansın.
    el.scrollLeft = 0
    if (topBarRef.current) topBarRef.current.scrollLeft = 0
    const ro = new ResizeObserver(olc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [units])

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

      <div ref={scrollRef} onScroll={onContainerScroll} className="overflow-auto w-full max-h-[70vh]">
        <div className="flex flex-row items-start p-4 min-w-fit">
          {units.map((unit) => (
            <div key={unit.id} className="px-4">
              <OrgChartNode
                unit={unit}
                collapsedIds={collapsedIds}
                onToggleCollapse={toggleCollapse}
                hasFullAccess={hasFullAccess}
                onCardClick={(u) => setDuzenleModal(u)}
                onSelectUnit={(id) => onSelectUnit?.(id)}
              />
            </div>
          ))}
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
