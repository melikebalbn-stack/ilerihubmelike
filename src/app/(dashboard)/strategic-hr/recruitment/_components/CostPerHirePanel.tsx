"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Banknote, Plus, Settings, Users } from "lucide-react"

type Item = { id: string; name: string; type: "SABIT" | "SAATLIK"; unitRate: number | null; isActive: boolean }
type Analiz = {
  toplamMaliyet: number
  basvuruBazliMaliyet: number
  genelMaliyet: number
  iseAlinan: number
  costPerHire: number | null
  kayitSayisi: number
  kalemler: { name: string; total: number }[]
}
type App = { id: string; fullName: string }

const ITEM_API = "/api/strategic-hr/recruitment/cost-items"
const COST_API = "/api/strategic-hr/recruitment/costs"
const TL = (n: number) => `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export default function CostPerHirePanel() {
  const [analiz, setAnaliz] = useState<Analiz | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [hata, setHata] = useState<string | null>(null)
  const [tanimAcik, setTanimAcik] = useState(false)
  const [girisAcik, setGirisAcik] = useState(false)

  // Kalem tanım formu
  const [yeniAd, setYeniAd] = useState("")
  const [yeniTip, setYeniTip] = useState<"SABIT" | "SAATLIK">("SABIT")
  const [yeniUcret, setYeniUcret] = useState("")

  // Maliyet giriş formu
  const [gItem, setGItem] = useState("")
  const [gApp, setGApp] = useState("") // boş = genel maliyet
  const [gMiktar, setGMiktar] = useState("1")
  const [gTutar, setGTutar] = useState("")
  const [gNot, setGNot] = useState("")
  const [mesaj, setMesaj] = useState<string | null>(null)

  const yukle = useCallback(() => {
    fetch("/api/strategic-hr/recruitment/metrics/cost-per-hire")
      .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Alınamadı"); return r.json() })
      .then(setAnaliz).catch((e) => setHata(e.message))
    fetch(ITEM_API).then((r) => (r.ok ? r.json() : [])).then(setItems).catch(() => {})
    fetch("/api/strategic-hr/recruitment/job-applications?limit=200")
      .then((r) => (r.ok ? r.json() : { applications: [] }))
      .then((d) => setApps(Array.isArray(d?.applications) ? d.applications : [])).catch(() => {})
  }, [])
  useEffect(() => { yukle() }, [yukle])

  const secItem = items.find((i) => i.id === gItem)

  const kalemEkle = async () => {
    if (!yeniAd.trim()) return
    const r = await fetch(ITEM_API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: yeniAd.trim(), type: yeniTip, unitRate: yeniTip === "SAATLIK" ? Number(yeniUcret) : undefined }),
    })
    if (r.ok) { setYeniAd(""); setYeniUcret(""); yukle() } else alert((await r.json().catch(() => ({}))).error || "Eklenemedi")
  }
  const kalemPasif = async (id: string) => { const r = await fetch(`${ITEM_API}/${id}`, { method: "DELETE" }); if (r.ok) yukle() }

  const maliyetEkle = async () => {
    setMesaj(null)
    if (!gItem) { setMesaj("Kalem seçin"); return }
    const body: Record<string, unknown> = { itemId: gItem, note: gNot || undefined }
    if (gApp) body.publicJobApplicationId = gApp
    if (secItem?.type === "SAATLIK") body.quantity = Number(gMiktar)
    else body.amount = Number(gTutar)
    const r = await fetch(COST_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (r.ok) { setGTutar(""); setGMiktar("1"); setGNot(""); setMesaj("Maliyet eklendi."); yukle() }
    else setMesaj((await r.json().catch(() => ({}))).error || "Eklenemedi")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><Banknote className="h-4 w-4 text-[#1B4F72]" /> İşe Alım Maliyeti</span>
          <span className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setGirisAcik((v) => !v)}><Plus className="h-4 w-4 mr-1" /> Maliyet Ekle</Button>
            <Button variant="ghost" size="sm" onClick={() => setTanimAcik((v) => !v)}><Settings className="h-4 w-4 mr-1" /> Tanımlar</Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Maliyet girişi (genel: başvuru boş; başvuru bazlı: seç) */}
        {girisAcik && (
          <div className="border rounded-md p-3 space-y-2 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Kalem</Label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={gItem} onChange={(e) => setGItem(e.target.value)}>
                  <option value="">Kalem seçin…</option>
                  {items.filter((i) => i.isActive).map((i) => <option key={i.id} value={i.id}>{i.name} ({i.type === "SAATLIK" ? `saatlik ₺${i.unitRate}` : "sabit"})</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Başvuru (boş = genel maliyet: ilan/ajans)</Label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={gApp} onChange={(e) => setGApp(e.target.value)}>
                  <option value="">— Genel —</option>
                  {apps.map((a) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
                </select>
              </div>
              {secItem?.type === "SAATLIK" ? (
                <div><Label className="text-xs">Saat</Label><Input type="number" value={gMiktar} onChange={(e) => setGMiktar(e.target.value)} /></div>
              ) : (
                <div><Label className="text-xs">Tutar (TL)</Label><Input type="number" value={gTutar} onChange={(e) => setGTutar(e.target.value)} /></div>
              )}
              <div><Label className="text-xs">Not (opsiyonel)</Label><Input value={gNot} onChange={(e) => setGNot(e.target.value)} /></div>
            </div>
            {secItem?.type === "SAATLIK" && secItem.unitRate != null && (
              <p className="text-xs text-slate-500">Hesaplanan: {Number(gMiktar || 0)} saat × ₺{secItem.unitRate} = <b>{TL(Number(gMiktar || 0) * secItem.unitRate)}</b></p>
            )}
            {mesaj && <p className="text-xs text-[#1B4F72]">{mesaj}</p>}
            <Button onClick={maliyetEkle} disabled={!gItem} className="bg-[#1B4F72]" size="sm">Kaydet</Button>
          </div>
        )}

        {/* Kalem kataloğu yönetimi */}
        {tanimAcik && (
          <div className="border rounded-md p-3 space-y-2 bg-slate-50">
            <div className="flex flex-col md:flex-row gap-2 md:items-end">
              <div className="flex-[2]"><Label className="text-xs">Kalem Adı</Label><Input value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder="Örn: İlan Maliyeti / Saatlik İK" /></div>
              <div><Label className="text-xs">Tip</Label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={yeniTip} onChange={(e) => setYeniTip(e.target.value as "SABIT" | "SAATLIK")}>
                  <option value="SABIT">Sabit (tek tutar)</option><option value="SAATLIK">Saatlik</option>
                </select>
              </div>
              {yeniTip === "SAATLIK" && <div><Label className="text-xs">Saat Ücreti (TL)</Label><Input type="number" value={yeniUcret} onChange={(e) => setYeniUcret(e.target.value)} /></div>}
              <Button onClick={kalemEkle} disabled={!yeniAd.trim()} className="bg-[#1B4F72]"><Plus className="h-3 w-3 mr-1" /> Ekle</Button>
            </div>
            <div className="space-y-1">
              {items.length === 0 ? <p className="text-xs text-slate-500">Henüz kalem yok.</p> : items.map((i) => (
                <div key={i.id} className="flex items-center justify-between text-sm">
                  <span>{i.name} <span className="text-xs text-slate-400">· {i.type === "SAATLIK" ? `saatlik ₺${i.unitRate}` : "sabit"}</span>{!i.isActive && <Badge variant="secondary" className="ml-2">Pasif</Badge>}</span>
                  {i.isActive && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => kalemPasif(i.id)}>Pasifleştir</Button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analiz */}
        {hata ? <p className="text-sm text-red-600">{hata}</p> : !analiz ? (
          <div className="flex items-center justify-center h-20"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1B4F72]" /></div>
        ) : analiz.kayitSayisi === 0 ? (
          <p className="text-sm text-slate-500">Henüz maliyet kaydı yok.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="border rounded-md p-3"><p className="text-xs text-slate-500">Toplam Maliyet</p><p className="text-xl font-bold text-[#1B4F72]">{TL(analiz.toplamMaliyet)}</p><p className="text-[11px] text-slate-400">başvuru {TL(analiz.basvuruBazliMaliyet)} · genel {TL(analiz.genelMaliyet)}</p></div>
              <div className="border rounded-md p-3 flex items-center gap-2"><Users className="h-5 w-5 text-slate-400" /><div><p className="text-xs text-slate-500">İşe Alınan</p><p className="text-xl font-bold text-[#1B4F72]">{analiz.iseAlinan}</p></div></div>
              <div className="border rounded-md p-3"><p className="text-xs text-slate-500">Kişi Başı Maliyet</p><p className="text-xl font-bold text-[#1B4F72]">{analiz.costPerHire !== null ? TL(analiz.costPerHire) : "-"}</p><p className="text-[11px] text-slate-400">{analiz.iseAlinan === 0 ? "İşe alınan yok" : `${analiz.kayitSayisi} kayıt`}</p></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500 border-b"><th className="px-3 py-2">Kalem</th><th className="px-3 py-2">Toplam</th></tr></thead>
                <tbody>{analiz.kalemler.map((k, idx) => <tr key={idx} className="border-b last:border-0"><td className="px-3 py-2 font-medium">{k.name}</td><td className="px-3 py-2 font-semibold text-[#1B4F72]">{TL(k.total)}</td></tr>)}</tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
