"use client"

// "Personel Kaydı Yok" kartına tıklanınca açılan liste + bağlama modalı.
// Liste SUNUCUDAN gelir (org-chart GET → personelsizKoltuk, yalnız hasFullAccess).
// Bağlama mevcut PATCH org-chart/uye/{id} ucunu kullanır — yeni uç açılmadı;
// uye-ata bu işi yapamıyor (kutunun BOŞ olmasını şart koşuyor, yeni kayıt açıyor).

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

export interface PersonelsizKoltuk {
  id: string
  displayName: string
  orgUnitId: string
  kutuKodu: string
  kutuAdi: string
  ustBirim: string | null
}

interface PersonelSecenek {
  id: string
  sicilNo: string | null
  adSoyad: string
  bolum?: string
  gorev?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  koltuklar: PersonelsizKoltuk[]
  onRefresh?: () => void
}

export default function PersonelsizKoltukModal({ open, onOpenChange, koltuklar, onRefresh }: Props) {
  const [personeller, setPersoneller] = useState<PersonelSecenek[]>([])
  const [secim, setSecim] = useState<Record<string, string>>({})
  const [arama, setArama] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  // Atanacak personel listesi — mevcut personel-listesi ucu (yeni uç yok).
  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const res = await fetch("/api/strategic-hr/org-chart/personel-listesi")
        const json = await res.json()
        const arr = json.personeller ?? json.data ?? json
        if (Array.isArray(arr)) setPersoneller(arr)
      } catch {
        /* liste alınamazsa seçici boş kalır, modal yine listeyi gösterir */
      }
    })()
  }, [open])

  const bagla = async (koltukId: string) => {
    const personnelId = secim[koltukId]
    if (!personnelId) return
    setSaving(koltukId)
    try {
      const res = await fetch(`/api/strategic-hr/org-chart/uye/${koltukId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personnelId }),
      })
      if (res.status === 403) { toast.error("Bu işlem için yetkiniz yok"); return }
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) { toast.error(json.error || "Bağlanamadı"); return }
      toast.success("Koltuk personele bağlandı")
      onRefresh?.()
    } catch {
      toast.error("Bağlanamadı")
    } finally {
      setSaving(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Personel Kaydına Bağlı Olmayan Koltuklar ({koltuklar.length})</DialogTitle>
          <DialogDescription>
            Şemada isim görünüyor ama sistem o kişiyi tanımıyor. Bir kısmı kasıtlı olabilir
            (yurt dışı bölge müdürleri, dış kaynak danışmanlar, şirket kaydı) — hangisinin
            bağlanacağına siz karar verin.
          </DialogDescription>
        </DialogHeader>

        {koltuklar.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Tüm koltuklar personel kaydına bağlı.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Koltuktaki isim</TableHead>
                  <TableHead>Kutu</TableHead>
                  <TableHead>Üst birim</TableHead>
                  <TableHead className="w-[320px]">Personel bağla</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {koltuklar.map((k) => {
                  const q = (arama[k.id] ?? "").toLocaleLowerCase("tr-TR")
                  const secenekler = q
                    ? personeller.filter((p) =>
                        `${p.sicilNo ?? ""} ${p.adSoyad}`.toLocaleLowerCase("tr-TR").includes(q),
                      )
                    : personeller
                  return (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium text-amber-800">⚠ {k.displayName}</TableCell>
                      <TableCell>{k.kutuAdi}</TableCell>
                      <TableCell className="text-muted-foreground">{k.ustBirim ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <input
                            value={arama[k.id] ?? ""}
                            onChange={(e) => setArama((s) => ({ ...s, [k.id]: e.target.value }))}
                            placeholder="Personel ara (sicil / ad)"
                            className="rounded border px-2 py-1 text-xs"
                          />
                          <div className="flex gap-1">
                            <select
                              value={secim[k.id] ?? ""}
                              onChange={(e) => setSecim((s) => ({ ...s, [k.id]: e.target.value }))}
                              className="min-w-0 flex-1 rounded border px-2 py-1 text-xs"
                            >
                              <option value="">Personel seçiniz…</option>
                              {secenekler.slice(0, 200).map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.sicilNo ? `${p.sicilNo} — ` : ""}{p.adSoyad}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!secim[k.id] || saving === k.id}
                              onClick={() => bagla(k.id)}
                              className="rounded bg-teal-700 px-2 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                            >
                              {saving === k.id ? "…" : "Bağla"}
                            </button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
