"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect as Select } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Plus,
  Trash2,
  ChevronRight,
  ArrowLeft,
  TrendingUp,
  RefreshCw,
  Download,
  Building2,
  Loader2,
  CheckCircle,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

type ExchangeRate = {
  id: string
  fromCurrency: string
  toCurrency: string
  rate: number
  effectiveDate: string
  createdAt: string
}

type TCMBCurrency = {
  code: string
  name: string
  forexBuying: number
  forexSelling: number
}

type TCMBResponse = {
  date: string
  currencies: TCMBCurrency[]
  source: string
  fetchedAt: string
}

const currencies = [
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "ABD Doları" },
  { code: "TRY", symbol: "₺", name: "Türk Lirası" },
  { code: "GBP", symbol: "£", name: "İngiliz Sterlini" },
]

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export default function ExchangeRatesSettingsPage() {
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingRate, setDeletingRate] = useState<ExchangeRate | null>(null)

  // TCMB state
  const [tcmbDialogOpen, setTcmbDialogOpen] = useState(false)
  const [tcmbLoading, setTcmbLoading] = useState(false)
  const [tcmbSaving, setTcmbSaving] = useState(false)
  const [tcmbData, setTcmbData] = useState<TCMBResponse | null>(null)
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(["USD", "EUR", "GBP"])

  const [formData, setFormData] = useState({
    fromCurrency: "USD",
    toCurrency: "TRY",
    rate: "",
    effectiveDate: new Date().toISOString().split("T")[0],
  })

  const loadRates = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/cost-analysis/exchange-rates")
      if (res.ok) {
        const data = await res.json()
        setRates(data)
      }
    } catch (error) {
      console.error("Döviz kurları yüklenirken hata:", error)
      toast.error("Döviz kurları yüklenirken hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRates()
  }, [])

  const handleSubmit = async () => {
    if (!formData.fromCurrency || !formData.toCurrency || !formData.rate) {
      toast.error("Tüm alanlar zorunludur")
      return
    }

    if (formData.fromCurrency === formData.toCurrency) {
      toast.error("Kaynak ve hedef para birimi aynı olamaz")
      return
    }

    try {
      const res = await fetch("/api/cost-analysis/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Döviz kuru eklendi")
        setDialogOpen(false)
        setFormData({
          fromCurrency: "USD",
          toCurrency: "TRY",
          rate: "",
          effectiveDate: new Date().toISOString().split("T")[0],
        })
        await loadRates()
      } else {
        const error = await res.json()
        toast.error(error.error || "İşlem başarısız")
      }
    } catch (error) {
      toast.error("İşlem sırasında hata oluştu")
    }
  }

  const handleDelete = async () => {
    if (!deletingRate) return

    try {
      const res = await fetch(`/api/cost-analysis/exchange-rates?id=${deletingRate.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Döviz kuru silindi")
        setDeleteDialogOpen(false)
        setDeletingRate(null)
        await loadRates()
      } else {
        const error = await res.json()
        toast.error(error.error || "Silme başarısız")
      }
    } catch (error) {
      toast.error("Silme sırasında hata oluştu")
    }
  }

  // TCMB'den kurları getir
  const fetchTCMBRates = async () => {
    try {
      setTcmbLoading(true)
      setTcmbDialogOpen(true)

      const res = await fetch("/api/cost-analysis/exchange-rates/tcmb")
      if (res.ok) {
        const data: TCMBResponse = await res.json()
        setTcmbData(data)
      } else {
        const error = await res.json()
        toast.error(error.error || "TCMB kurları alınamadı")
        setTcmbDialogOpen(false)
      }
    } catch (error) {
      toast.error("TCMB kurları alınırken hata oluştu")
      setTcmbDialogOpen(false)
    } finally {
      setTcmbLoading(false)
    }
  }

  // TCMB kurlarını kaydet
  const saveTCMBRates = async () => {
    if (selectedCurrencies.length === 0) {
      toast.error("En az bir para birimi seçin")
      return
    }

    try {
      setTcmbSaving(true)

      const res = await fetch("/api/cost-analysis/exchange-rates/tcmb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currencies: selectedCurrencies }),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`${data.results.saved.length} kur kaydedildi`)
        setTcmbDialogOpen(false)
        await loadRates()
      } else {
        const error = await res.json()
        toast.error(error.error || "Kurlar kaydedilemedi")
      }
    } catch (error) {
      toast.error("Kaydetme sırasında hata oluştu")
    } finally {
      setTcmbSaving(false)
    }
  }

  const getCurrencySymbol = (code: string) => {
    return currencies.find((c) => c.code === code)?.symbol || code
  }

  const getCurrencyName = (code: string) => {
    return currencies.find((c) => c.code === code)?.name || code
  }

  const toggleCurrency = (code: string) => {
    if (selectedCurrencies.includes(code)) {
      setSelectedCurrencies(selectedCurrencies.filter((c) => c !== code))
    } else {
      setSelectedCurrencies([...selectedCurrencies, code])
    }
  }

  // En güncel TRY kurlarını göster
  const latestTRYRates = currencies
    .filter((c) => c.code !== "TRY")
    .slice(0, 4)
    .map((currency) => {
      const rate = rates.find(
        (r) => r.fromCurrency === currency.code && r.toCurrency === "TRY"
      )
      return { ...currency, rate }
    })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 text-sm mb-2">
            <Link href="/cost-analysis" className="text-teal-600 hover:underline">
              Maliyet Analizleri
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <Link href="/cost-analysis/settings" className="text-teal-600 hover:underline">
              Ayarlar
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">Döviz Kurları</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Döviz Kurları</h1>
          <p className="text-gray-500 mt-1">Para birimi dönüşüm kurlarını yönetin</p>
        </div>
        <div className="flex space-x-2">
          <Link href="/cost-analysis/settings">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri
            </Button>
          </Link>
          <Button variant="outline" onClick={loadRates}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Yenile
          </Button>
          <Button variant="outline" onClick={fetchTCMBRates} className="bg-red-50 border-red-200 hover:bg-red-100 text-red-700">
            <Building2 className="h-4 w-4 mr-2" />
            TCMB'den Güncelle
          </Button>
          <Button onClick={() => {
            setFormData({
              fromCurrency: "USD",
              toCurrency: "TRY",
              rate: "",
              effectiveDate: new Date().toISOString().split("T")[0],
            })
            setDialogOpen(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Manuel Ekle
          </Button>
        </div>
      </div>

      {/* Guide Box */}
      <div className="bg-[#E0F2F1] rounded-lg p-5 border-l-4 border-teal-500">
        <h3 className="font-semibold text-teal-800 mb-2">Döviz Kuru Yönetimi</h3>
        <p className="text-teal-700 text-sm mb-3">
          Döviz kurları, farklı para birimlerindeki maliyetleri karşılaştırmak ve TRY'ye dönüştürmek için kullanılır.
        </p>
        <div className="flex items-center space-x-2 text-sm">
          <Building2 className="h-4 w-4 text-red-600" />
          <span className="text-teal-700">
            <strong>TCMB'den Güncelle</strong> butonu ile Türkiye Cumhuriyet Merkez Bankası'ndan güncel kurları otomatik çekebilirsiniz.
          </span>
        </div>
      </div>

      {/* Current Rates Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {latestTRYRates.map((currency) => (
          <Card key={currency.code} className="bg-gradient-to-br from-gray-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{currency.name}</p>
                  <p className="text-2xl font-bold">{currency.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{currency.code}/TRY</p>
                  <p className="text-lg font-semibold text-teal-600">
                    {currency.rate ? `₺${Number(currency.rate.rate).toFixed(2)}` : "-"}
                  </p>
                  {currency.rate && (
                    <p className="text-xs text-gray-400">
                      {formatDate(currency.rate.effectiveDate)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-teal-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <CardTitle>Kur Geçmişi</CardTitle>
                <CardDescription>{rates.length} kayıt</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Hedef</TableHead>
                  <TableHead className="text-right">Kur</TableHead>
                  <TableHead>Geçerlilik Tarihi</TableHead>
                  <TableHead>Oluşturma Tarihi</TableHead>
                  <TableHead className="text-center w-20">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      <span className="font-medium">{getCurrencySymbol(rate.fromCurrency)}</span>
                      <span className="text-gray-500 ml-1">{rate.fromCurrency}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{getCurrencySymbol(rate.toCurrency)}</span>
                      <span className="text-gray-500 ml-1">{rate.toCurrency}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-teal-600">
                      {Number(rate.rate).toFixed(4)}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {formatDate(rate.effectiveDate)}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {formatDate(rate.createdAt)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingRate(rate)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      Henüz döviz kuru eklenmemiş. TCMB'den güncel kurları çekebilirsiniz.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* TCMB Dialog */}
      <Dialog open={tcmbDialogOpen} onOpenChange={setTcmbDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-red-600" />
              <span>TCMB Döviz Kurları</span>
            </DialogTitle>
            <DialogDescription>
              T.C. Merkez Bankası'ndan güncel döviz kurlarını çekin ve sisteme kaydedin.
            </DialogDescription>
          </DialogHeader>

          {tcmbLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-red-600" />
              <span className="ml-3 text-gray-600">TCMB'den kurlar alınıyor...</span>
            </div>
          ) : tcmbData ? (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">
                    TCMB Kur Tarihi: {tcmbData.date}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  Kaynak: {tcmbData.source}
                </span>
              </div>

              <div className="text-sm text-gray-600 mb-2">
                Kaydetmek istediğiniz para birimlerini seçin:
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedCurrencies.length === tcmbData.currencies.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCurrencies(tcmbData.currencies.map(c => c.code))
                            } else {
                              setSelectedCurrencies([])
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Para Birimi</TableHead>
                      <TableHead className="text-right">Alış</TableHead>
                      <TableHead className="text-right">Satış</TableHead>
                      <TableHead className="text-right">Ortalama</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tcmbData.currencies.map((currency) => {
                      const avg = ((currency.forexBuying + currency.forexSelling) / 2).toFixed(4)
                      return (
                        <TableRow
                          key={currency.code}
                          className={selectedCurrencies.includes(currency.code) ? "bg-teal-50" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedCurrencies.includes(currency.code)}
                              onCheckedChange={() => toggleCurrency(currency.code)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-lg">{getCurrencySymbol(currency.code)}</span>
                              <div>
                                <span className="font-medium">{currency.code}</span>
                                <span className="text-gray-500 text-sm ml-2">{getCurrencyName(currency.code)}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ₺{currency.forexBuying.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ₺{currency.forexSelling.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-teal-600">
                            ₺{avg}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                <strong>Not:</strong> Ortalama kur (alış ve satış ortalaması) kaydedilecektir.
                Seçili: {selectedCurrencies.length} para birimi
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTcmbDialogOpen(false)}>
              İptal
            </Button>
            <Button
              onClick={saveTCMBRates}
              disabled={tcmbLoading || tcmbSaving || selectedCurrencies.length === 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {tcmbSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Seçilenleri Kaydet ({selectedCurrencies.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manuel Döviz Kuru Ekle</DialogTitle>
            <DialogDescription>
              Döviz kuru bilgilerini manuel olarak girin
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kaynak Para Birimi *</Label>
                <Select
                  value={formData.fromCurrency}
                  onChange={(e) => setFormData({ ...formData, fromCurrency: e.target.value })}
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} {c.code} - {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hedef Para Birimi *</Label>
                <Select
                  value={formData.toCurrency}
                  onChange={(e) => setFormData({ ...formData, toCurrency: e.target.value })}
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} {c.code} - {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kur Değeri *</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  placeholder="36.5000"
                />
              </div>
              <div className="space-y-2">
                <Label>Geçerlilik Tarihi</Label>
                <Input
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                />
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
              <strong>Örnek:</strong> 1 {formData.fromCurrency} = {formData.rate || "?"} {formData.toCurrency}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSubmit}>
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Döviz Kuru Sil</DialogTitle>
            <DialogDescription>
              {deletingRate && (
                <>
                  {deletingRate.fromCurrency}/{deletingRate.toCurrency} = {Number(deletingRate.rate).toFixed(4)}
                  ({formatDate(deletingRate.effectiveDate)}) kurunu silmek istediğinize emin misiniz?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
