"use client"

// Merkezi "Pozisyon Yönetimi" paneli — sorumlu tablosu panelinin aynı deseni
// (kompakt, dar, varsayılan kapalı formlar). Kutu-içi butonlar yerine TEK yerden:
// departmandaki herhangi bir kutunun altına pozisyon ekle, yaprak+boş bir
// pozisyonu (gerekçeyle) pasife çek, pasif pozisyonları listele/aktifleştir.
// Backend uçları (pozisyon-ekle, pozisyon-cikar) DEĞİŞMEDİ — bu bileşen yalnız
// onları çağırıyor. DONDURULDU pozisyonlar OrgChartTree'de şemadan gizlendiği
// için "Pasif Pozisyonlar" bölümü bunları görebileceğimiz TEK yer.

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface DepartmanUnit {
  id: string
  code?: string
  name: string
  unitType: string
  positionStatus?: "AKTIF" | "DONDURULDU" | "PLANLANAN"
  children?: DepartmanUnit[]
  employees?: { employmentStatus: string }[]
  dondurmaGerekce?: string | null
  dondurmaTarihi?: string | null
  dondurmaYapan?: string | null
}

interface PozisyonYonetimPanelProps {
  departmanUnitlari: DepartmanUnit[]
  orgUnitCode: string | undefined
  hasFullAccess: boolean
  onRefresh?: () => void
}

// Sorumlu tablosu paneliyle AYNI görünürlük kuralı — kurullar/Tüm Firma/Yönetim hariç.
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

function birimEtiketi(u: DepartmanUnit): string {
  return u.code ? `${u.name} (${u.code})` : u.name
}

