"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Save, Loader2, Eye, EyeOff, AlertTriangle, Shield, Plus, Trash2, Landmark } from "lucide-react"
import { toast } from "sonner"

type BankAccount = {
  id?: string
  bankaAdi: string | null
  bankaSube: string | null
  hesapNo: string | null
  ibanNo: string | null
  isPrimary: boolean
  aktif: boolean
  aciklama?: string | null
}

type SensitiveData = {
  tcKimlikNo: string | null
  sgkNo: string | null
  dogumTarihi: string | null
  bankAccounts: BankAccount[]
  updatedBy: string | null
  updatedAt: string | null
}

const ADMIN_ROLES = ["ADMIN", "HR_MANAGER", "SUPER_ADMIN"]
const EDIT_ROLES = ["ADMIN", "SUPER_ADMIN"]
const NAVY = "#1B4F72"

export default function SensitivePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const userRole = session?.user?.role as string

  const isAdmin = ADMIN_ROLES.includes(userRole)
  const canEdit = EDIT_ROLES.includes(userRole)

  const [data, setData] = useState<SensitiveData | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [unmasked, setUnmasked] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    if (!isAdmin) return
    fetchData(false)
  }, [id, status])

  const fetchData = async (unmask: boolean) => {
    try {
      setLoading(true)
      const url = unmask ? `/api/personnel/${id}/sensitive?unmask=true` : `/api/personnel/${id}/sensitive`
      const res = await fetch(url)
      if (!res.ok) throw new Error("Veriler yüklenemedi")
      const json = await res.json()
      setData(json)
      setForm({
        tcKimlikNo: json.tcKimlikNo ?? "",
        sgkNo: json.sgkNo ?? "",
        dogumTarihi: json.dogumTarihi ? new Date(json.dogumTarihi).toISOString().slice(0, 10) : "",
      })
      setAccounts(
        (json.bankAccounts ?? []).map((a: BankAccount) => ({
          id: a.id,
          bankaAdi: a.bankaAdi ?? "",
          bankaSube: a.bankaSube ?? "",
          hesapNo: a.hesapNo ?? "",
          ibanNo: a.ibanNo ?? "",
          isPrimary: !!a.isPrimary,
          aktif: a.aktif !== false,
          aciklama: a.aciklama ?? "",
        }))
      )
      if (unmask) setUnmasked(true)
    } catch (err: any) {
      toast.error(err.message || "Veriler yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  const handleUnmask = () => fetchData(true)

  const setAccountField = (idx: number, field: keyof BankAccount, value: any) => {
    setAccounts((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)))
  }
  const setPrimary = (idx: number) => {
    setAccounts((prev) => prev.map((a, i) => ({ ...a, isPrimary: i === idx })))
  }
  const addAccount = () => {
    setAccounts((prev) => [
      ...prev,
      { bankaAdi: "", bankaSube: "", hesapNo: "", ibanNo: "", isPrimary: prev.length === 0, aktif: true, aciklama: "" },
    ])
  }
  const removeAccount = (idx: number) => {
    setAccounts((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      // Silinen primary ise ve başka hesap varsa ilkini primary yap
      if (prev[idx]?.isPrimary && next.length > 0 && !next.some((a) => a.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true }
      }
      return next
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch(`/api/personnel/${id}/sensitive`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tcKimlikNo: form.tcKimlikNo,
          sgkNo: form.sgkNo,
          dogumTarihi: form.dogumTarihi,
          bankAccounts: accounts,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || err.message || "Güncelleme başarısız")
      }
      toast.success("Hassas bilgiler güncellendi")
      setEditMode(false)
      fetchData(true)
    } catch (err: any) {
      toast.error(err.message || "Bir hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  const calculateAge = (dateStr: string | null) => {
    if (!dateStr) return null
    try {
      const birth = new Date(dateStr)
      const today = new Date()
      let age = today.getFullYear() - birth.getFullYear()
      const m = today.getMonth() - birth.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
      return age
    } catch {
      return null
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-"
    try {
      return new Date(dateStr).toLocaleDateString("tr-TR")
    } catch {
      return "-"
    }
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-"
    try {
      return new Date(dateStr).toLocaleString("tr-TR")
    } catch {
      return "-"
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-red-600 mb-2">Erişim Reddedildi (403)</h2>
        <p className="text-muted-foreground mb-4">Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
        <Button variant="outline" asChild>
          <Link href={`/personnel/${id}`}>Personel Detayına Dön</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/personnel/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Geri
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Hassas Bilgiler</h1>
      </div>

      {/* Warning Banner */}
      <div className="rounded-lg border-l-4 border-orange-500 bg-orange-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
          <p className="text-sm text-orange-800">
            Bu sayfa KVKK kapsamında kişisel veri içermektedir.
            Tüm erişimler ISO 27001 A.8.15 gereği loglanmaktadır.
          </p>
        </div>
      </div>

      {/* Sensitive Data Card */}
      <Card className="bg-red-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Kişisel Veriler</CardTitle>
            <div className="flex items-center gap-2">
              {!unmasked && (
                <Button variant="outline" size="sm" onClick={handleUnmask}>
                  <Eye className="h-4 w-4 mr-2" />
                  Göster
                </Button>
              )}
              {unmasked && !editMode && (
                <Button variant="ghost" size="sm" onClick={() => { setUnmasked(false); fetchData(false) }}>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Gizle
                </Button>
              )}
              {canEdit && !editMode && (
                <Button size="sm" onClick={() => { if (!unmasked) fetchData(true); setEditMode(true) }}>
                  Düzenle
                </Button>
              )}
              {editMode && (
                <>
                  <Button variant="outline" size="sm" onClick={() => { setEditMode(false); fetchData(unmasked) }}>İptal</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Save className="h-4 w-4 mr-2" />
                    Kaydet
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>TC Kimlik No</Label>
                <Input value={form.tcKimlikNo || ""} onChange={(e) => setForm(prev => ({ ...prev, tcKimlikNo: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>SGK No</Label>
                <Input value={form.sgkNo || ""} onChange={(e) => setForm(prev => ({ ...prev, sgkNo: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Doğum Tarihi</Label>
                <Input type="date" value={form.dogumTarihi || ""} onChange={(e) => setForm(prev => ({ ...prev, dogumTarihi: e.target.value }))} />
              </div>
            </div>
          ) : data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">TC Kimlik No</p>
                <p className="font-medium font-mono">{data.tcKimlikNo || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">SGK No</p>
                <p className="font-medium font-mono">{data.sgkNo || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Doğum Tarihi</p>
                <p className="font-medium">
                  {formatDate(data.dogumTarihi)}
                  {data.dogumTarihi && calculateAge(data.dogumTarihi) !== null && (
                    <span className="text-muted-foreground ml-2">({calculateAge(data.dogumTarihi)} yaş)</span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Veri bulunamadı</p>
          )}
        </CardContent>
      </Card>

      {/* Banka Hesapları Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2" style={{ color: NAVY }}>
            <Landmark className="h-5 w-5" />
            Banka Hesapları
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {editMode ? (
            <>
              <RadioGroup
                value={String(accounts.findIndex((a) => a.isPrimary))}
                onValueChange={(v) => setPrimary(Number(v))}
                className="space-y-4"
              >
                {accounts.map((a, idx) => (
                  <div key={idx} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value={String(idx)} id={`primary-${idx}`} />
                        <Label htmlFor={`primary-${idx}`} className="cursor-pointer">Maaş hesabı</Label>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Switch checked={a.aktif} onCheckedChange={(v) => setAccountField(idx, "aktif", v)} />
                          <span className="text-sm text-muted-foreground">Aktif</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeAccount(idx)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Banka Adı</Label>
                        <Input value={a.bankaAdi || ""} onChange={(e) => setAccountField(idx, "bankaAdi", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Banka Şube</Label>
                        <Input value={a.bankaSube || ""} onChange={(e) => setAccountField(idx, "bankaSube", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Hesap No</Label>
                        <Input value={a.hesapNo || ""} onChange={(e) => setAccountField(idx, "hesapNo", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>IBAN No</Label>
                        <Input value={a.ibanNo || ""} onChange={(e) => setAccountField(idx, "ibanNo", e.target.value)} placeholder="TR..." />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Açıklama</Label>
                        <Input value={a.aciklama || ""} onChange={(e) => setAccountField(idx, "aciklama", e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </RadioGroup>
              <Button variant="outline" size="sm" onClick={addAccount}>
                <Plus className="h-4 w-4 mr-2" />
                Hesap Ekle
              </Button>
            </>
          ) : (data?.bankAccounts?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {data!.bankAccounts.map((a, idx) => (
                <div key={a.id || idx} className={`rounded-lg border p-4 ${!a.aktif ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.bankaAdi || "Banka"}</span>
                      {a.isPrimary && (
                        <Badge style={{ backgroundColor: NAVY }}>Maaş Hesabı</Badge>
                      )}
                      {!a.aktif && <Badge variant="secondary">Pasif</Badge>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Banka Şube</p>
                      <p className="font-medium">{a.bankaSube || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Hesap No</p>
                      <p className="font-medium font-mono">{a.hesapNo || "-"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-muted-foreground">IBAN No</p>
                      <p className="font-medium font-mono">{a.ibanNo || "-"}</p>
                    </div>
                    {a.aciklama && (
                      <div className="md:col-span-2">
                        <p className="text-muted-foreground">Açıklama</p>
                        <p className="font-medium">{a.aciklama}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Kayıtlı banka hesabı yok.</p>
          )}
        </CardContent>
      </Card>

      {/* Last Update Info */}
      {data && (data.updatedBy || data.updatedAt) && (
        <div className="text-xs text-muted-foreground text-right">
          Son güncelleme: {data.updatedBy || "Bilinmiyor"} - {formatDateTime(data.updatedAt)}
        </div>
      )}
    </div>
  )
}
