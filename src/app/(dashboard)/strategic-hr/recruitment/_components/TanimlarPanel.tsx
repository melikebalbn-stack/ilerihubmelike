"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus } from "lucide-react"

const KAT_ETIKET: Record<string, string> = { CORE: "Temel", LEADERSHIP: "Liderlik", TECHNICAL: "Teknik", BEHAVIORAL: "Davranışsal", FUNCTIONAL: "Fonksiyonel" }
const RET_KAT: Record<string, string> = { TEKLIF_REDDI: "Teklif Reddi", ISE_ALMAMA: "İşe Almama", SUREC_KAYBI: "Süreç Kaybı" }

// ---- Pozisyonlar ----
function Pozisyonlar() {
  type Pos = { id: string; code: string; title: string; department: string; yaka: string | null; ingilizceZorunlu: boolean; hedefTimeToHire: number | null; isActive: boolean }
  const [items, setItems] = useState<Pos[]>([])
  const [duzen, setDuzen] = useState<Record<string, Partial<Pos>>>({})
  const yukle = useCallback(() => { fetch("/api/strategic-hr/recruitment/tanimlar/positions").then((r) => r.ok ? r.json() : []).then(setItems).catch(() => {}) }, [])
  useEffect(() => { yukle() }, [yukle])
  const kaydet = async (id: string) => {
    const d = duzen[id]; if (!d) return
    const r = await fetch(`/api/strategic-hr/recruitment/tanimlar/positions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) })
    if (r.ok) { setDuzen((p) => { const n = { ...p }; delete n[id]; return n }); yukle() }
  }
  const set = (id: string, k: keyof Pos, v: unknown) => setDuzen((p) => ({ ...p, [id]: { ...p[id], [k]: v } }))
  const val = (i: Pos, k: keyof Pos) => (duzen[i.id]?.[k] !== undefined ? duzen[i.id][k] : i[k])
  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-slate-500 mb-2">Mevcut Position tablosu (IFS senkron). İK yaka/İngilizce/hedef süre/aktiflik alanlarını yönetir; kod/başlık senkrondan gelir. Kayıtlar silinmez, pasife çekilir.</p>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-slate-500 border-b"><th className="px-2 py-2">Kod</th><th className="px-2 py-2">Pozisyon</th><th className="px-2 py-2">Departman</th><th className="px-2 py-2">Yaka</th><th className="px-2 py-2">İng.</th><th className="px-2 py-2">Hedef TtH</th><th className="px-2 py-2">Aktif</th><th className="px-2 py-2"></th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b last:border-0">
              <td className="px-2 py-1 text-xs">{i.code}</td>
              <td className="px-2 py-1 font-medium">{i.title}</td>
              <td className="px-2 py-1 text-slate-600">{i.department}</td>
              <td className="px-2 py-1">
                <select className="h-8 rounded border border-input bg-background px-2 text-xs" value={(val(i, "yaka") as string) ?? ""} onChange={(e) => set(i.id, "yaka", e.target.value || null)}>
                  <option value="">—</option><option value="MAVI">Mavi</option><option value="BEYAZ">Beyaz</option>
                </select>
              </td>
              <td className="px-2 py-1"><input type="checkbox" checked={!!val(i, "ingilizceZorunlu")} onChange={(e) => set(i.id, "ingilizceZorunlu", e.target.checked)} /></td>
              <td className="px-2 py-1"><Input type="number" className="h-8 w-20 text-xs" value={(val(i, "hedefTimeToHire") as number) ?? ""} onChange={(e) => set(i.id, "hedefTimeToHire", e.target.value)} /></td>
              <td className="px-2 py-1"><input type="checkbox" checked={!!val(i, "isActive")} onChange={(e) => set(i.id, "isActive", e.target.checked)} /></td>
              <td className="px-2 py-1">{duzen[i.id] && <Button size="sm" className="h-7 bg-[#1B4F72]" onClick={() => kaydet(i.id)}>Kaydet</Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---- Yetkinlikler ----
function Yetkinlikler() {
  type Comp = { id: string; code: string; name: string; category: string; isActive: boolean }
  const [items, setItems] = useState<Comp[]>([])
  const [f, setF] = useState({ code: "", name: "", category: "CORE" })
  const yukle = useCallback(() => { fetch("/api/strategic-hr/recruitment/tanimlar/competencies").then((r) => r.ok ? r.json() : []).then(setItems).catch(() => {}) }, [])
  useEffect(() => { yukle() }, [yukle])
  const ekle = async () => { const r = await fetch("/api/strategic-hr/recruitment/tanimlar/competencies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }); if (r.ok) { setF({ code: "", name: "", category: "CORE" }); yukle() } else alert((await r.json().catch(() => ({}))).error) }
  const pasif = async (id: string) => { const r = await fetch(`/api/strategic-hr/recruitment/tanimlar/competencies/${id}`, { method: "DELETE" }); if (r.ok) yukle() }
  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-2 md:items-end border rounded p-2 bg-slate-50">
        <div><Label className="text-xs">Kod</Label><Input className="h-8" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="EXCEL" /></div>
        <div className="flex-1"><Label className="text-xs">Ad</Label><Input className="h-8" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Excel Bilgisi" /></div>
        <div><Label className="text-xs">Kategori</Label><select className="h-8 rounded border border-input bg-background px-2 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(KAT_ETIKET).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <Button size="sm" className="bg-[#1B4F72]" onClick={ekle} disabled={!f.code || !f.name}><Plus className="h-3 w-3 mr-1" />Ekle</Button>
      </div>
      {items.map((i) => (
        <div key={i.id} className="flex items-center justify-between text-sm border-b pb-1">
          <span>{i.name} <span className="text-xs text-slate-400">· {i.code} · {KAT_ETIKET[i.category] ?? i.category}</span>{!i.isActive && <Badge variant="secondary" className="ml-2">Pasif</Badge>}</span>
          {i.isActive && <Button variant="ghost" size="sm" className="text-red-600 h-7" onClick={() => pasif(i.id)}>Pasifleştir</Button>}
        </div>
      ))}
    </div>
  )
}

// ---- Kök Nedenler (mevcut RejectionReason API) ----
function KokNedenler() {
  type R = { id: string; category: string; name: string; isActive: boolean }
  const [items, setItems] = useState<R[]>([])
  const [f, setF] = useState({ category: "TEKLIF_REDDI", name: "" })
  const API = "/api/strategic-hr/recruitment/rejection-reasons"
  const yukle = useCallback(() => { fetch(API).then((r) => r.ok ? r.json() : []).then(setItems).catch(() => {}) }, [])
  useEffect(() => { yukle() }, [yukle])
  const ekle = async () => { const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }); if (r.ok) { setF({ ...f, name: "" }); yukle() } else alert((await r.json().catch(() => ({}))).error) }
  const pasif = async (id: string) => { const r = await fetch(`${API}/${id}`, { method: "DELETE" }); if (r.ok) yukle() }
  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-2 md:items-end border rounded p-2 bg-slate-50">
        <div><Label className="text-xs">Kategori</Label><select className="h-8 rounded border border-input bg-background px-2 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(RET_KAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="flex-1"><Label className="text-xs">Ret Nedeni</Label><Input className="h-8" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ücret beklentisi" /></div>
        <Button size="sm" className="bg-[#1B4F72]" onClick={ekle} disabled={!f.name}><Plus className="h-3 w-3 mr-1" />Ekle</Button>
      </div>
      {items.map((i) => (
        <div key={i.id} className="flex items-center justify-between text-sm border-b pb-1">
          <span>{i.name} <span className="text-xs text-slate-400">· {RET_KAT[i.category] ?? i.category}</span>{!i.isActive && <Badge variant="secondary" className="ml-2">Pasif</Badge>}</span>
          {i.isActive && <Button variant="ghost" size="sm" className="text-red-600 h-7" onClick={() => pasif(i.id)}>Pasifleştir</Button>}
        </div>
      ))}
    </div>
  )
}

// ---- Kaynaklar (ReferralSourceDef sözlüğü) ----
function Kaynaklar() {
  type S = { id: string; name: string; isActive: boolean }
  const [items, setItems] = useState<S[]>([])
  const [ad, setAd] = useState("")
  const API = "/api/strategic-hr/recruitment/tanimlar/referral-sources"
  const yukle = useCallback(() => { fetch(API).then((r) => r.ok ? r.json() : []).then(setItems).catch(() => {}) }, [])
  useEffect(() => { yukle() }, [yukle])
  const ekle = async () => { const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: ad }) }); if (r.ok) { setAd(""); yukle() } else alert((await r.json().catch(() => ({}))).error) }
  const pasif = async (id: string) => { const r = await fetch(`${API}/${id}`, { method: "DELETE" }); if (r.ok) yukle() }
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Başvuru kaynağı listesi (İK yönetir). Public başvuru formundaki "Bize Nasıl Ulaştınız" seçenekleri buradan gelir. Kayıt silinmez, pasife çekilir.</p>
      <div className="flex gap-2 items-end border rounded p-2 bg-slate-50">
        <div className="flex-1"><Label className="text-xs">Kaynak Adı</Label><Input className="h-8" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="LinkedIn / Kariyer.net ..." /></div>
        <Button size="sm" className="bg-[#1B4F72]" onClick={ekle} disabled={!ad.trim()}><Plus className="h-3 w-3 mr-1" />Ekle</Button>
      </div>
      {items.map((i) => (
        <div key={i.id} className="flex items-center justify-between text-sm border-b pb-1">
          <span>{i.name}{!i.isActive && <Badge variant="secondary" className="ml-2">Pasif</Badge>}</span>
          {i.isActive && <Button variant="ghost" size="sm" className="text-red-600 h-7" onClick={() => pasif(i.id)}>Pasifleştir</Button>}
        </div>
      ))}
    </div>
  )
}

export default function TanimlarPanel() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Tanımlar (İK yönetimi)</CardTitle></CardHeader>
      <CardContent>
        <Tabs defaultValue="pozisyonlar">
          <TabsList>
            <TabsTrigger value="pozisyonlar">Pozisyonlar</TabsTrigger>
            <TabsTrigger value="yetkinlikler">Yetkinlikler</TabsTrigger>
            <TabsTrigger value="koknedenler">Kök Nedenler</TabsTrigger>
            <TabsTrigger value="kaynaklar">Kaynaklar</TabsTrigger>
          </TabsList>
          <TabsContent value="pozisyonlar" className="pt-3"><Pozisyonlar /></TabsContent>
          <TabsContent value="yetkinlikler" className="pt-3"><Yetkinlikler /></TabsContent>
          <TabsContent value="koknedenler" className="pt-3"><KokNedenler /></TabsContent>
          <TabsContent value="kaynaklar" className="pt-3"><Kaynaklar /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
