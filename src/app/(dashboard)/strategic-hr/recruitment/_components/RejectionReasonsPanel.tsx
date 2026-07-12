"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { XCircle, Plus, Settings } from "lucide-react"

const KATEGORI_ETIKET: Record<string, string> = {
  TEKLIF_REDDI: "Teklif Reddi (aday kaynaklı)",
  ISE_ALMAMA: "İşe Almama (şirket kaynaklı)",
  SUREC_KAYBI: "Süreç Kaybı",
}
const KATEGORILER = ["TEKLIF_REDDI", "ISE_ALMAMA", "SUREC_KAYBI"] as const

type Reason = { id: string; category: string; name: string; isActive: boolean }
type Analiz = {
  toplamRet: number
  nedenliRet: number
  satirlar: { name: string; category: string; count: number }[]
  kategoriler: { category: string; count: number }[]
}

const API = "/api/strategic-hr/recruitment/rejection-reasons"

export default function RejectionReasonsPanel() {
  const [analiz, setAnaliz] = useState<Analiz | null>(null)
  const [reasons, setReasons] = useState<Reason[]>([])
  const [hata, setHata] = useState<string | null>(null)
  const [yeniKat, setYeniKat] = useState<string>("TEKLIF_REDDI")
  const [yeniAd, setYeniAd] = useState("")
  const [yonetimAcik, setYonetimAcik] = useState(false)

  const yukle = useCallback(() => {
    fetch("/api/strategic-hr/recruitment/metrics/rejection-reasons")
      .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Alınamadı"); return r.json() })
      .then(setAnaliz).catch((e) => setHata(e.message))
    fetch(API).then((r) => (r.ok ? r.json() : [])).then(setReasons).catch(() => {})
  }, [])
  useEffect(() => { yukle() }, [yukle])

  const ekle = async () => {
    if (!yeniAd.trim()) return
    const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: yeniKat, name: yeniAd.trim() }) })
    if (r.ok) { setYeniAd(""); yukle() } else { alert((await r.json().catch(() => ({}))).error || "Eklenemedi") }
  }
  const pasiflestir = async (id: string) => {
    const r = await fetch(`${API}/${id}`, { method: "DELETE" })
    if (r.ok) yukle()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><XCircle className="h-4 w-4 text-[#1B4F72]" /> Ret Nedenleri</span>
          <Button variant="ghost" size="sm" onClick={() => setYonetimAcik((v) => !v)}>
            <Settings className="h-4 w-4 mr-1" /> Tanımlar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sözlük yönetimi (İK) — additive, Analiz sekmesi içinde */}
        {yonetimAcik && (
          <div className="border rounded-md p-3 space-y-3 bg-slate-50">
            <div className="flex flex-col md:flex-row gap-2 md:items-end">
              <div className="flex-1">
                <Label className="text-xs">Kategori</Label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={yeniKat} onChange={(e) => setYeniKat(e.target.value)}>
                  {KATEGORILER.map((k) => <option key={k} value={k}>{KATEGORI_ETIKET[k]}</option>)}
                </select>
              </div>
              <div className="flex-[2]">
                <Label className="text-xs">Ret Nedeni Adı</Label>
                <Input value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder="Örn: Ücret beklentisi" />
              </div>
              <Button onClick={ekle} disabled={!yeniAd.trim()} className="bg-[#1B4F72]"><Plus className="h-3 w-3 mr-1" /> Ekle</Button>
            </div>
            <div className="space-y-1">
              {reasons.length === 0 ? (
                <p className="text-xs text-slate-500">Henüz tanım yok.</p>
              ) : reasons.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span>{r.name} <span className="text-xs text-slate-400">· {KATEGORI_ETIKET[r.category] ?? r.category}</span>{!r.isActive && <Badge variant="secondary" className="ml-2">Pasif</Badge>}</span>
                  {r.isActive && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => pasiflestir(r.id)}>Pasifleştir</Button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analiz */}
        {hata ? (
          <p className="text-sm text-red-600">{hata}</p>
        ) : !analiz ? (
          <div className="flex items-center justify-center h-20"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1B4F72]" /></div>
        ) : analiz.satirlar.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz ret kaydı yok. (Toplam REJECTED: {analiz.toplamRet})</p>
        ) : (
          <>
            <div className="text-sm text-slate-500">Toplam ret: {analiz.toplamRet} · nedeni girilen: {analiz.nedenliRet}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500 border-b"><th className="px-3 py-2">Ret Nedeni</th><th className="px-3 py-2">Kategori</th><th className="px-3 py-2">Sayı</th></tr></thead>
                <tbody>
                  {analiz.satirlar.map((s, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2 text-slate-600">{KATEGORI_ETIKET[s.category] ?? s.category}</td>
                      <td className="px-3 py-2 font-semibold text-[#1B4F72]">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              {analiz.kategoriler.map((k) => (
                <Badge key={k.category} variant="secondary">{KATEGORI_ETIKET[k.category] ?? k.category}: {k.count}</Badge>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
