"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { FileText, Plus, Download, Search, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SplitBadge } from "@/components/akademi/SplitBadge"
import {
  DURUM_ETIKETLERI,
  SEBEP_ETIKETLERI,
} from "@/lib/tutanak/tutanak-durum"
import {
  TUTANAK_SIRALAMA_ALANLARI,
  sonrakiSiralama,
  tutanakKpi,
  tutanakSirala,
  tutanakSuz,
  type TutanakSatiri,
  type TutanakSiralama,
  type TutanakSiralamaAlani,
} from "@/lib/tutanak/tutanak-liste"

const DURUM_RENKLERI: Record<string, string> = {
  TASLAK: "bg-slate-100 text-slate-700 border-slate-200",
  SAHIT_BEKLIYOR: "bg-amber-50 text-amber-800 border-amber-200",
  YONETICI_BEKLIYOR: "bg-blue-50 text-blue-800 border-blue-200",
  IK_BEKLIYOR: "bg-violet-50 text-violet-800 border-violet-200",
  TAMAMLANDI: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REDDEDILDI: "bg-rose-50 text-rose-800 border-rose-200",
}

const BASLIKLAR: { alan: TutanakSiralamaAlani; etiket: string }[] = [
  { alan: "tutanakNo", etiket: "Tutanak No" },
  { alan: "tutanakTarihi", etiket: "Tarih" },
  { alan: "adSoyadSnapshot", etiket: "Personel" },
  { alan: "sicilSnapshot", etiket: "Sicil" },
  { alan: "bolumSnapshot", etiket: "Bölüm" },
  { alan: "gorevSnapshot", etiket: "Görev" },
  { alan: "sebep", etiket: "Sebep" },
  { alan: "durum", etiket: "Durum" },
  { alan: "sahitSayisi", etiket: "Şahit" },
  { alan: "yoneticiAd", etiket: "Yönetici" },
  { alan: "acanAd", etiket: "Tutan" },
]

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
    ;(async () => {
      try {
        const res = await fetch("/api/tutanak")
        if (!res.ok) {
          const h = await res.json().catch(() => null)
          toast.error(h?.error || "Tutanaklar yüklenemedi")
          return
        }
        const d = await res.json()
        setSatirlar(d.satirlar ?? [])
        setAcabilir(d.acabilir === true)
      } catch {
        toast.error("Tutanaklar yüklenemedi — bağlantı hatası")
      } finally {
        setYukleniyor(false)
      }
    })()
  }, [])

  const bolumler = useMemo(
    () => [...new Set(satirlar.map((s) => s.bolumSnapshot))].sort((a, b) => a.localeCompare(b, "tr")),
    [satirlar],
  )

  const suzulmus = useMemo(
    () =>
      tutanakSuz(satirlar, {
        arama,
        sebep: sebep as never,
        durum: durum as never,
        bolum: bolum as never,
      }),
    [satirlar, arama, sebep, durum, bolum],
  )
  const gosterilen = useMemo(() => tutanakSirala(suzulmus, siralama), [suzulmus, siralama])
  const kpi = useMemo(() => tutanakKpi(satirlar), [satirlar])

  function Baslik({ alan, etiket }: { alan: TutanakSiralamaAlani; etiket: string }) {
    const aktif = siralama?.alan === alan
    const ikon = !aktif ? "↕" : siralama?.yon === "asc" ? "▲" : "▼"
    return (
      <TableHead>
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => setSiralama((m) => sonrakiSiralama(m, alan))}
          title={`${etiket} sütununa göre sırala`}
        >
          {etiket}
          <span className={aktif ? "text-primary" : "text-muted-foreground/60"}>{ikon}</span>
        </button>
      </TableHead>
    )
  }

  const kpiKartlari = [
    { etiket: "Toplam", deger: kpi.toplam },
    { etiket: "Açık", deger: kpi.acik },
    { etiket: "Şahit Bekleyen", deger: kpi.sahitBekleyen },
    { etiket: "Yönetici Bekleyen", deger: kpi.yoneticiBekleyen },
    { etiket: "İV Bekleyen", deger: kpi.ivBekleyen },
    { etiket: "Tamamlanan", deger: kpi.tamamlanan },
    { etiket: "Reddedilen", deger: kpi.reddedilen },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Tutanak Formu
          </h1>
          <p className="text-muted-foreground">
            IV-FR-03 · şahit onayı → yönetici onayı → İnsan Varlıkları kapanışı
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {acabilir && (
            <Button size="sm" asChild>
              <Link href="/tutanak/yeni">
                <Plus className="h-4 w-4 mr-1" />
                Yeni Tutanak
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={satirlar.length === 0}
            onClick={() => window.open("/api/tutanak/export", "_blank")}
          >
            <Download className="h-4 w-4 mr-1" />
            Excel&apos;e Aktar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {kpiKartlari.map((k) => (
          <Card key={k.etiket}>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">{k.etiket}</p>
              <p className="text-2xl font-semibold">{k.deger}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tutanaklar</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
            Gizli kayıt — hakkında tutanak tutulan personel bu listede kendi kaydını görmez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Tutanak no, personel, sicil, bölüm..."
                value={arama}
                onChange={(e) => setArama(e.target.value)}
              />
            </div>
            <Select value={sebep} onValueChange={setSebep}>
              <SelectTrigger>
                <SelectValue placeholder="Sebep" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HEPSI">Tüm sebepler</SelectItem>
                {Object.entries(SEBEP_ETIKETLERI).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={durum} onValueChange={setDurum}>
              <SelectTrigger>
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HEPSI">Tüm durumlar</SelectItem>
                <SelectItem value="ACIK">Yalnız açık olanlar</SelectItem>
                {Object.entries(DURUM_ETIKETLERI).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={bolum} onValueChange={setBolum}>
              <SelectTrigger>
                <SelectValue placeholder="Bölüm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HEPSI">Tüm bölümler</SelectItem>
                {bolumler.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {yukleniyor ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Yükleniyor...</p>
          ) : gosterilen.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {satirlar.length === 0 ? "Henüz tutanak yok." : "Süzgeçlere uyan tutanak yok."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {BASLIKLAR.map((b) => (
                      <Baslik key={b.alan} alan={b.alan} etiket={b.etiket} />
                    ))}
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gosterilen.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.tutanakNo}</TableCell>
                      <TableCell>{tarihTR(r.tutanakTarihi)}</TableCell>
                      <TableCell className="font-medium">{r.adSoyadSnapshot}</TableCell>
                      <TableCell className="font-mono text-xs">{r.sicilSnapshot ?? "—"}</TableCell>
                      <TableCell>{r.bolumSnapshot}</TableCell>
                      <TableCell className="text-muted-foreground">{r.gorevSnapshot ?? "—"}</TableCell>
                      <TableCell>{SEBEP_ETIKETLERI[r.sebep]}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={DURUM_RENKLERI[r.durum]}>
                          {DURUM_ETIKETLERI[r.durum]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {r.onaylayanSahitSayisi}/{r.sahitSayisi}
                      </TableCell>
                      <TableCell>{r.yoneticiAd ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.acanAd ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <SplitBadge color="blue" left="Tutanak" right="Aç" href={`/tutanak/${r.id}`} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!yukleniyor && gosterilen.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {gosterilen.length} / {satirlar.length} tutanak gösteriliyor
              {TUTANAK_SIRALAMA_ALANLARI.length > 0 && siralama
                ? ` · ${BASLIKLAR.find((b) => b.alan === siralama.alan)?.etiket} sıralı`
                : ""}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
