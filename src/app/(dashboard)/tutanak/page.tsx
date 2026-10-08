"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Download, Eye, FileWarning, Plus, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { DURUM_ETIKETLERI, DURUM_RENK, SEBEP_ETIKETLERI } from "@/lib/tutanak/tutanak-durum"
import {
  sonrakiSiralama,
  tutanakKpi,
  tutanakSirala,
  tutanakSuz,
  type TutanakSatiri,
  type TutanakSiralama,
  type TutanakSiralamaAlani,
} from "@/lib/tutanak/tutanak-liste"

const BASLIKLAR: { alan: TutanakSiralamaAlani; etiket: string; sagaYatik?: boolean }[] = [
  { alan: "tutanakNo", etiket: "Tutanak No" },
  { alan: "tutanakTarihi", etiket: "Tarih" },
  { alan: "adSoyadSnapshot", etiket: "Personel" },
  { alan: "sicilSnapshot", etiket: "Sicil" },
  { alan: "bolumSnapshot", etiket: "Bölüm" },
  { alan: "gorevSnapshot", etiket: "Görev" },
  { alan: "sebep", etiket: "Sebep" },
  { alan: "durum", etiket: "Durum" },
  { alan: "sahitSayisi", etiket: "Şahit", sagaYatik: true },
  { alan: "yoneticiAd", etiket: "Yönetici" },
  { alan: "acanAd", etiket: "Tutan" },
]

// PDKS kart ekranı / izin bakiyeleri ile aynı özet kartı deseni (ui/card üzerine;
// Hub'da paylaşılan bir KPI bileşeni yok, desen tekrarlanıyor).
function OzetKart({
  baslik,
  deger,
  ton,
}: {
  baslik: string
  deger: number
  ton: "mavi" | "turuncu" | "mor" | "yesil" | "kirmizi" | "gri"
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div
          className={cn(
            "text-xs font-medium",
            ton === "mavi" && "text-blue-700",
            ton === "turuncu" && "text-amber-700",
            ton === "mor" && "text-violet-700",
            ton === "yesil" && "text-emerald-700",
            ton === "kirmizi" && "text-rose-700",
            ton === "gri" && "text-slate-500",
          )}
        >
          {baslik}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{deger}</div>
      </CardContent>
    </Card>
  )
}

function tarihTR(d: string | Date): string {
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? "—" : t.toLocaleDateString("tr-TR")
}

