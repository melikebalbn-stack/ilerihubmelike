"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  Minus,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  PackageSearch,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PANEL = "#1B4F72"

// PR-B TODO: hurda nedenleri IFS'ten (ShopFloorService) çekilecek — şimdilik sabit.
const SCRAP_REASONS = [
  { value: "OPERATOR", label: "Operatör hatası" },
  { value: "MACHINE", label: "Makine hatası" },
]
// PR-B TODO: yer/lokasyon listesi IFS stok lokasyonlarından çekilecek — şimdilik sabit.
const LOCATIONS = ["40", "44", "61", "64", "67", "70"]

interface OperationSummary {
  orderNo: string | null
  operationNo: number | null
  description: string | null
  status: string | null
  partNo: string | null
  plannedQty: number | null
  executableQty: number | null
  remainingQty: number | null
  qtyCompleted: number | null
  qtyScrapped: number | null
}

export function OperationReportClient() {
  const searchParams = useSearchParams()
  const initialOrder = searchParams.get("orderNo") ?? ""
  const initialOp = searchParams.get("operationNo") ?? ""

  const [orderInput, setOrderInput] = useState(initialOrder)
  const [opInput, setOpInput] = useState(initialOp)

  const [summary, setSummary] = useState<OperationSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetched, setFetched] = useState(false)

  // Bildirim formu
  const [qtyGood, setQtyGood] = useState("")
  const [qtyScrap, setQtyScrap] = useState("")
  const [scrapReason, setScrapReason] = useState("")
  const [lotNo, setLotNo] = useState("")
  const [location, setLocation] = useState("")

  const resetForm = () => {
    setQtyGood("")
    setQtyScrap("")
    setScrapReason("")
    setLotNo("")
    setLocation("")
  }

  const load = useCallback(async (order: string, op: string) => {
    if (!order.trim()) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ orderNo: order.trim() })
      if (op.trim()) params.set("operationNo", op.trim())
      const res = await fetch(`/api/ifs/operation-summary?${params.toString()}`)
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Operasyon bilgisi alınamadı")
      }
      setSummary(data.found ? (data.summary as OperationSummary) : null)
      resetForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata")
      setSummary(null)
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }, [])

  // İlk açılışta query param varsa otomatik getir.
  useEffect(() => {
    if (initialOrder) load(initialOrder, initialOp)
  }, [initialOrder, initialOp, load])

  const good = Number(qtyGood) || 0
  const scrap = Number(qtyScrap) || 0
  const total = good + scrap
  const executable = summary?.executableQty ?? 0
  const exceeded = total > executable
  const needsReason = scrap > 0 && !scrapReason
  const canReport =
    !!summary && total > 0 && !exceeded && !needsReason

  const stepGood = (delta: number) =>
    setQtyGood(String(Math.max(0, good + delta)))

  const handleReport = () => {
    // PR-A: IFS'e YAZMA YOK. ReportQuantity*/ReceiveOrder çağrılmaz.
    toast.info("IFS gönderimi PR-B'de bağlanacak", {
      description: `Sağlam ${good} · Hurda ${scrap} · Toplam ${total} (önizleme — kaydedilmedi)`,
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">Üretim Bildirimi</h1>
      <p className="text-sm text-muted-foreground mb-6">
        İş emri ve operasyon getirip üretim/hurda bildirin. (Bildirim IFS'e
        bağlanması: PR-B)
      </p>

      {/* İş emri / operasyon getirme alanı */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="grid gap-1.5">
          <Label htmlFor="orderNo">İş Emri No</Label>
          <Input
            id="orderNo"
            className="w-40"
            value={orderInput}
            onChange={(e) => setOrderInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(orderInput, opInput)}
            placeholder="ör. 109"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="opNo">Operasyon No</Label>
          <Input
            id="opNo"
            className="w-32"
            value={opInput}
            onChange={(e) => setOpInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(orderInput, opInput)}
            placeholder="ör. 10"
          />
        </div>
        <Button
          onClick={() => load(orderInput, opInput)}
          disabled={loading || !orderInput.trim()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Getir
        </Button>
      </div>

      {/* Durumlar: yükleniyor / hata / boş / veri */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Operasyon bilgisi yükleniyor…
        </div>
      ) : error ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 py-6 text-sm">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <div className="font-medium text-destructive">
                Operasyon getirilemedi
              </div>
              <div className="text-muted-foreground">{error}</div>
            </div>
          </CardContent>
        </Card>
      ) : !summary ? (
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground py-16 text-center">
          <PackageSearch className="h-8 w-8 opacity-50" />
          {fetched
            ? "Bu iş emri/operasyon için açık bir operasyon bulunamadı."
            : "Başlamak için iş emri ve operasyon numarası girip Getir'e basın."}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* SOL panel — sabit, koyu */}
          <div
            className="rounded-xl p-6 text-white flex flex-col gap-5 self-start"
            style={{ background: PANEL }}
          >
            <div>
              <div className="text-xs uppercase tracking-wide text-white/60">
                İş Emri
              </div>
              <div className="text-lg font-semibold">{summary.orderNo}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-white/60">
                Operasyon
              </div>
              <div className="text-lg font-semibold">
                {summary.operationNo ?? "—"}
              </div>
              <div className="text-sm text-white/80">
                {summary.description ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-white/60">
                Parça
              </div>
              <div className="text-sm">{summary.partNo ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-white/60 mb-1">
                Durum
              </div>
              <Badge variant="secondary">{summary.status ?? "—"}</Badge>
            </div>
            <div className="mt-2 border-t border-white/15 pt-4">
              <div className="text-xs uppercase tracking-wide text-white/60">
                İşlenebilir Miktar
              </div>
              <div className="text-5xl font-semibold leading-tight">
                {summary.executableQty ?? 0}
              </div>
              <div className="text-xs text-white/60 mt-1">
                Planlanan {summary.plannedQty ?? 0} · Kalan{" "}
                {summary.remainingQty ?? 0}
              </div>
            </div>
          </div>

          {/* SAĞ panel — bildirim formu */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bildirim</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Üretim */}
              <section className="space-y-2">
                <Label>Sağlam Miktar</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => stepGood(-1)}
                    disabled={good <= 0}
                    aria-label="Azalt"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    className="w-28 text-center"
                    value={qtyGood}
                    onChange={(e) => setQtyGood(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => stepGood(1)}
                    aria-label="Artır"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </section>

              {/* Hurda */}
              <section className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="scrapQty">Hurda Miktarı</Label>
                  <Input
                    id="scrapQty"
                    type="number"
                    min={0}
                    value={qtyScrap}
                    onChange={(e) => setQtyScrap(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hurda Nedeni</Label>
                  <Select value={scrapReason} onValueChange={setScrapReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {SCRAP_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {needsReason && (
                    <p className="text-xs text-destructive">
                      Hurda için neden seçin.
                    </p>
                  )}
                </div>
              </section>

              {/* Lokasyon */}
              <section className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lotNo">Lot No</Label>
                  <Input
                    id="lotNo"
                    value={lotNo}
                    onChange={(e) => setLotNo(e.target.value)}
                    placeholder="Opsiyonel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Yer</Label>
                  <Select value={location} onValueChange={setLocation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATIONS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </section>
            </CardContent>

            <CardFooter className="flex-col items-stretch gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Toplam</span>
                <span
                  className={
                    exceeded ? "text-destructive font-semibold" : "font-semibold"
                  }
                >
                  {total} / işlenebilir {executable}
                </span>
              </div>
              {exceeded && (
                <p className="text-xs text-destructive">
                  Sağlam + hurda toplamı işlenebilir miktarı ({executable})
                  aşamaz.
                </p>
              )}
              <Button
                onClick={handleReport}
                disabled={!canReport}
                className="text-white hover:opacity-90"
                style={{ background: PANEL }}
              >
                Bildir
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
