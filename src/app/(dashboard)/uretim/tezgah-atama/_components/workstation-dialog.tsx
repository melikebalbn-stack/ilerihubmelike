"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, AlertTriangle } from "lucide-react"
import type { DeptOption, Workstation } from "./types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  deptOptions: DeptOption[]
  /** null → yeni oluştur; dolu → düzenle */
  editing: Workstation | null
  onSaved: () => void
}

export function WorkstationDialog({ open, onOpenChange, deptOptions, editing, onSaved }: Props) {
  const [kod, setKod] = useState("")
  const [ad, setAd] = useState("")
  const [ifsWorkCenterKod, setIfsWorkCenterKod] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Dialog açıldığında formu doldur (düzenle) veya sıfırla (yeni)
  useEffect(() => {
    if (!open) return
    setFormError(null)
    if (editing) {
      setKod(editing.kod)
      setAd(editing.ad)
      setIfsWorkCenterKod(editing.ifsWorkCenterKod)
      setDepartmentId(editing.departmentId)
      setIsActive(editing.isActive)
    } else {
      setKod("")
      setAd("")
      setIfsWorkCenterKod("")
      setDepartmentId("")
      setIsActive(true)
    }
  }, [open, editing])

  async function handleSave() {
    setFormError(null)
    if (!kod.trim() || !ad.trim() || !ifsWorkCenterKod.trim() || !departmentId) {
      setFormError("Kod, ad, IFS iş merkezi ve bölüm zorunludur.")
      return
    }
    setSaving(true)
    try {
      const payload = {
        kod: kod.trim(),
        ad: ad.trim(),
        ifsWorkCenterKod: ifsWorkCenterKod.trim(),
        departmentId,
        isActive,
      }
      const res = editing
        ? await fetch(`/api/workstations/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/workstations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // 409 → kod çakışması (temiz mesaj), diğerleri generic
        setFormError(data?.error || (res.status === 409 ? "Bu tezgah kodu zaten kullanılıyor." : "Kaydedilemedi."))
        return
      }

      onSaved()
      onOpenChange(false)
    } catch {
      setFormError("Beklenmeyen bir hata oluştu.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Tezgahı Düzenle" : "Yeni Tezgah"}</DialogTitle>
          <DialogDescription>
            Fiziksel tezgah bilgileri. IFS iş merkezi kodu birden çok tezgahta aynı olabilir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ws-kod">Tezgah Kodu *</Label>
            <Input id="ws-kod" value={kod} onChange={(e) => setKod(e.target.value)} placeholder="PH50" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-ad">Ad *</Label>
            <Input id="ws-ad" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="100 ton pres" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-ifs">IFS İş Merkezi Kodu *</Label>
            <Input
              id="ws-ifs"
              value={ifsWorkCenterKod}
              onChange={(e) => setIfsWorkCenterKod(e.target.value)}
              placeholder="PH"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Bölüm *</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Bölüm seçin" />
              </SelectTrigger>
              <SelectContent>
                {deptOptions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="ws-active">Aktif</Label>
            <Switch id="ws-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
