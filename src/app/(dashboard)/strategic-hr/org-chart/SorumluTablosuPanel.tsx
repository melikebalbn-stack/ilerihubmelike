"use client"

// Seçili departmanın OrgSorumluluk (IV-LS-45 sorumlu tablosu) kayıtlarını şema
// üstünde kompakt bir panel olarak gösterir + (hasFullAccess) satır ekleme/silme.
// Ekleme/silme POST /api/strategic-hr/org-chart/sorumluluk ucunu kullanır.
// Personel seçimi VekilAtamaModal'daki arama deseninin (GET /personel-listesi +
// debounce + seçim) aynısı — burada modal yerine inline, iki ayrı alan (1. Sorumlu
// + Yedek) olarak tekrar kullanılıyor.

import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface SorumlulukKaydi {
  id: string
  sira: number
  birinciSorumlu: string
  yedekSorumlu: string | null
}

interface PersonelSonucu {
  id: string
  adSoyad: string
  bolum: string
  bolumDetay: string | null
  gorev: string
  sicilNo: string | null
}

interface SorumluTablosuPanelProps {
  sorumluluklar: SorumlulukKaydi[] | undefined
  orgUnitCode: string | undefined
  hasFullAccess: boolean
  onRefresh?: () => void
}

// Sorumlu tablosu yalnız gerçek departmanlarda anlamlı — kurullar (ORG-KR-*),
// Tüm Firma (ORG-TF, isimsiz envanter) ve Yönetim (ORG-YN, mükerrer) hariç.
const GERCEK_DEPARTMANLAR = new Set([
  "ORG-IV",
  "ORG-FB",
  "ORG-SA",
  "ORG-FN",
  "ORG-MH",
  "ORG-KL",
  "ORG-ST",
  "ORG-AS",
  "ORG-SS",
  "ORG-SG",
])

