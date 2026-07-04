"use client"

import { useCallback, useEffect, useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { NativeSelect } from "@/components/ui/select"
import { Loader2, Save, Search } from "lucide-react"
import { toast } from "sonner"
import type { DeptOption, PersonnelOption, Workstation, WorkstationLite } from "./types"

interface Props {
  workstations: Workstation[]
  deptOptions: DeptOption[]
  /** Atama kaydedilince üst tabloyu (atanmış sayısı) tazelemek için. */
  onChanged: () => void
}

async function fetchPersonnelOptions(bolum: string, q: string): Promise<PersonnelOption[]> {
  const params = new URLSearchParams()
  if (bolum) params.set("bolum", bolum)
  if (q) params.set("q", q)
  const res = await fetch(`/api/workstations/personnel-options?${params.toString()}`)
  if (!res.ok) throw new Error("Personel listesi alınamadı")
  return res.json()
}

export function AtamaTabs({ workstations, deptOptions, onChanged }: Props) {
  return (
    <Tabs defaultValue="by-workstation" className="w-full">
      <TabsList>
        <TabsTrigger value="by-workstation">Tezgaha Göre</TabsTrigger>
        <TabsTrigger value="by-personnel">Personele Göre</TabsTrigger>
      </TabsList>

      <TabsContent value="by-workstation" className="pt-4">
        <ByWorkstation workstations={workstations} deptOptions={deptOptions} onChanged={onChanged} />
      </TabsContent>

      <TabsContent value="by-personnel" className="pt-4">
        <ByPersonnel workstations={workstations} deptOptions={deptOptions} onChanged={onChanged} />
      </TabsContent>
    </Tabs>
  )
}

/* ---------------- Tab: Tezgaha Göre ---------------- */
function ByWorkstation({ workstations, deptOptions, onChanged }: Props) {
  const [selectedWsId, setSelectedWsId] = useState("")
  const [bolum, setBolum] = useState("")
  const [q, setQ] = useState("")
  const [options, setOptions] = useState<PersonnelOption[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loadingList, setLoadingList] = useState(false)
  const [loadingAssigned, setLoadingAssigned] = useState(false)
  const [saving, setSaving] = useState(false)

  // Personel seçeneklerini (arama + bölüm) debounce ile çek
  useEffect(() => {
    const t = setTimeout(() => {
      setLoadingList(true)
      fetchPersonnelOptions(bolum, q)
        .then(setOptions)
        .catch(() => toast.error("Personel listesi alınamadı"))
        .finally(() => setLoadingList(false))
    }, 300)
    return () => clearTimeout(t)
  }, [bolum, q])

  // Seçili tezgahın atanmış personelini yükle
  useEffect(() => {
    if (!selectedWsId) {
      setSelected(new Set())
      return
    }
    setLoadingAssigned(true)
    fetch(`/api/workstations/${selectedWsId}/personnel`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: PersonnelOption[]) => setSelected(new Set(rows.map((p) => p.id))))
      .catch(() => toast.error("Atanmış personel yüklenemedi"))
      .finally(() => setLoadingAssigned(false))
  }, [selectedWsId])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  async function handleSave() {
    if (!selectedWsId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/workstations/${selectedWsId}/personnel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personnelIds: [...selected] }),
      })
      if (!res.ok) throw new Error()
      toast.success("Atama kaydedildi")
      onChanged()
    } catch {
      toast.error("Atama kaydedilemedi")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Tezgah</Label>
        <NativeSelect value={selectedWsId} onChange={(e) => setSelectedWsId(e.target.value)}>
          <option value="">Tezgah seçin…</option>
          {workstations.map((w) => (
            <option key={w.id} value={w.id}>
              {w.kod} — {w.ad}
            </option>
          ))}
        </NativeSelect>
      </div>

      {selectedWsId && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <NativeSelect className="sm:w-56" value={bolum} onChange={(e) => setBolum(e.target.value)}>
              <option value="">Tüm bölümler</option>
              {deptOptions.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Ad veya sicil no ara…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-md border">
            {loadingList || loadingAssigned ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : options.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Personel bulunamadı</p>
            ) : (
              <ul className="divide-y">
                {options.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox
                      id={`ws-p-${p.id}`}
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                    />
                    <label htmlFor={`ws-p-${p.id}`} className="flex-1 cursor-pointer text-sm">
                      {p.adSoyad}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {p.sicilNo ?? "—"} · {p.bolum}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{selected.size} personel seçili</span>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Kaydet
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- Tab: Personele Göre ---------------- */
function ByPersonnel({ workstations, deptOptions, onChanged }: Props) {
  const [bolum, setBolum] = useState("")
  const [q, setQ] = useState("")
  const [options, setOptions] = useState<PersonnelOption[]>([])
  const [selectedPersonnelId, setSelectedPersonnelId] = useState("")
  const [loadingList, setLoadingList] = useState(false)

  const [wsSearch, setWsSearch] = useState("")
  const [selectedWs, setSelectedWs] = useState<Set<string>>(new Set())
  const [loadingAssigned, setLoadingAssigned] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setLoadingList(true)
      fetchPersonnelOptions(bolum, q)
        .then(setOptions)
        .catch(() => toast.error("Personel listesi alınamadı"))
        .finally(() => setLoadingList(false))
    }, 300)
    return () => clearTimeout(t)
  }, [bolum, q])

  // Seçili personelin atanmış tezgahları
  useEffect(() => {
    if (!selectedPersonnelId) {
      setSelectedWs(new Set())
      return
    }
    setLoadingAssigned(true)
    fetch(`/api/personnel/${selectedPersonnelId}/workstations`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: WorkstationLite[]) => setSelectedWs(new Set(rows.map((w) => w.id))))
      .catch(() => toast.error("Atanmış tezgahlar yüklenemedi"))
      .finally(() => setLoadingAssigned(false))
  }, [selectedPersonnelId])

  const toggleWs = useCallback((id: string) => {
    setSelectedWs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const filteredWs = workstations.filter((w) => {
    if (!wsSearch) return true
    const s = wsSearch.toLowerCase()
    return w.kod.toLowerCase().includes(s) || w.ad.toLowerCase().includes(s)
  })

  async function handleSave() {
    if (!selectedPersonnelId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/personnel/${selectedPersonnelId}/workstations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workstationIds: [...selectedWs] }),
      })
      if (!res.ok) throw new Error()
      toast.success("Atama kaydedildi")
      onChanged()
    } catch {
      toast.error("Atama kaydedilemedi")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <NativeSelect className="sm:w-56" value={bolum} onChange={(e) => setBolum(e.target.value)}>
          <option value="">Tüm bölümler</option>
          {deptOptions.map((d) => (
            <option key={d.id} value={d.name}>
              {d.name}
            </option>
          ))}
        </NativeSelect>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Personel ad/sicil ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Personel</Label>
        <NativeSelect
          value={selectedPersonnelId}
          onChange={(e) => setSelectedPersonnelId(e.target.value)}
          disabled={loadingList}
        >
          <option value="">Personel seçin…</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.adSoyad} ({p.sicilNo ?? "—"}) · {p.bolum}
            </option>
          ))}
        </NativeSelect>
      </div>

      {selectedPersonnelId && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Tezgah ara…"
              value={wsSearch}
              onChange={(e) => setWsSearch(e.target.value)}
            />
          </div>

          <div className="max-h-80 overflow-y-auto rounded-md border">
            {loadingAssigned ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredWs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Tezgah bulunamadı</p>
            ) : (
              <ul className="divide-y">
                {filteredWs.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox
                      id={`p-ws-${w.id}`}
                      checked={selectedWs.has(w.id)}
                      onCheckedChange={() => toggleWs(w.id)}
                    />
                    <label htmlFor={`p-ws-${w.id}`} className="flex-1 cursor-pointer text-sm">
                      {w.kod} — {w.ad}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {w.department?.name ?? "—"}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{selectedWs.size} tezgah seçili</span>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Kaydet
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