export default function TutanakListePage() {
  const [satirlar, setSatirlar] = useState<TutanakSatiri[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [acabilir, setAcabilir] = useState(false)
  const [arama, setArama] = useState("")
  const [sebep, setSebep] = useState<string>("HEPSI")
  const [durum, setDurum] = useState<string>("HEPSI")
  const [bolum, setBolum] = useState<string>("HEPSI")
  const [siralama, setSiralama] = useState<TutanakSiralama>(null)

  useEffect(() => {
    let iptal = false
    ;(async () => {
      try {
        const res = await fetch("/api/tutanak")
        if (!res.ok) {
          const h = await res.json().catch(() => null)
          if (!iptal) toast.error(h?.error || "Tutanaklar yüklenemedi")
          return
        }
        const d = await res.json()
        if (iptal) return
        setSatirlar(d.satirlar ?? [])
        setAcabilir(d.acabilir === true)
      } catch {
        if (!iptal) toast.error("Tutanaklar yüklenemedi — bağlantı hatası")
      } finally {
        if (!iptal) setYukleniyor(false)
      }
    })()
    return () => {
      iptal = true
    }
  }, [])

  const bolumler = useMemo(
    () => [...new Set(satirlar.map((s) => s.bolumSnapshot))].sort((a, b) => a.localeCompare(b, "tr")),
    [satirlar],
  )
  const suzulmus = useMemo(
    () => tutanakSuz(satirlar, { arama, sebep: sebep as never, durum: durum as never, bolum: bolum as never }),
    [satirlar, arama, sebep, durum, bolum],
  )
  const gosterilen = useMemo(() => tutanakSirala(suzulmus, siralama), [suzulmus, siralama])
  const kpi = useMemo(() => tutanakKpi(satirlar), [satirlar])
  const sutunSayisi = BASLIKLAR.length + 1

  function Baslik({ alan, etiket, sagaYatik }: { alan: TutanakSiralamaAlani; etiket: string; sagaYatik?: boolean }) {
    const aktif = siralama?.alan === alan
    return (
      <th className={cn("px-3 py-2", sagaYatik ? "text-center" : "text-left")}>
        <button
          type="button"
          onClick={() => setSiralama((m) => sonrakiSiralama(m, alan))}
          className={cn("inline-flex items-center gap-1", aktif ? "font-semibold text-slate-900" : "text-slate-600")}
          title="Sıralamak için tıklayın (artan → azalan → kapalı)"
        >
          {etiket}
          <span aria-hidden className="text-[10px]">
            {aktif ? (siralama!.yon === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </button>
      </th>
    )
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#1B4F72] flex items-center gap-2">
            <FileWarning className="h-6 w-6" />
            Tutanak Formu
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            IV-FR-03 · şahit onayı → yönetici onayı → İnsan Varlıkları kapanışı · {satirlar.length} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled={satirlar.length === 0}
            onClick={() => window.open("/api/tutanak/export", "_blank")}
          >
            <Download className="h-4 w-4 mr-1 shrink-0" />
            Excel&apos;e Aktar
          </Button>
          {acabilir && (
            <Button asChild className="bg-[#1B4F72] hover:bg-[#1B4F72]/90 shrink-0">
              <Link href="/tutanak/yeni" className="inline-flex items-center gap-1 whitespace-nowrap">
                <Plus className="h-4 w-4 shrink-0" />
                Yeni Tutanak
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-7">
        <OzetKart baslik="Toplam" deger={kpi.toplam} ton="gri" />
        <OzetKart baslik="Açık" deger={kpi.acik} ton="mavi" />
        <OzetKart baslik="Şahit bekleyen" deger={kpi.sahitBekleyen} ton="turuncu" />
        <OzetKart baslik="Yönetici bekleyen" deger={kpi.yoneticiBekleyen} ton="mavi" />
        <OzetKart baslik="İV bekleyen" deger={kpi.ivBekleyen} ton="mor" />
        <OzetKart baslik="Tamamlanan" deger={kpi.tamamlanan} ton="yesil" />
        <OzetKart baslik="Reddedilen" deger={kpi.reddedilen} ton="kirmizi" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        Gizli kayıt — hakkında tutanak tutulan personel bu listede kendi kaydını görmez.
      </div>

      {/* Filtre bar */}
      <div className="rounded-md border bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs text-slate-600">Ara (tutanak no / personel / sicil / bölüm)</Label>
            <Input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="TUT-2026-…, ad, sicil veya bölüm"
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Sebep</Label>
            <Select value={sebep} onValueChange={setSebep}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HEPSI">Tümü</SelectItem>
                {Object.entries(SEBEP_ETIKETLERI).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Durum</Label>
            <Select value={durum} onValueChange={setDurum}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HEPSI">Tümü</SelectItem>
                <SelectItem value="ACIK">Yalnız açık olanlar</SelectItem>
                {Object.entries(DURUM_ETIKETLERI).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Bölüm</Label>
            <Select value={bolum} onValueChange={setBolum}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HEPSI">Tümü</SelectItem>
                {bolumler.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {BASLIKLAR.map((b) => (
                <Baslik key={b.alan} alan={b.alan} etiket={b.etiket} sagaYatik={b.sagaYatik} />
              ))}
              <th className="text-right px-3 py-2">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {yukleniyor ? (
              <tr>
                <td colSpan={sutunSayisi} className="px-3 py-8 text-center text-slate-400">
                  Yükleniyor…
                </td>
              </tr>
            ) : gosterilen.length === 0 ? (
              <tr>
                <td colSpan={sutunSayisi} className="px-3 py-8 text-center text-slate-400">
                  {satirlar.length === 0 ? "Kayıt yok" : "Süzgeçlere uyan kayıt yok"}
                </td>
              </tr>
            ) : (
              gosterilen.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={`/tutanak/${r.id}`} className="font-medium text-[#1B4F72] hover:underline">
                      {r.tutanakNo}
                    </Link>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{tarihTR(r.tutanakTarihi)}</td>
                  <td className="px-3 py-2 font-medium">{r.adSoyadSnapshot}</td>
                  <td className="px-3 py-2">{r.sicilSnapshot ?? "—"}</td>
                  <td className="px-3 py-2">{r.bolumSnapshot}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate" title={r.gorevSnapshot ?? ""}>
                    {r.gorevSnapshot ?? "—"}
                  </td>
                  <td className="px-3 py-2">{SEBEP_ETIKETLERI[r.sebep]}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${DURUM_RENK[r.durum] ?? "bg-slate-100 text-slate-700"}`}
                    >
                      {DURUM_ETIKETLERI[r.durum]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {r.onaylayanSahitSayisi}/{r.sahitSayisi}
                  </td>
                  <td className="px-3 py-2">{r.yoneticiAd ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{r.acanAd ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/tutanak/${r.id}`}>
                      <Button variant="ghost" size="icon" title="Görüntüle">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!yukleniyor && gosterilen.length > 0 && (
        <p className="text-xs text-slate-500">
          {gosterilen.length} / {satirlar.length} tutanak gösteriliyor
        </p>
      )}
    </div>
  )
}
