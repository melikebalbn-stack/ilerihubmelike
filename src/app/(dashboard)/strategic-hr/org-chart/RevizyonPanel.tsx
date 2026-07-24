"use client"

// R3.b — Revizyon geçmişi paneli + yeni revizyon formu. R3.a'daki GET/POST
// (/api/strategic-hr/org-chart/revizyon) uçlarını kullanır. Renderer/OrgChartTree/
// veri fetch mantığına dokunmaz — page.tsx'ten yalnız prop alır.

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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"

interface RevizyonKaydi {
  id: string
  revNo: number
  tarih: string
  aciklama: string
  degisiklikYeri: string
  yapan: string
}

interface RevizyonPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kokKod: string
  kokAd: string
  hasFullAccess: boolean
  varsayilanYapan: string
}

function bugununTarihi(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function RevizyonPanel({
  open,
  onOpenChange,
  kokKod,
  kokAd,
  hasFullAccess,
  varsayilanYapan,
}: RevizyonPanelProps) {
  const [revizyonlar, setRevizyonlar] = useState<RevizyonKaydi[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [tarih, setTarih] = useState(bugununTarihi())
  const [aciklama, setAciklama] = useState("")
  const [degisiklikYeri, setDegisiklikYeri] = useState(kokAd)
  const [yapan, setYapan] = useState(varsayilanYapan)

  const fetchRevizyonlar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/strategic-hr/org-chart/revizyon?code=${kokKod}`)
      if (res.ok) {
        const data = await res.json()
        setRevizyonlar(data)
      } else {
        toast.error("Revizyon geçmişi yüklenemedi")
      }
    } catch (err) {
      console.error("Revizyon geçmişi yüklenirken hata:", err)
      toast.error("Revizyon geçmişi yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    fetchRevizyonlar()
    setTarih(bugununTarihi())
    setAciklama("")
    setDegisiklikYeri(kokAd)
    setYapan(varsayilanYapan)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kokKod])

  const handleSubmit = async () => {
    if (!aciklama.trim()) {
      toast.error("Açıklama zorunludur")
      return
    }
    if (!degisiklikYeri.trim()) {
      toast.error("Değişiklik yapılan yer zorunludur")
      return
    }
    if (!yapan.trim()) {
      toast.error("Yapan zorunludur")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/strategic-hr/org-chart/revizyon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: kokKod, tarih, aciklama, degisiklikYeri, yapan }),
      })

      if (res.status === 403) {
        toast.error("Bu işlem için yetkiniz yok")
        return
      }

      if (!res.ok) {
        toast.error("Revizyon eklenemedi")
        return
      }

      const data = await res.json()
      setAciklama("")
      setDegisiklikYeri(kokAd)
      setYapan(varsayilanYapan)
      setTarih(bugununTarihi())
      await fetchRevizyonlar()
      toast.success(`Revizyon eklendi (Rev ${data.yeniRevNo})`)
    } catch (err) {
      console.error("Revizyon eklenirken hata:", err)
      toast.error("Revizyon eklenemedi")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revizyon Geçmişi</DialogTitle>
          <DialogDescription>{kokAd} — döküman revizyon kayıtları</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Yükleniyor...</div>
          ) : revizyonlar.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Henüz revizyon kaydı yok</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rev No</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Değişiklik Açıklaması</TableHead>
                  <TableHead>Değişiklik Yapılan Yer</TableHead>
                  <TableHead>Yapan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revizyonlar.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.revNo}</TableCell>
                    <TableCell>{new Date(r.tarih).toLocaleDateString("tr-TR")}</TableCell>
                    <TableCell>{r.aciklama}</TableCell>
                    <TableCell>{r.degisiklikYeri}</TableCell>
                    <TableCell>{r.yapan}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {hasFullAccess && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-semibold">Yeni Revizyon Ekle</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Tarih</Label>
                  <Input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
                </div>
                <div>
                  <Label>Değişiklik Yapılan Yer</Label>
                  <Input value={degisiklikYeri} onChange={(e) => setDegisiklikYeri(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Değişiklik Açıklaması</Label>
                  <Textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} rows={2} />
                </div>
                <div>
                  <Label>Yapan</Label>
                  <Input value={yapan} onChange={(e) => setYapan(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Ekleniyor..." : "Revizyon Ekle"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
