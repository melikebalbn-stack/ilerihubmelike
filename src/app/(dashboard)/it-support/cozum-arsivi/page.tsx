"use client"

/**
 * Çözüm Arşivi — kapanan taleplerin çözüm notları + kronik sorunlar.
 *
 * İKİ SEKME, İKİ FARKLI KAYNAK (bilerek):
 *   Arşiv  → yalnız ÇÖZÜM METNİ DOLU talepler (aranacak bir şey var).
 *   Kronik → TÜM talepler, çözüm yazılmamışlar dahil. "Tekrarlıyor ama kimse
 *            çözümünü yazmamış" durumu ancak böyle görünür.
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Search, Loader2, BookOpen, AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react"
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
  tekrarSayisi: number
}

interface KronikGrup {
  anahtar: string
  categoryId: string | null
  kategoriAdi: string
  kategoriRengi: string | null
  zimmetFormuId: string | null
  cihazMetni: string | null
  tekrar: number
  farkliKullanici: number
  sonGorulme: string
  cozumVar: boolean
  ornekTicketId: string | null
  basliklar: string[]
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
  const [kronik, setKronik] = useState<KronikGrup[]>([])
  const [kategoriler, setKategoriler] = useState<Kategori[]>([])
  const [secili, setSecili] = useState<ArsivKaydi | null>(null)

  // Filtreler
  const [q, setQ] = useState("")
  const [categoryId, setCategoryId] = useState(TUMU)
  const [cozen, setCozen] = useState(TUMU)
  const [baslangic, setBaslangic] = useState("")
  const [bitis, setBitis] = useState("")
  const [kronikGun, setKronikGun] = useState("90")
  const [kronikEsik, setKronikEsik] = useState("3")

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

  const kronigiGetir = useCallback(async () => {
    const p = new URLSearchParams({ gun: kronikGun, esik: kronikEsik })
    const res = await fetch(`/api/tickets/cozum-arsivi/kronik?${p.toString()}`)
    if (!res.ok) throw new Error("Kronik sorunlar yüklenemedi")
    const veri = await res.json()
    setKronik(veri.gruplar ?? [])
  }, [kronikGun, kronikEsik])

  useEffect(() => {
    if (oturumDurumu !== "authenticated" || !itEkibi) return
    let iptal = false
    ;(async () => {
      setYukleniyor(true)
      try {
        await Promise.all([arsiviGetir(), kronigiGetir()])
        if (!iptal) {
          // Kategori listesi filtre açılırı için — mevcut uç.
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
  }, [oturumDurumu, itEkibi, arsiviGetir, kronigiGetir])

  // Çözen kişi açılırı: gelen kayıtlardan türetilir (ayrı uç açmaya değmez).
  const cozenler = useMemo(() => {
    const m = new Map<string, string>()
    for (const k of kayitlar) {
      if (k.resolvedByEmail) m.set(k.resolvedByEmail, k.resolvedByName || k.resolvedByEmail)
    }
    return Array.from(m.entries())
  }, [kayitlar])

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
        <p className="text-sm text-muted-foreground mt-1">
          Çözüm arşivi IT ekibine açıktır.
        </p>
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
              Ölçütlere uyan çözüm yok. Çözüm notu yazılmamış talepler burada görünmez —
              tekrar sayıları için &quot;Kronik Sorunlar&quot; sekmesine bakın.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {kayitlar.map((k) => (
                <Card
                  key={k.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => setSecili(k)}
                >
                  <CardContent className="pt-4">
                    <h3 className="font-medium">{k.subject}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {k.resolutionSummary}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
                      {k.category && (
                        <Badge variant="secondary" style={k.category.color ? { backgroundColor: `${k.category.color}22`, color: k.category.color } : undefined}>
                          {k.category.name}
                        </Badge>
                      )}
                      {k.assetInfo && <Badge variant="outline">{k.assetInfo}</Badge>}
                      {k.tekrarSayisi > 1 && (
                        <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">
                          {k.tekrarSayisi} kez tekrarlandı
                        </Badge>
                      )}
                      <span>{k.resolvedByName || k.resolvedByEmail || "—"}</span>
                      <span>
                        {k.resolvedAt ? format(new Date(k.resolvedAt), "d MMMM yyyy", { locale: tr }) : "—"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══════════ KRONİK ══════════ */}
        <TabsContent value="kronik" className="space-y-4 mt-4">
          <div className="flex gap-2 items-start rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Bu sekme <b>tüm talepleri</b> sayar — çözüm notu yazılmamış olanlar dahil.
              Böylece &quot;tekrarlıyor ama kimse çözümünü yazmamış&quot; durumları da görünür.
            </span>
          </div>

          <Card>
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <Label className="text-xs">Dönem</Label>
                  <Select value={kronikGun} onValueChange={setKronikGun}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="90">Son 90 gün</SelectItem>
                      <SelectItem value="180">Son 180 gün</SelectItem>
                      <SelectItem value="365">Son 1 yıl</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">En az tekrar</Label>
                  <Select value={kronikEsik} onValueChange={setKronikEsik}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 kez</SelectItem>
                      <SelectItem value="5">5 kez</SelectItem>
                      <SelectItem value="10">10 kez</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => kronigiGetir().catch(() => toast.error("Yükleme başarısız"))} disabled={yukleniyor}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Uygula
                </Button>
              </div>
            </CardContent>
          </Card>

          {kronik.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Seçilen dönemde eşiği aşan tekrarlayan konu yok.
            </CardContent></Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Son {kronikGun} günde {kronikEsik}+ kez tekrarlayan {kronik.length} konu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {kronik.map((g) => (
                  <div key={g.anahtar} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">{g.kategoriAdi}</Badge>
                          {g.cihazMetni && <Badge variant="outline">{g.cihazMetni}</Badge>}
                          {g.cozumVar ? (
                            <Badge variant="outline" className="border-green-300 text-green-700 dark:text-green-400">
                              Çözüm yazılmış
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Çözüm yazılmamış
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {g.basliklar.join(" · ")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {g.farkliKullanici} farklı kullanıcı · son görülme{" "}
                          {format(new Date(g.sonGorulme), "d MMM yyyy", { locale: tr })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-semibold tabular-nums">{g.tekrar}</div>
                        <div className="text-xs text-muted-foreground">tekrar</div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ══════════ DETAY ══════════ */}
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
                  {secili.tekrarSayisi > 1 && <Badge variant="outline">{secili.tekrarSayisi} kez tekrarlandı</Badge>}
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
    </div>
  )
}