// Tek bir personel arama+seç alanı — VekilAtamaModal'daki arama mantığının aynısı,
// modal yerine inline (form içinde iki kez kullanılabilsin diye).
function PersonelSeciciAlan({
  label,
  zorunlu,
  secili,
  onSecim,
}: {
  label: string
  zorunlu?: boolean
  secili: PersonelSonucu | null
  onSecim: (p: PersonelSonucu | null) => void
}) {
  const [query, setQuery] = useState("")
  const [sonuclar, setSonuclar] = useState<PersonelSonucu[]>([])
  const [loading, setLoading] = useState(false)
  const [acik, setAcik] = useState(false)

  useEffect(() => {
    if (!acik) return
    const zamanlayici = setTimeout(() => {
      aramaYap(query)
    }, 300)
    return () => clearTimeout(zamanlayici)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, acik])

  const aramaYap = async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/strategic-hr/org-chart/personel-listesi?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setSonuclar(data.personel ?? [])
      } else {
        toast.error("Personel listesi yüklenemedi")
      }
    } catch (err) {
      console.error("Personel arama hatası:", err)
      toast.error("Personel listesi yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label}
        {zorunlu ? " *" : ""}
      </Label>
      {secili ? (
        <div className="flex items-center justify-between border rounded-md px-2 py-1.5 text-sm">
          <span>{secili.adSoyad}</span>
          <button
            type="button"
            onClick={() => {
              onSecim(null)
              setQuery("")
            }}
            className="text-xs text-muted-foreground hover:text-red-600"
          >
            Değiştir
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setAcik(true)
            }}
            onFocus={() => {
              setAcik(true)
              aramaYap(query)
            }}
            placeholder="İsim ara..."
          />
          {acik && (
            <div className="absolute z-10 mt-1 w-full border rounded-md bg-popover max-h-48 overflow-y-auto divide-y shadow-md">
              {loading ? (
                <div className="p-2 text-xs text-muted-foreground text-center">Aranıyor...</div>
              ) : sonuclar.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground text-center">Sonuç yok</div>
              ) : (
                sonuclar.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSecim(p)
                      setAcik(false)
                    }}
                    className="w-full text-left p-2 text-sm hover:bg-accent"
                  >
                    <div>{p.adSoyad}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.bolum}
                      {p.bolumDetay ? ` / ${p.bolumDetay}` : ""} — {p.gorev}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SorumluTablosuPanel({
  sorumluluklar,
  orgUnitCode,
  hasFullAccess,
  onRefresh,
}: SorumluTablosuPanelProps) {
  const [modalAcik, setModalAcik] = useState(false)
  const [birinciSecili, setBirinciSecili] = useState<PersonelSonucu | null>(null)
  const [yedekSecili, setYedekSecili] = useState<PersonelSonucu | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const gercekDepartmanMi = !!orgUnitCode && GERCEK_DEPARTMANLAR.has(orgUnitCode)
  if (!gercekDepartmanMi) return null

  const liste = sorumluluklar ?? []

  // Ekleme formundaki seçimleri sıfırla (modal AÇIK kalır — üstteki liste tazelenir).
  const resetSecim = () => {
    setBirinciSecili(null)
    setYedekSecili(null)
  }

  const handleEkle = async () => {
    if (!birinciSecili) {
      toast.error("1. Sorumlu zorunludur")
      return
    }
    if (!orgUnitCode) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/strategic-hr/org-chart/sorumluluk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgUnitCode,
          birinciSorumlu: birinciSecili.adSoyad,
          yedekSorumlu: yedekSecili?.adSoyad,
        }),
      })

      if (res.status === 403) {
        toast.error("Bu işlem için yetkiniz yok")
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Sorumlu eklenemedi")
        return
      }

      toast.success("Sorumlu eklendi")
      resetSecim()
      onRefresh?.()
    } catch (err) {
      console.error("Sorumlu ekleme hatası:", err)
      toast.error("Sorumlu eklenemedi")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSil = async (id: string) => {
    try {
      const res = await fetch("/api/strategic-hr/org-chart/sorumluluk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sorumlulukId: id, kaldir: true }),
      })

      if (res.status === 403) {
        toast.error("Bu işlem için yetkiniz yok")
        return
      }
      if (!res.ok) {
        toast.error("Sorumlu satırı silinemedi")
        return
      }

      toast.success("Sorumlu satırı silindi")
      onRefresh?.()
    } catch (err) {
      console.error("Sorumlu silme hatası:", err)
      toast.error("Sorumlu satırı silinemedi")
    }
  }

  // Panelde artık tablo YOK — tek buton. Liste + silme + ekleme modalın içinde.
  // Full-access: "+ Sorumlu Ekle" (ekle/sil). Salt-görüntüleme kullanıcısı: liste varsa
  // "Sorumlular" (yalnız okuma) — böylece görüntüleme yeteneği kaybolmaz.
  const butonGoster = hasFullAccess || liste.length > 0

  return (
    <>
      {butonGoster && (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={() => setModalAcik(true)}
        >
          {hasFullAccess ? "+ Sorumlu Ekle" : "Sorumlular"}
        </Button>
      )}

      <Dialog
        open={modalAcik}
        onOpenChange={(o) => {
          setModalAcik(o)
          if (!o) resetSecim()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sorumlular</DialogTitle>
          </DialogHeader>

          {/* Üstte mevcut sorumlular (+ full-access'te × silme) */}
          {liste.length === 0 ? (
            <div className="text-sm text-muted-foreground">Henüz sorumlu yok.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 px-2 text-xs w-12">Sıra</TableHead>
                  <TableHead className="h-8 px-2 text-xs">1. Sorumlu</TableHead>
                  <TableHead className="h-8 px-2 text-xs">Yedek Sorumlu</TableHead>
                  {hasFullAccess && <TableHead className="h-8 px-2 w-8" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="py-1.5 px-2">{s.sira}</TableCell>
                    <TableCell className="py-1.5 px-2">{s.birinciSorumlu}</TableCell>
                    <TableCell className="py-1.5 px-2">{s.yedekSorumlu ?? "—"}</TableCell>
                    {hasFullAccess && (
                      <TableCell className="py-1.5 px-2">
                        <button
                          type="button"
                          onClick={() => handleSil(s.id)}
                          className="text-muted-foreground hover:text-red-600 leading-none"
                          title="Satırı sil"
                        >
                          ×
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Altta ekleme formu (yalnız full-access) */}
          {hasFullAccess && (
            <div className="border-t pt-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Yeni Sorumlu Ekle</div>
              <div className="grid grid-cols-2 gap-2">
                <PersonelSeciciAlan
                  label="1. Sorumlu"
                  zorunlu
                  secili={birinciSecili}
                  onSecim={setBirinciSecili}
                />
                <PersonelSeciciAlan
                  label="Yedek Sorumlu"
                  secili={yedekSecili}
                  onSecim={setYedekSecili}
                />
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleEkle} disabled={submitting}>
                  {submitting ? "Ekleniyor..." : "Ekle"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
