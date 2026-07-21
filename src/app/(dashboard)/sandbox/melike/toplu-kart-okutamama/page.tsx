"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  const [myBolum, setMyBolum] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [formPersonnel, setFormPersonnel] = useState<PickedPersonnel | null>(null)
  const [formTarih, setFormTarih] = useState("")
  const [formGiris, setFormGiris] = useState("")
  const [formCikis, setFormCikis] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [importResult, setImportResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [notifying, setNotifying] = useState(false)
  const [notifyMessage, setNotifyMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // GRI için: kendi bölümündeki personel otomatik listelenir, tek tek "Yeni Kayıt"
  // aramaya gerek kalmaz — her satırda doğrudan tarih/saat girip kaydedilir.
  const [team, setTeam] = useState<PickedPersonnel[]>([])
  const [teamDrafts, setTeamDrafts] = useState<Record<string, { tarih: string; giris: string; cikis: string }>>({})
  const [teamSavingId, setTeamSavingId] = useState<string | null>(null)
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [bulkTarih, setBulkTarih] = useState("")
  const [bulkGiris, setBulkGiris] = useState("")
  const [bulkCikis, setBulkCikis] = useState("")
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ created: number; errors: { personnelId: string; message: string }[] } | null>(null)
  const [manualAddValue, setManualAddValue] = useState<PickedPersonnel | null>(null)

  const [showOldRecords, setShowOldRecords] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    if (!session?.user?.email) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`)
    }
  }, [session, status, router])

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setForbidden(false)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      params.set("page", String(page))
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
        setMyBolum(data.bolum ?? null)
        setTotalPages(data.pagination?.totalPages || 1)
        setTotal(data.pagination?.total || 0)
      }
    } finally {
      setLoading(false)
    }
  }, [search, page])

  // Arama değişince ilk sayfaya dön
  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    if (status === "authenticated") loadRecords()
  }, [status, loadRecords])

  // Panel GRI'ya özel değil — Personnel kaydı olan (bolum'u bilinen) herkes
  // (FULL/admin dahil) kendi bölümündeki ekibi burada görür. FULL için bolum
  // parametresi elle geçiliyor (GRI'da sunucu zaten kendi bölümüne zorluyor).
  useEffect(() => {
    if (!myBolum) return
    const params = new URLSearchParams({ bolum: myBolum })
    fetch(`/api/sandbox/melike/toplu-kart-okutamama/personnel-search?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PickedPersonnel[]) => setTeam(data))
  }, [myBolum])

  function updateTeamDraft(personnelId: string, field: "tarih" | "giris" | "cikis", value: string) {
    setTeamDrafts((prev) => {
      const base = prev[personnelId] ?? { tarih: "", giris: "", cikis: "" }
      return { ...prev, [personnelId]: { ...base, [field]: value } }
    })
  }

  function applyToAll() {
    if (!bulkTarih) return
    setTeamDrafts((prev) => {
      const next = { ...prev }
      for (const p of team) {
        if (excludedIds.has(p.id)) continue
        next[p.id] = { tarih: bulkTarih, giris: bulkGiris, cikis: bulkCikis }
      }
      return next
    })
  }

  function toggleExcluded(personnelId: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(personnelId)) next.delete(personnelId)
      else next.add(personnelId)
      return next
    })
  }

  // FULL erişim (Süper Admin / İV / Sistem Geliştirme) bölümden bağımsız
  // olarak herhangi bir personeli listeye elle ekleyebilir.
  function addManualPerson(p: PickedPersonnel) {
    setTeam((prev) => (prev.some((existing) => existing.id === p.id) ? prev : [...prev, p]))
    setManualAddValue(null)
  }

  async function handleBulkSaveAll() {
    const items = team
      .filter((p) => !excludedIds.has(p.id))
      .map((p) => ({ personnelId: p.id, draft: teamDrafts[p.id] }))
      .filter((x): x is { personnelId: string; draft: { tarih: string; giris: string; cikis: string } } => !!x.draft?.tarih)
      .map((x) => ({
        personnelId: x.personnelId,
        tarih: x.draft.tarih,
        girisSaati: x.draft.giris,
        cikisSaati: x.draft.cikis,
      }))

    if (items.length === 0) {
      setBulkResult({ created: 0, errors: [{ personnelId: "", message: "Tarih girilmiş kimse yok" }] })
      return
    }

    setBulkSaving(true)
    setBulkResult(null)
    try {
      const res = await fetch(`${API_BASE}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      const result = await res.json()
      if (!res.ok) {
        setBulkResult({ created: 0, errors: [{ personnelId: "", message: result.error || "Toplu kayıt başarısız" }] })
        return
      }
      setBulkResult(result)
      setTeamDrafts({})
      setExcludedIds(new Set())
      loadRecords()
    } finally {
      setBulkSaving(false)
    }
  }

  async function handleTeamSave(personnel: PickedPersonnel) {
    const draft = teamDrafts[personnel.id]
    if (!draft?.tarih) return
    setTeamSavingId(personnel.id)
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personnelId: personnel.id,
          tarih: draft.tarih,
          girisSaati: draft.giris,
          cikisSaati: draft.cikis,
        }),
      })
      if (res.ok) {
        setTeamDrafts((prev) => ({ ...prev, [personnel.id]: { tarih: "", giris: "", cikis: "" } }))
        loadRecords()
      }
    } finally {
      setTeamSavingId(null)
    }
  }

  function resetForm() {
    setFormPersonnel(null)
    setFormTarih("")
    setFormGiris("")
    setFormCikis("")
    setFormError(null)
  }

  function startEditing(record: BulkCardScanRecord) {
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
  }

  function cancelForm() {
    setEditingId(null)
    resetForm()
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
      cancelForm()
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

  async function handleNotify() {
    setNotifying(true)
    setNotifyMessage(null)
    try {
      const res = await fetch(`${API_BASE}/notify`, { method: "POST" })
      const result = await res.json()
      if (!res.ok) {
        setNotifyMessage({ type: "error", text: result.error || "Bildirim gönderilemedi" })
        return
      }
      setNotifyMessage({ type: "success", text: `${result.count} kayıt için İK'ya bildirim gönderildi.` })
    } finally {
      setNotifying(false)
    }
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

  // Süper Admin / İV / Sistem Geliştirme: bölümden bağımsız herkesi elle ekleyip çıkarabilir.
  const canManageAnyone = accessLevel === "FULL"

  const editableRowContent = (
    <>
      <TableCell colSpan={3}>
        <PersonnelPicker value={formPersonnel} onSelect={setFormPersonnel} />
      </TableCell>
      <TableCell>
        <Input type="date" value={formTarih} onChange={(e) => setFormTarih(e.target.value)} />
      </TableCell>
      <TableCell>
        <Input type="time" value={formGiris} onChange={(e) => setFormGiris(e.target.value)} />
      </TableCell>
      <TableCell>
        <Input type="time" value={formCikis} onChange={(e) => setFormCikis(e.target.value)} />
      </TableCell>
      <TableCell>-</TableCell>
      <TableCell className="space-x-2 whitespace-nowrap">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
        <Button size="sm" variant="outline" onClick={cancelForm}>
          Vazgeç
        </Button>
      </TableCell>
    </>
  )

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
          <Button variant="outline" onClick={handleNotify} disabled={notifying}>
            {notifying ? "Gönderiliyor..." : "İK'ya Bildir"}
          </Button>
          {canManageAnyone && (
            <Button variant="outline" onClick={() => setShowOldRecords((v) => !v)}>
              {showOldRecords ? "Eski Kayıtları Gizle" : "Eski Kayıtlar"}
            </Button>
          )}
        </div>
      </div>

      {notifyMessage && (
        <div
          className={`rounded-md border p-3 text-sm ${
            notifyMessage.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notifyMessage.text}
        </div>
      )}

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

      {!showOldRecords && (myBolum || canManageAnyone) && (
        <div className="rounded-md border">
          <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">
            Bana Bağlı Personel {team.length > 0 && `(${team.length})`}
          </div>

          {canManageAnyone && (
            <div className="border-b px-4 py-3">
              <label className="mb-1 block text-xs text-muted-foreground">
                Personel Ekle (bölümden bağımsız)
              </label>
              <div className="max-w-sm">
                <PersonnelPicker value={manualAddValue} onSelect={addManualPerson} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3 border-b bg-muted/20 px-4 py-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Tarih</label>
              <Input type="date" value={bulkTarih} onChange={(e) => setBulkTarih(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Giriş Saati</label>
              <Input type="time" value={bulkGiris} onChange={(e) => setBulkGiris(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Çıkış Saati</label>
              <Input type="time" value={bulkCikis} onChange={(e) => setBulkCikis(e.target.value)} />
            </div>
            <Button variant="outline" disabled={!bulkTarih} onClick={applyToAll}>
              Tümüne Uygula
            </Button>
            <Button disabled={bulkSaving} onClick={handleBulkSaveAll}>
              {bulkSaving ? "Kaydediliyor..." : "Tümünü Kaydet"}
            </Button>
          </div>

          {bulkResult && (
            <div className="border-b px-4 py-2 text-sm">
              <p>{bulkResult.created} kayıt oluşturuldu.</p>
              {bulkResult.errors.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-red-700">
                  {bulkResult.errors.map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sicil No</TableHead>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Giriş Saati</TableHead>
                <TableHead>Çıkış Saati</TableHead>
                <TableHead>İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Bölümünüzde kayıtlı personel bulunamadı
                  </TableCell>
                </TableRow>
              )}
              {team.map((p) => {
                const draft = teamDrafts[p.id] || { tarih: "", giris: "", cikis: "" }
                const isExcluded = excludedIds.has(p.id)
                return (
                  <TableRow key={p.id} className={isExcluded ? "opacity-40" : undefined}>
                    <TableCell>{p.sicilNo || "-"}</TableCell>
                    <TableCell>{p.adSoyad}</TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={draft.tarih}
                        disabled={isExcluded}
                        onChange={(e) => updateTeamDraft(p.id, "tarih", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={draft.giris}
                        disabled={isExcluded}
                        onChange={(e) => updateTeamDraft(p.id, "giris", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={draft.cikis}
                        disabled={isExcluded}
                        onChange={(e) => updateTeamDraft(p.id, "cikis", e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap">
                      <Button
                        size="sm"
                        disabled={isExcluded || !draft.tarih || teamSavingId === p.id}
                        onClick={() => handleTeamSave(p)}
                      >
                        {teamSavingId === p.id ? "Kaydediliyor..." : "Kaydet"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleExcluded(p.id)}>
                        {isExcluded ? "Listeye Ekle" : "Kaldır"}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {showOldRecords && canManageAnyone && (
        <>
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
            {formError && editingId && (
              <TableRow>
                <TableCell colSpan={8} className="text-sm text-red-600">
                  {formError}
                </TableCell>
              </TableRow>
            )}
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
              if (editingId === r.id) {
                return <TableRow key={r.id}>{editableRowContent}</TableRow>
              }
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.sicilNo || "-"}</TableCell>
                  <TableCell>{r.adSoyad}</TableCell>
                  <TableCell>{r.personnel?.bolum || "-"}</TableCell>
                  <TableCell>{new Date(r.tarih).toLocaleDateString("tr-TR")}</TableCell>
                  <TableCell>{r.girisSaati || "-"}</TableCell>
                  <TableCell>{r.cikisSaati || "-"}</TableCell>
                  <TableCell>{r.createdBy?.name || r.createdBy?.email}</TableCell>
                  <TableCell className="space-x-2 whitespace-nowrap">
                    {canEdit && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEditing(r)}>
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

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Toplam {total} kayıt — Sayfa {page} / {totalPages}</span>
        <div className="space-x-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Önceki
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sonraki
          </Button>
        </div>
      </div>
        </>
      )}
    </div>
  )
}
