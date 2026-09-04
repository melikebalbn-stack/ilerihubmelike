"use client"

/**
 * Çözüm Arşivi — kapanan taleplerin çözüm notları + kronik sorunlar.
 *
 * İKİ SEKME:
 *   Arşiv  → yalnız ÇÖZÜM METNİ DOLU talepler (aranacak bir şey var).
 *   Kronik → İT EKİBİNİN TANIMLADIĞI kronik sorunlar. Faz 1'deki otomatik
 *            kategori+cihaz tekrar sayımı KALDIRILDI: "Grafik Tasarım"
 *            altındaki 5 ayrı istek tek kronik sorun sayılıyordu. "Aynı sorun
 *            mu" yargısı insanda.
 *
 * Erişim: IT ekibi (helpdesk.admin veya helpdesk.ticket.resolve). Sunucu da
 * aynı kapıyı uyguluyor — buradaki kontrol yalnız ekranı gizlemek için.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Search, Loader2, BookOpen, AlertTriangle, ArrowLeft, RefreshCw, Plus, CheckCircle2, Link2,
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"

const TUMU = "__tumu__"

interface ArsivKaydi {
  id: string
  ticketNumber: string
  subject: string
  description: string
  resolutionSummary: string | null
  resolvedAt: string | null
  resolvedByEmail: string | null
  resolvedByName: string | null
  categoryId: string | null
  category: { name: string; color: string | null } | null
  zimmetFormuId: string | null
  assetInfo: string | null
  objectionCount: number
  kronikSorunId: string | null
  kronikSorun: { id: string; baslik: string; durum: string } | null
  /** Kronik soruna bağlıysa o soruna bağlı talep sayısı; değilse null. */
  kronikBagliTalep: number | null
}

interface KronikSorun {
  id: string
  baslik: string
  aciklama: string | null
  durum: "AKTIF" | "COZULDU"
  cozumNotu: string | null
  cozulenAt: string | null
  cozenByName: string | null
  createdByName: string
  createdAt: string
  bagliTalep: number
  sonTalepTarihi: string | null
}

interface KronikDetay extends KronikSorun {
  tickets: Array<{
    id: string
    ticketNumber: string
    subject: string
    status: string
    createdAt: string
    resolvedAt: string | null
    resolutionSummary: string | null
    resolvedByName: string | null
    category: { name: string; color: string | null } | null
  }>
}

interface Kategori {
  id: string
  name: string
  color: string | null
}

