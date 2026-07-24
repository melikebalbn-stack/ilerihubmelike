"use client"

// V3/Parça 3 — Boş kadroya vekil/üye atama modalı. Parça 1 (GET /personel-listesi)
// ve Parça 2 (POST /vekil-ata veya /uye-ata) uçlarını kullanır. OrgChartTree/veri
// fetch mantığına dokunmaz — orgUnitId/unitName alır, atama sonrası onAssigned() çağırır.
//
// mode="vekil" (varsayılan, mevcut çağrılar kırılmaz): POST /vekil-ata, vekilAdi alanı.
// mode="uye": POST /uye-ata, displayName alanı — boş koltuğu gerçek üye ile doldurur.
// Arama UI (GET /personel-listesi + debounce + seçim) her iki modda AYNI, değişmez.

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface PersonelSonucu {
  id: string
  adSoyad: string
  bolum: string
  bolumDetay: string | null
  gorev: string
  sicilNo: string | null
}

interface VekilAtamaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgUnitId: string
  unitName: string
  onAssigned: () => void
  mode?: "vekil" | "uye"
}

const MODE_METIN = {
  vekil: {
    baslik: "Vekalet Ekle",
    aciklama: (unitName: string) => `${unitName} — vekil olacak personeli seçin`,
    basari: (isim: string) => `Vekil atandı: ${isim}`,
    hataGenel: "Vekil atanamadı",
  },
  uye: {
    baslik: "Üye Ata",
    aciklama: (unitName: string) => `${unitName} — üye olacak personeli seçin`,
    basari: (isim: string) => `Üye atandı: ${isim}`,
    hataGenel: "Üye atanamadı",
  },
} as const

export default function VekilAtamaModal({
  open,
  onOpenChange,
  orgUnitId,
  unitName,
  onAssigned,
  mode = "vekil",
}: VekilAtamaModalProps) {
  const metin = MODE_METIN[mode]
  const [query, setQuery] = useState("")
  const [sonuclar, setSonuclar] = useState<PersonelSonucu[]>([])
  const [loading, setLoading] = useState(false)
  const [secili, setSecili] = useState<PersonelSonucu | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setQuery("")
    setSonuclar([])
    setSecili(null)
    aramaYap("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Basit debounce (kütüphane yok) — 300ms
  useEffect(() => {
    if (!open) return
    const zamanlayici = setTimeout(() => {
      aramaYap(query)
    }, 300)
    return () => clearTimeout(zamanlayici)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open])

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

  const handleAta = async () => {
    if (!secili) return

    setSubmitting(true)
    try {
      const uc = mode === "uye" ? "/api/strategic-hr/org-chart/uye-ata" : "/api/strategic-hr/org-chart/vekil-ata"
      const body =
        mode === "uye"
          ? { orgUnitId, personnelId: secili.id, displayName: secili.adSoyad }
          : { orgUnitId, personnelId: secili.id, vekilAdi: secili.adSoyad }

      const res = await fetch(uc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.status === 403) {
        toast.error("Bu işlem için yetkiniz yok")
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || metin.hataGenel)
        return
      }

      toast.success(metin.basari(secili.adSoyad))
      onOpenChange(false)
      onAssigned()
    } catch (err) {
      console.error("Atama hatası:", err)
      toast.error(metin.hataGenel)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{metin.baslik}</DialogTitle>
          <DialogDescription>{metin.aciklama(unitName)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="İsim ara..."
            autoFocus
          />

          <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground text-center">Aranıyor...</div>
            ) : sonuclar.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">Sonuç yok</div>
            ) : (
              sonuclar.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSecili(p)}
                  className={`w-full text-left p-3 hover:bg-accent transition-colors ${
                    secili?.id === p.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="font-medium text-sm">{p.adSoyad}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.bolum}
                    {p.bolumDetay ? ` / ${p.bolumDetay}` : ""} — {p.gorev}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button onClick={handleAta} disabled={!secili || submitting}>
              {submitting ? "Atanıyor..." : "Ata"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