export default function PozisyonYonetimPanel({
  departmanUnitlari,
  orgUnitCode,
  hasFullAccess,
  onRefresh,
}: PozisyonYonetimPanelProps) {
  const [ekleFormAcik, setEkleFormAcik] = useState(false)
  const [cikarFormAcik, setCikarFormAcik] = useState(false)
  const [pasifListeAcik, setPasifListeAcik] = useState(false)

  const [ekleParentId, setEkleParentId] = useState("")
  const [ekleUnvan, setEkleUnvan] = useState("")
  const [ekleKadro, setEkleKadro] = useState("1")
  const [ekleSubmitting, setEkleSubmitting] = useState(false)

  const [cikarOrgUnitId, setCikarOrgUnitId] = useState("")
  const [cikarGerekce, setCikarGerekce] = useState("")
  const [cikarSubmitting, setCikarSubmitting] = useState(false)

  const [aktifEtSubmittingId, setAktifEtSubmittingId] = useState<string | null>(null)

  const gercekDepartmanMi = !!orgUnitCode && GERCEK_DEPARTMANLAR.has(orgUnitCode)
  if (!gercekDepartmanMi) return null

  // Çıkar (dondur) adayları: POSITION + yaprak (children yok) + boş (M=0) + AKTIF —
  // backend pozisyon-cikar'ın kabul ettiği kutularla birebir aynı süzgeç.
  const dondurulabilirler = departmanUnitlari.filter((u) => {
    if (u.unitType !== "POSITION") return false
    if (u.positionStatus === "DONDURULDU") return false
    if (u.children && u.children.length > 0) return false
    const m = (u.employees ?? []).filter((e) => e.employmentStatus !== "VACANT").length
    return m === 0
  })

  const pasifPozisyonlar = departmanUnitlari.filter(
    (u) => u.unitType === "POSITION" && u.positionStatus === "DONDURULDU"
  )

  const ekleFormuKapat = () => {
    setEkleFormAcik(false)
    setEkleParentId("")
    setEkleUnvan("")
    setEkleKadro("1")
  }

  const cikarFormuKapat = () => {
    setCikarFormAcik(false)
    setCikarOrgUnitId("")
    setCikarGerekce("")
  }

  const handleEkle = async () => {
    if (!ekleParentId) {
      toast.error("Üst pozisyon seçin")
      return
    }
    if (!ekleUnvan.trim()) {
      toast.error("Unvan zorunludur")
      return
    }

    setEkleSubmitting(true)
    try {
      const res = await fetch("/api/strategic-hr/org-chart/pozisyon-ekle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: ekleParentId,
          name: ekleUnvan.trim(),
          approvedHeadcount: ekleKadro ? parseInt(ekleKadro, 10) : 1,
        }),
      })

      if (res.status === 403) {
        toast.error("Bu işlem için yetkiniz yok")
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Pozisyon eklenemedi")
        return
      }

      const data = await res.json()
      toast.success(`Pozisyon eklendi: ${data.code}`)
      ekleFormuKapat()
      onRefresh?.()
    } catch (err) {
      console.error("Pozisyon ekleme hatası:", err)
      toast.error("Pozisyon eklenemedi")
    } finally {
      setEkleSubmitting(false)
    }
  }

  const handlePasifeCek = async () => {
    if (!cikarOrgUnitId) {
      toast.error("Pozisyon seçin")
      return
    }
    if (!cikarGerekce.trim()) {
      toast.error("Gerekçe zorunludur")
      return
    }

    setCikarSubmitting(true)
    try {
      const res = await fetch("/api/strategic-hr/org-chart/pozisyon-cikar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgUnitId: cikarOrgUnitId, gerekce: cikarGerekce.trim() }),
      })

      if (res.status === 403) {
        toast.error("Bu işlem için yetkiniz yok")
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Pozisyon dondurulamadı")
        return
      }

      toast.success("Pozisyon pasife çekildi")
      cikarFormuKapat()
      onRefresh?.()
    } catch (err) {
      console.error("Pozisyon dondurma hatası:", err)
      toast.error("Pozisyon dondurulamadı")
    } finally {
      setCikarSubmitting(false)
    }
  }

  const handleAktifEt = async (orgUnitId: string) => {
    setAktifEtSubmittingId(orgUnitId)
    try {
      const res = await fetch("/api/strategic-hr/org-chart/pozisyon-cikar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgUnitId, aktifEt: true }),
      })

      if (res.status === 403) {
        toast.error("Bu işlem için yetkiniz yok")
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Pozisyon aktifleştirilemedi")
        return
      }

      toast.success("Pozisyon aktifleştirildi")
      onRefresh?.()
    } catch (err) {
      console.error("Pozisyon aktifleştirme hatası:", err)
      toast.error("Pozisyon aktifleştirilemedi")
    } finally {
      setAktifEtSubmittingId(null)
    }
  }

  if (!hasFullAccess) return null

  return (
    <div className="w-full border rounded-md overflow-hidden text-sm">
      <div className="bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-900">Pozisyon Yönetimi</div>

      <div className="px-2 py-1.5 space-y-1.5">
        {/* Pozisyon Ekle */}
        {ekleFormAcik ? (
          <div className="space-y-1.5 border rounded-md p-2">
            <div>
              <Label className="text-xs">Üst Pozisyon</Label>
              <Select value={ekleParentId} onValueChange={setEkleParentId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Kutu seçin" />
                </SelectTrigger>
                <SelectContent>
                  {departmanUnitlari.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {birimEtiketi(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Unvan *</Label>
              <Input
                className="h-8 text-xs"
                value={ekleUnvan}
                onChange={(e) => setEkleUnvan(e.target.value)}
                placeholder="ör. Kalite Sorumlusu"
              />
            </div>
            <div>
              <Label className="text-xs">Onaylı Kadro</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                min={1}
                value={ekleKadro}
                onChange={(e) => setEkleKadro(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={ekleFormuKapat}>
                İptal
              </Button>
              <Button size="sm" onClick={handleEkle} disabled={ekleSubmitting}>
                {ekleSubmitting ? "Ekleniyor..." : "Ekle"}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEkleFormAcik(true)}
            className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50"
          >
            + Pozisyon Ekle
          </button>
        )}

        {/* Pozisyon Çıkar (dondur) — gerekçe zorunlu */}
        {cikarFormAcik ? (
          <div className="space-y-1.5 border rounded-md p-2">
            <div>
              <Label className="text-xs">Pozisyon (yaprak + boş)</Label>
              <Select value={cikarOrgUnitId} onValueChange={setCikarOrgUnitId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Kutu seçin" />
                </SelectTrigger>
                <SelectContent>
                  {dondurulabilirler.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Uygun kutu yok</div>
                  ) : (
                    dondurulabilirler.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {birimEtiketi(u)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Gerekçe *</Label>
              <Input
                className="h-8 text-xs"
                value={cikarGerekce}
                onChange={(e) => setCikarGerekce(e.target.value)}
                placeholder="ör. Bütçe kısıtı, iş hacmi düşüşü..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cikarFormuKapat}>
                İptal
              </Button>
              <Button
                size="sm"
                onClick={handlePasifeCek}
                disabled={cikarSubmitting || !cikarOrgUnitId || !cikarGerekce.trim()}
              >
                {cikarSubmitting ? "İşleniyor..." : "Pasife Çek"}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCikarFormAcik(true)}
            className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Pozisyon Çıkar
          </button>
        )}

        {/* Pasif Pozisyonlar — DONDURULDU olanlar şemadan gizli, tek görünüm burası */}
        {pasifListeAcik ? (
          <div className="space-y-1.5 border rounded-md p-2">
            {pasifPozisyonlar.length === 0 ? (
              <div className="text-xs text-muted-foreground">Pasif pozisyon yok</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-7 px-2 text-xs">Pozisyon</TableHead>
                    <TableHead className="h-7 px-2 text-xs">Gerekçe</TableHead>
                    <TableHead className="h-7 px-2 text-xs">Tarih</TableHead>
                    <TableHead className="h-7 px-2 text-xs">Yapan</TableHead>
                    <TableHead className="h-7 px-2 w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pasifPozisyonlar.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="py-1 px-2">{u.name}</TableCell>
                      <TableCell className="py-1 px-2">{u.dondurmaGerekce ?? "—"}</TableCell>
                      <TableCell className="py-1 px-2">
                        {u.dondurmaTarihi ? new Date(u.dondurmaTarihi).toLocaleDateString("tr-TR") : "—"}
                      </TableCell>
                      <TableCell className="py-1 px-2">{u.dondurmaYapan ?? "—"}</TableCell>
                      <TableCell className="py-1 px-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAktifEt(u.id)}
                          disabled={aktifEtSubmittingId === u.id}
                        >
                          {aktifEtSubmittingId === u.id ? "..." : "Aktif Et"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setPasifListeAcik(false)}>
                Kapat
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPasifListeAcik(true)}
            className="text-xs px-2 py-1 rounded border border-green-300 text-green-600 hover:bg-green-50"
          >
            Pasif Pozisyonlar{pasifPozisyonlar.length > 0 ? ` (${pasifPozisyonlar.length})` : ""}
          </button>
        )}
      </div>
    </div>
  )
}