export default function CozumArsiviPage() {
  const router = useRouter()
  const { data: session, status: oturumDurumu } = useSession()

  const izinler = useMemo(() => session?.user?.permissions ?? [], [session])
  const itEkibi =
    izinler.includes("helpdesk.admin") || izinler.includes("helpdesk.ticket.resolve")

  const [sekme, setSekme] = useState("arsiv")
  const [yukleniyor, setYukleniyor] = useState(true)
  const [kayitlar, setKayitlar] = useState<ArsivKaydi[]>([])
  const [kronikler, setKronikler] = useState<KronikSorun[]>([])
  const [kategoriler, setKategoriler] = useState<Kategori[]>([])
  const [secili, setSecili] = useState<ArsivKaydi | null>(null)

  // Arşiv filtreleri
  const [q, setQ] = useState("")
  const [categoryId, setCategoryId] = useState(TUMU)
  const [cozen, setCozen] = useState(TUMU)
  const [baslangic, setBaslangic] = useState("")
  const [bitis, setBitis] = useState("")

  // Kronik sekmesi
  const [kronikDurum, setKronikDurum] = useState(TUMU)
  const [kronikQ, setKronikQ] = useState("")
  const [kronikDetay, setKronikDetay] = useState<KronikDetay | null>(null)
  const [detayYukleniyor, setDetayYukleniyor] = useState(false)
  const [yeniAcik, setYeniAcik] = useState(false)
  const [yeniBaslik, setYeniBaslik] = useState("")
  const [yeniAciklama, setYeniAciklama] = useState("")
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [cozumAcik, setCozumAcik] = useState(false)
  const [cozumNotu, setCozumNotu] = useState("")

  const arsiviGetir = useCallback(async () => {
    const p = new URLSearchParams()
    if (q.trim()) p.set("q", q.trim())
    if (categoryId !== TUMU) p.set("categoryId", categoryId)
    if (cozen !== TUMU) p.set("cozen", cozen)
    if (baslangic) p.set("baslangic", baslangic)
    if (bitis) p.set("bitis", bitis)
    const res = await fetch(`/api/tickets/cozum-arsivi?${p.toString()}`)
    if (!res.ok) throw new Error("Arşiv yüklenemedi")
    setKayitlar(await res.json())
  }, [q, categoryId, cozen, baslangic, bitis])

  const kronikleriGetir = useCallback(async () => {
    const p = new URLSearchParams()
    if (kronikDurum !== TUMU) p.set("durum", kronikDurum)
    if (kronikQ.trim()) p.set("q", kronikQ.trim())
    const res = await fetch(`/api/tickets/kronik?${p.toString()}`)
    if (!res.ok) throw new Error("Kronik sorunlar yüklenemedi")
    setKronikler(await res.json())
  }, [kronikDurum, kronikQ])

  useEffect(() => {
    if (oturumDurumu !== "authenticated" || !itEkibi) return
    let iptal = false
    ;(async () => {
      setYukleniyor(true)
      try {
        await Promise.all([arsiviGetir(), kronikleriGetir()])
        if (!iptal) {
          const kres = await fetch("/api/tickets/categories")
          if (kres.ok) setKategoriler(await kres.json())
        }
      } catch (e) {
        if (!iptal) toast.error(e instanceof Error ? e.message : "Yükleme başarısız")
      } finally {
        if (!iptal) setYukleniyor(false)
      }
    })()
    return () => {
      iptal = true
    }
  }, [oturumDurumu, itEkibi, arsiviGetir, kronikleriGetir])

  const cozenler = useMemo(() => {
    const m = new Map<string, string>()
    for (const k of kayitlar) {
      if (k.resolvedByEmail) m.set(k.resolvedByEmail, k.resolvedByName || k.resolvedByEmail)
    }
    return Array.from(m.entries())
  }, [kayitlar])

  const detayAc = async (id: string) => {
    setDetayYukleniyor(true)
    try {
      const res = await fetch(`/api/tickets/kronik/${id}`)
      if (!res.ok) throw new Error("Detay yüklenemedi")
      setKronikDetay(await res.json())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Detay yüklenemedi")
    } finally {
      setDetayYukleniyor(false)
    }
  }

  const yeniKaydet = async () => {
    if (!yeniBaslik.trim()) return
    setKaydediliyor(true)
    try {
      const res = await fetch("/api/tickets/kronik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baslik: yeniBaslik.trim(), aciklama: yeniAciklama.trim() }),
      })
      if (!res.ok) {
        const h = await res.json().catch(() => ({}))
        throw new Error(h?.error || "Kaydedilemedi")
      }
      setYeniAcik(false)
      setYeniBaslik("")
      setYeniAciklama("")
      await kronikleriGetir()
      toast.success("Kronik sorun tanımlandı")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi")
    } finally {
      setKaydediliyor(false)
    }
  }

  const cozulduIsaretle = async () => {
    if (!kronikDetay) return
    // Not ZORUNLU — sunucu da 400 ile reddediyor; buton da boşken kapalı.
    if (!cozumNotu.trim()) return
    setKaydediliyor(true)
    try {
      const res = await fetch(`/api/tickets/kronik/${kronikDetay.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durum: "COZULDU", cozumNotu: cozumNotu.trim() }),
      })
      if (!res.ok) {
        const h = await res.json().catch(() => ({}))
        throw new Error(h?.error || "İşlem başarısız")
      }
      setCozumAcik(false)
      setCozumNotu("")
      await Promise.all([kronikleriGetir(), detayAc(kronikDetay.id)])
      toast.success("Kronik sorun çözüldü olarak işaretlendi")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem başarısız")
    } finally {
      setKaydediliyor(false)
    }
  }

  if (oturumDurumu === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!itEkibi) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-3" />
        <h1 className="text-lg font-semibold">Bu sayfaya erişim yetkiniz yok</h1>
        <p className="text-sm text-muted-foreground mt-1">Çözüm arşivi IT ekibine açıktır.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/it-support")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          IT Destek&apos;e dön
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#1B4F72]" />
            Çözüm Arşivi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kapanan taleplerin çözüm notları — benzer sorunda önce buraya bakın.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/it-support")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          IT Destek
        </Button>
      </div>

      <Tabs value={sekme} onValueChange={setSekme}>
        <TabsList>
          <TabsTrigger value="arsiv">Çözüm Arşivi</TabsTrigger>
          <TabsTrigger value="kronik">Kronik Sorunlar</TabsTrigger>
        </TabsList>

        {/* ══════════ ARŞİV ══════════ */}
        <TabsContent value="arsiv" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-5 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Konu ve çözüm metninde ara…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") arsiviGetir().catch(() => toast.error("Arama başarısız"))
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <div>
                  <Label className="text-xs">Kategori</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TUMU}>Tümü</SelectItem>
                      {kategoriler.map((k) => (
                        <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Çözen kişi</Label>
                  <Select value={cozen} onValueChange={setCozen}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TUMU}>Tümü</SelectItem>
                      {cozenler.map(([eposta, ad]) => (
                        <SelectItem key={eposta} value={eposta}>{ad}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Başlangıç</Label>
                  <Input type="date" className="mt-1" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Bitiş</Label>
                  <Input type="date" className="mt-1" value={bitis} onChange={(e) => setBitis(e.target.value)} />
                </div>
                <Button onClick={() => arsiviGetir().catch(() => toast.error("Arama başarısız"))} disabled={yukleniyor}>
                  {yukleniyor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Uygula
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span><b className="text-foreground">{kayitlar.length}</b> çözüm bulundu · en yeni önce</span>
            <span className="text-xs">Yalnız çözüm notu yazılmış talepler listelenir.</span>
          </div>

          {kayitlar.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Ölçütlere uyan çözüm yok.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {kayitlar.map((k) => (
                <Card key={k.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setSecili(k)}>
                  <CardContent className="pt-4">
                    <h3 className="font-medium">{k.subject}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{k.resolutionSummary}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
                      {k.category && (
                        <Badge variant="secondary" style={k.category.color ? { backgroundColor: `${k.category.color}22`, color: k.category.color } : undefined}>
                          {k.category.name}
                        </Badge>
                      )}
                      {k.assetInfo && <Badge variant="outline">{k.assetInfo}</Badge>}
                      {/* Rozet YALNIZ kronik bağı varsa: sayının arkasında insan yargısı var. */}
                      {k.kronikSorun && (
                        <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">
                          <Link2 className="h-3 w-3 mr-1" />
                          {k.kronikSorun.baslik} · {k.kronikBagliTalep} talep
                        </Badge>
                      )}
                      <span>{k.resolvedByName || k.resolvedByEmail || "—"}</span>
                      <span>{k.resolvedAt ? format(new Date(k.resolvedAt), "d MMMM yyyy", { locale: tr }) : "—"}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══════════ KRONİK ══════════ */}
        <TabsContent value="kronik" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Ara</Label>
                  <Input
                    className="mt-1"
                    placeholder="Başlık veya açıklamada ara…"
                    value={kronikQ}
                    onChange={(e) => setKronikQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") kronikleriGetir().catch(() => toast.error("Arama başarısız"))
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Durum</Label>
                  <Select value={kronikDurum} onValueChange={setKronikDurum}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TUMU}>Tümü</SelectItem>
                      <SelectItem value="AKTIF">Aktif</SelectItem>
                      <SelectItem value="COZULDU">Çözüldü</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => kronikleriGetir().catch(() => toast.error("Yükleme başarısız"))}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Uygula
                  </Button>
                  <Button onClick={() => setYeniAcik(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Yeni
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {kronikler.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Henüz tanımlı kronik sorun yok. Tekrarlayan bir sorun gördüğünüzde
              &quot;Yeni&quot; ile tanımlayın, sonra ilgili talepleri talep detayından bu soruna bağlayın.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {kronikler.map((k) => (
                <Card key={k.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => detayAc(k.id)}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{k.baslik}</h3>
                          {k.durum === "COZULDU" ? (
                            <Badge variant="outline" className="border-green-300 text-green-700 dark:text-green-400">Çözüldü</Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">Aktif</Badge>
                          )}
                        </div>
                        {k.aciklama && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{k.aciklama}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Tanımlayan {k.createdByName} ·{" "}
                          {k.sonTalepTarihi
                            ? `son talep ${format(new Date(k.sonTalepTarihi), "d MMM yyyy", { locale: tr })}`
                            : "henüz bağlı talep yok"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-semibold tabular-nums">{k.bagliTalep}</div>
                        <div className="text-xs text-muted-foreground">bağlı talep</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ══════════ ARŞİV DETAY ══════════ */}
      <Dialog open={!!secili} onOpenChange={(a) => !a && setSecili(null)}>
        <DialogContent className="sm:max-w-[660px] max-h-[85vh] overflow-auto">
          {secili && (
            <>
              <DialogHeader>
                <DialogTitle>{secili.subject}</DialogTitle>
                <DialogDescription>
                  {secili.ticketNumber} · {secili.resolvedByName || secili.resolvedByEmail || "—"} ·{" "}
                  {secili.resolvedAt ? format(new Date(secili.resolvedAt), "d MMMM yyyy", { locale: tr }) : "—"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Sorun</p>
                  <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{secili.description}</div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Çözüm</p>
                  <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{secili.resolutionSummary}</div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {secili.category && <Badge variant="secondary">{secili.category.name}</Badge>}
                  {secili.assetInfo && <Badge variant="outline">{secili.assetInfo}</Badge>}
                  {secili.kronikSorun && (
                    <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">
                      <Link2 className="h-3 w-3 mr-1" />
                      {secili.kronikSorun.baslik} · {secili.kronikBagliTalep} talep
                    </Badge>
                  )}
                  {secili.objectionCount > 0 && (
                    <Badge variant="outline" className="border-red-200 text-red-700 dark:text-red-400">
                      {secili.objectionCount} kez itiraz edildi
                    </Badge>
                  )}
                </div>
                <Button variant="outline" onClick={() => router.push(`/it-support/${secili.id}`)}>
                  Talebi aç
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════ KRONİK DETAY ══════════ */}
      <Dialog open={!!kronikDetay} onOpenChange={(a) => !a && setKronikDetay(null)}>
        <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-auto">
          {detayYukleniyor && !kronikDetay ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : kronikDetay ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {kronikDetay.baslik}
                  {kronikDetay.durum === "COZULDU" ? (
                    <Badge variant="outline" className="border-green-300 text-green-700 dark:text-green-400">Çözüldü</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">Aktif</Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {kronikDetay.bagliTalep} bağlı talep · tanımlayan {kronikDetay.createdByName} ·{" "}
                  {format(new Date(kronikDetay.createdAt), "d MMMM yyyy", { locale: tr })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {kronikDetay.aciklama && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Açıklama</p>
                    <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{kronikDetay.aciklama}</div>
                  </div>
                )}

                {kronikDetay.cozumNotu && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      Kalıcı çözüm
                      {kronikDetay.cozenByName ? ` · ${kronikDetay.cozenByName}` : ""}
                      {kronikDetay.cozulenAt ? ` · ${format(new Date(kronikDetay.cozulenAt), "d MMM yyyy", { locale: tr })}` : ""}
                    </p>
                    <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm whitespace-pre-wrap dark:border-green-900 dark:bg-green-950/40">
                      {kronikDetay.cozumNotu}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    Bağlı talepler ({kronikDetay.tickets.length})
                  </p>
                  {kronikDetay.tickets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Henüz talep bağlanmamış. Talep detayında &quot;Kronik soruna bağla&quot; ile bağlayın.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {kronikDetay.tickets.map((t) => (
                        <div key={t.id} className="rounded-md border p-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <button
                                className="text-sm font-medium hover:underline text-left"
                                onClick={() => router.push(`/it-support/${t.id}`)}
                              >
                                {t.ticketNumber} · {t.subject}
                              </button>
                              {t.resolutionSummary ? (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {t.resolutionSummary}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-1 italic">Çözüm notu yazılmamış</p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {format(new Date(t.createdAt), "d MMM yyyy", { locale: tr })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                {kronikDetay.durum === "AKTIF" && (
                  <Button onClick={() => { setCozumNotu(kronikDetay.cozumNotu ?? ""); setCozumAcik(true) }}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Çözüldü olarak işaretle
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ══════════ YENİ KRONİK SORUN ══════════ */}
      <Dialog open={yeniAcik} onOpenChange={setYeniAcik}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Yeni kronik sorun</DialogTitle>
            <DialogDescription>
              Tekrarlayan bir sorunu tanımlayın; ilgili talepleri sonra talep detayından bağlarsınız.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="k-baslik" className="text-sm">Başlık</Label>
              <Input id="k-baslik" className="mt-1.5" placeholder="örn. VPN sertifikası her yıl süresi doluyor"
                value={yeniBaslik} onChange={(e) => setYeniBaslik(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="k-aciklama" className="text-sm">
                Açıklama <span className="text-muted-foreground text-xs font-normal">— opsiyonel</span>
              </Label>
              <Textarea id="k-aciklama" className="mt-1.5 min-h-[100px]"
                placeholder="Belirtiler, hangi durumlarda tekrarlıyor…"
                value={yeniAciklama} onChange={(e) => setYeniAciklama(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setYeniAcik(false)} disabled={kaydediliyor}>Vazgeç</Button>
            <Button onClick={yeniKaydet} disabled={!yeniBaslik.trim() || kaydediliyor}>
              {kaydediliyor && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Tanımla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════ KRONİK ÇÖZÜLDÜ ══════════ */}
      <Dialog open={cozumAcik} onOpenChange={setCozumAcik}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Kronik sorunu çözüldü olarak işaretle</DialogTitle>
            <DialogDescription>{kronikDetay?.baslik}</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="k-cozum" className="text-sm">
              Kalıcı çözüm <span className="text-red-600">*</span>
            </Label>
            <Textarea id="k-cozum" className="mt-1.5 min-h-[130px]"
              placeholder="Sorunun kökten nasıl giderildiğini yazın…"
              value={cozumNotu} onChange={(e) => setCozumNotu(e.target.value)} />
            {/* Ticket çözümünde metin opsiyoneldi; BURADA ZORUNLU — kronik
                sorunun kalıcı çözümü bu kaydın tek arşiv değeri. */}
            <p className="text-xs text-muted-foreground mt-2">
              Zorunlu: kronik sorunun kalıcı çözümü, ileride aynı sorunla karşılaşan ekibin tek dayanağı.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCozumAcik(false)} disabled={kaydediliyor}>Vazgeç</Button>
            <Button onClick={cozulduIsaretle} disabled={!cozumNotu.trim() || kaydediliyor}>
              {kaydediliyor && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Çözüldü olarak işaretle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
