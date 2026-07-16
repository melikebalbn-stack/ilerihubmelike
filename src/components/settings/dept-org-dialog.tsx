"use client"

// PR-FAZ-B1: Bölüm org yapısı düzenleme — üst birim (parent) + sorumlu1/2/3 + müdür yrd + müdür.
// Sorumlular Personnel FK (personnelId). Yetki türetme YOK (Faz-B2).
import { useState, useEffect, useRef } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect as Select } from "@/components/ui/select"
import { Loader2, X } from "lucide-react"
import { toast } from "sonner"

type Person = { id: string; adSoyad: string; sicilNo: string | null }
type DeptPerson = { id: string; adSoyad: string } | null

export interface DeptOrgItem {
  id: string
  name: string
  parent?: { id: string; name: string } | null
  sorumlu1?: DeptPerson
  sorumlu2?: DeptPerson
  sorumlu3?: DeptPerson
  sorumlu4?: DeptPerson
  mudurYardimcisi?: DeptPerson
  mudur?: DeptPerson
}

// id döndüren personel seçici (PersonnelAutocomplete ad-string döndürdüğü için ayrı).
function PersonnelIdPicker({
  value, displayName, personnel, onChange, placeholder,
}: {
  value: string | null
  displayName: string
  personnel: Person[]
  onChange: (id: string | null, name: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState(displayName)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => setInput(displayName), [displayName])
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const q = input.toLowerCase()
  const filtered = q.length > 0
    ? personnel.filter((p) => p.adSoyad.toLowerCase().includes(q) || (p.sicilNo ?? "").toLowerCase().includes(q)).slice(0, 8)
    : []

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1">
        <Input
          value={input}
          placeholder={placeholder ?? "Personel ara..."}
          onChange={(e) => { setInput(e.target.value); setOpen(true) }}
          onFocus={() => input && setOpen(true)}
        />
        {value && (
          <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0"
            onClick={() => { onChange(null, ""); setInput("") }} title="Temizle">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((p) => (
            <button key={p.id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => { e.preventDefault(); onChange(p.id, p.adSoyad); setInput(p.adSoyad); setOpen(false) }}>
              {p.adSoyad}{p.sicilNo ? <span className="text-muted-foreground"> · {p.sicilNo}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DeptOrgDialog({
  dept, allDepts, open, onClose, onSaved,
}: {
  dept: DeptOrgItem
  allDepts: { id: string; name: string }[]
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [personnel, setPersonnel] = useState<Person[]>([])
  const [saving, setSaving] = useState(false)
  const [parentId, setParentId] = useState<string>(dept.parent?.id ?? "")
  // her sorumlu/müdür: {id, name}
  const slots = ["sorumlu1", "sorumlu2", "sorumlu3", "sorumlu4", "mudurYardimcisi", "mudur"] as const
  type Slot = typeof slots[number]
  const initFor = (s: Slot): DeptPerson => (dept[s] ?? null)
  const [sel, setSel] = useState<Record<Slot, { id: string | null; name: string }>>({
    sorumlu1: { id: initFor("sorumlu1")?.id ?? null, name: initFor("sorumlu1")?.adSoyad ?? "" },
    sorumlu2: { id: initFor("sorumlu2")?.id ?? null, name: initFor("sorumlu2")?.adSoyad ?? "" },
    sorumlu3: { id: initFor("sorumlu3")?.id ?? null, name: initFor("sorumlu3")?.adSoyad ?? "" },
    sorumlu4: { id: initFor("sorumlu4")?.id ?? null, name: initFor("sorumlu4")?.adSoyad ?? "" },
    mudurYardimcisi: { id: initFor("mudurYardimcisi")?.id ?? null, name: initFor("mudurYardimcisi")?.adSoyad ?? "" },
    mudur: { id: initFor("mudur")?.id ?? null, name: initFor("mudur")?.adSoyad ?? "" },
  })

  useEffect(() => {
    fetch("/api/overtime/personnel-list")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Person[]) => setPersonnel(Array.isArray(d) ? d : []))
      .catch(() => setPersonnel([]))
  }, [])

  const labels: Record<Slot, string> = {
    sorumlu1: "1. Sorumlu", sorumlu2: "2. Sorumlu", sorumlu3: "3. Sorumlu", sorumlu4: "4. Sorumlu",
    mudurYardimcisi: "Müdür Yardımcısı", mudur: "Müdür",
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/hr-departments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: dept.id,
          parentId: parentId || null,
          sorumlu1Id: sel.sorumlu1.id,
          sorumlu2Id: sel.sorumlu2.id,
          sorumlu3Id: sel.sorumlu3.id,
          sorumlu4Id: sel.sorumlu4.id,
          mudurYardimcisiId: sel.mudurYardimcisi.id,
          mudurId: sel.mudur.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || "Kaydetme başarısız"); return }
      toast.success(`${dept.name} org bilgisi güncellendi`)
      onSaved()
    } catch {
      toast.error("Sunucuya ulaşılamadı")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{dept.name} — Org Yapısı</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto">
          <div className="space-y-1">
            <Label>Üst Birim</Label>
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">(yok)</option>
              {allDepts.filter((d) => d.id !== dept.id).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          {slots.map((s) => (
            <div key={s} className="space-y-1">
              <Label>{labels[s]}</Label>
              <PersonnelIdPicker
                value={sel[s].id}
                displayName={sel[s].name}
                personnel={personnel}
                onChange={(id, name) => setSel((prev) => ({ ...prev, [s]: { id, name } }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>İptal</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
