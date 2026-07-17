"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PersonnelPicker, type PickedPersonnel } from "./_components/personnel-picker"

interface BulkCardScanRecord {
  id: string
  sicilNo: string | null
  adSoyad: string
  tarih: string
  girisSaati: string | null
  cikisSaati: string | null
  createdById: string
  createdBy: { id: string; name: string | null; email: string }
  personnel: { id: string; bolum: string; gorev: string } | null
}

const API_BASE = "/api/sandbox/melike/toplu-kart-okutamama"

export default function TopluKartOkutamamaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [records, setRecords] = useState<BulkCardScanRecord[]>([])
  const [accessLevel, setAccessLevel] = useState<"FULL" | "GRI" | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formPersonnel, setFormPersonnel] = useState<PickedPersonnel | null>(null)
  const [formTarih, setFormTarih] = useState("")
  const [formGiris, setFormGiris] = useState("")
  const [formCikis, setFormCikis] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [importResult, setImportResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === "loading") return
    if (!session?.user?.email) {
      router.push("/login")
    }
  }, [session, status, router])

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setForbidden(false)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      const res = await fetch(`${API_BASE}?${params.toString()}`)
      if (res.status === 403) {
        setForbidden(true)
        setRecords([])
        return
      }
      if (res.ok) {
        const data = await res.json()
        setRecords(data.records)
        setAccessLevel(data.accessLevel)
      }
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    if (status === "authenticated") loadRecords()
  }, [status, loadRecords])

  function resetForm() {
    setEditingId(null)
    setFormPersonnel(null)
    setFormTarih("")
    setFormGiris("")
    setFormCikis("")
    setFormError(null)
  }

  function openNewDialog() {
    resetForm()
    setDialogOpen(true)
  }

  function openEditDialog(record: BulkCardScanRecord) {
    setEditingId(record.id)
    setFormPersonnel({
      id: record.personnel?.id || "",
      sicilNo: record.sicilNo,
      adSoyad: record.adSoyad,
      bolum: record.personnel?.bolum || "",
    })
    setFormTarih(record.tarih.slice(0, 10))
    setFormGiris(record.girisSaati || "")
    setFormCikis(record.cikisSaati || "")
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formPersonnel || !formTarih) {
      setFormError("Personel ve tarih zorunludur")
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        personnelId: formPersonnel.id,
        tarih: formTarih,
        girisSaati: formGiris,
        cikisSaati: formCikis,
      }
      const res = await fetch(editingId ? `${API_BASE}/${editingId}` : API_BASE, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        setFormError(err.error || "Kayıt yapılamadı")
        return
      }
      setDialogOpen(false)
      resetForm()
      loadRecords()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu kaydı silmek istediğinize emin misiniz?")) return
    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" })
    if (res.ok) loadRecords()
  }

  async function handleExport() {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    const res = await fetch(`${API_BASE}/export?${params.toString()}`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `toplu_kart_okutamama_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch(`${API_BASE}/import`, { method: "POST", body: formData })
    const result = await res.json()
    setImportResult(result)
    if (fileInputRef.current) fileInputRef.current.value = ""
    loadRecords()
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          Bu forma erişim yetkiniz yok.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Toplu Kart Okutamama</h1>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Excel'den İçe Aktar
          </Button>
          <Button variant="outline" onClick={handleExport}>
            Excel'e Aktar
          </Button>
          <Button onClick={openNewDialog}>Yeni Kayıt</Button>
        </div>
      </div>

      {importResult && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p>{importResult.created} kayıt oluşturuldu.</p>
          {importResult.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-red-700">
              {importResult.errors.map((e, i) => (
                <li key={i}>Satır {e.row}: {e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Input
        placeholder="Sicil No veya Ad Soyad ile ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sicil No</TableHead>
              <TableHead>Ad Soyad</TableHead>
              <TableHead>Bölüm</TableHead>
              <TableHead>Tarih</TableHead>
              <TableHead>Giriş Saati</TableHead>
              <TableHead>Çıkış Saati</TableHead>
              <TableHead>Oluşturan</TableHead>
              <TableHead>İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Yükleniyor...
                </TableCell>
              </TableRow>
            )}
            {!loading && records.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Kayıt bulunamadı
                </TableCell>
              </TableRow>
            )}
            {records.map((r) => {
              const canEdit = accessLevel === "FULL" || r.createdById === session?.user?.id
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.sicilNo || "-"}</TableCell>
                  <TableCell>{r.adSoyad}</TableCell>
                  <TableCell>{r.personnel?.bolum || "-"}</TableCell>
                  <TableCell>{new Date(r.tarih).toLocaleDateString("tr-TR")}</TableCell>
                  <TableCell>{r.girisSaati || "-"}</TableCell>
                  <TableCell>{r.cikisSaati || "-"}</TableCell>
                  <TableCell>{r.createdBy?.name || r.createdBy?.email}</TableCell>
                  <TableCell className="space-x-2">
                    {canEdit && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(r)}>
                          Düzenle
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(r.id)}>
                          Sil
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Kaydı Düzenle" : "Yeni Kayıt"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Personel (Sicil No / Ad Soyad)</label>
              <PersonnelPicker value={formPersonnel} onSelect={setFormPersonnel} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tarih</label>
              <Input type="date" value={formTarih} onChange={(e) => setFormTarih(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Giriş Saati</label>
                <Input type="time" value={formGiris} onChange={(e) => setFormGiris(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Çıkış Saati</label>
                <Input type="time" value={formCikis} onChange={(e) => setFormCikis(e.target.value)} />
              </div>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
