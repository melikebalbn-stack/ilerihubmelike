"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Fragment, useCallback, useEffect, useRef, useState } from "react"
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
  neden: string | null
  onayDurumu: "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI"
  createdById: string
  createdBy: { id: string; name: string | null; email: string }
  personnel: { id: string; bolum: string; gorev: string } | null
}

const ONAY_DURUMU_LABELS: Record<BulkCardScanRecord["onayDurumu"], string> = {
  BEKLIYOR: "Onay Bekliyor",
  ONAYLANDI: "Onaylandı",
  REDDEDILDI: "Reddedildi",
}

interface RecordDraft {
  tarih: string
  giris: string
  cikis: string
  neden: string
}

const EMPTY_DRAFT: RecordDraft = { tarih: "", giris: "", cikis: "", neden: "" }

const NEDEN_OPTIONS = [
  { value: "UNUTMA", label: "Unutma" },
  { value: "BOZULMA", label: "Bozulma" },
  { value: "KAYBETME", label: "Kaybetme" },
  { value: "VAZIFE", label: "Vazife" },
]

function NedenSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="">Neden seçin...</option>
      {NEDEN_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function BolumSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

const API_BASE = "/api/sandbox/melike/toplu-kart-okutamama"

export default function TopluKartOkutamamaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [records, setRecords] = useState<BulkCardScanRecord[]>([])
  const [accessLevel, setAccessLevel] = useState<"FULL" | "GRI" | "SELF" | null>(null)
  const [myBolum, setMyBolum] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [oldBolum, setOldBolum] = useState("")
  const [oldStartDate, setOldStartDate] = useState("")
  const [oldEndDate, setOldEndDate] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [formPersonnel, setFormPersonnel] = useState<PickedPersonnel | null>(null)
  const [formTarih, setFormTarih] = useState("")
  const [formGiris, setFormGiris] = useState("")
  const [formCikis, setFormCikis] = useState("")
  const [formNeden, setFormNeden] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [importResult, setImportResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // GRI için: kendi bölümündeki personel otomatik listelenir, tek tek "Yeni Kayıt"
  // aramaya gerek kalmaz — her satırda doğrudan tarih/saat girip kaydedilir.
  const [team, setTeam] = useState<PickedPersonnel[]>([])
  const [teamDrafts, setTeamDrafts] = useState<Record<string, RecordDraft>>({})
  const [teamSavingId, setTeamSavingId] = useState<string | null>(null)
  const [teamErrors, setTeamErrors] = useState<Record<string, string>>({})
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [bulkTarih, setBulkTarih] = useState("")
  const [bulkGiris, setBulkGiris] = useState("")
  const [bulkCikis, setBulkCikis] = useState("")
  const [bulkNeden, setBulkNeden] = useState("")
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ created: number; errors: { personnelId: string; message: string }[] } | null>(null)
  const [manualAddValue, setManualAddValue] = useState<PickedPersonnel | null>(null)
  const [bolumList, setBolumList] = useState<string[]>([])
  const [bulkAddBolum, setBulkAddBolum] = useState("")

  const [showOldRecords, setShowOldRecords] = useState(false)

  // SELF: Beyaz Yaka kendisi için giriş yapar — sadece kendi Personnel kaydı.
  const [selfPersonnel, setSelfPersonnel] = useState<PickedPersonnel | null>(null)
  const [selfTarih, setSelfTarih] = useState("")
  const [selfGiris, setSelfGiris] = useState("")
  const [selfCikis, setSelfCikis] = useState("")
  const [selfNeden, setSelfNeden] = useState("")
  const [selfSaving, setSelfSaving] = useState(false)
  const [selfError, setSelfError] = useState<string | null>(null)

  // Onayınızı bekleyen kayıtlar — formun kendi accessLevel'ından bağımsız:
  // herhangi bir kullanıcı birinin müdürüyse burada onun bekleyen kayıtlarını görür.
  const [pendingApprovals, setPendingApprovals] = useState<BulkCardScanRecord[]>([])
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const loadApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/sandbox/melike/toplu-kart-okutamama/approvals")
      if (res.ok) {
        const data = await res.json()
        setPendingApprovals(data.records || [])
      }
    } catch {
      // sessiz geç — onay listesi ikincil bilgi, sayfanın geri kalanını engellemesin
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") loadApprovals()
  }, [status, loadApprovals])

  async function handleApprovalDecision(id: string, decision: "APPROVE" | "REJECT") {
    setDecidingId(id)
    try {
      const res = await fetch(`${API_BASE}/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      if (res.ok) {
        loadApprovals()
      }
    } finally {
      setDecidingId(null)
    }
  }

  async function handleSelfSave() {
    if (!selfPersonnel || !selfTarih) {
      setSelfError("Tarih zorunludur")
      return
    }
    setSelfSaving(true)
    setSelfError(null)
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personnelId: selfPersonnel.id,
          tarih: selfTarih,
          girisSaati: selfGiris,
          cikisSaati: selfCikis,
          neden: selfNeden || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setSelfError(err.error || "Kayıt yapılamadı")
        return
      }
      setSelfTarih("")
      setSelfGiris("")
      setSelfCikis("")
      setSelfNeden("")
      loadRecords()
    } finally {
      setSelfSaving(false)
    }
  }

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
      if (oldBolum) params.set("bolum", oldBolum)
      if (oldStartDate) params.set("startDate", oldStartDate)
      if (oldEndDate) params.set("endDate", oldEndDate)
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
  }, [search, oldBolum, oldStartDate, oldEndDate, page])

  // Filtreler değişince ilk sayfaya dön
  useEffect(() => {
    setPage(1)
  }, [search, oldBolum, oldStartDate, oldEndDate])

  useEffect(() => {
    if (status === "authenticated") loadRecords()
  }, [status, loadRecords])

  // Panel GRI'ya özel değil — Personnel kaydı olan (bolum'u bilinen) herkes
  // (FULL/admin dahil) kendi bölümündeki ekibi burada görür. FULL için bolum
  // parametresi elle geçiliyor (GRI'da sunucu zaten kendi bölümüne zorluyor).
  // SELF hariç — o "Kendi Kaydım" bölümünü kullanır, ekip paneli ona gösterilmez.
  useEffect(() => {
    if (!myBolum || accessLevel === "SELF") return
    const params = new URLSearchParams({ bolum: myBolum })
    fetch(`/api/sandbox/melike/toplu-kart-okutamama/personnel-search?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PickedPersonnel[]) => setTeam(data))
  }, [myBolum])

  // SELF: kendi Personnel kaydını (id/sicilNo/adSoyad) çek — personnel-search
  // SELF için zaten sadece kendi kaydını döndürüyor, ekstra parametre gerekmez.
  useEffect(() => {
    if (accessLevel !== "SELF") return
    fetch("/api/sandbox/melike/toplu-kart-okutamama/personnel-search")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PickedPersonnel[]) => setSelfPersonnel(data[0] || null))
  }, [accessLevel])

  // Bölüm listesi — sadece FULL erişimde: Eski Kayıtlar filtresi ve
  // "Bölüme Göre Ekle/Çıkar" seçimi için.
  useEffect(() => {
    if (accessLevel !== "FULL") return
    fetch("/api/sandbox/melike/toplu-kart-okutamama/bolumler")
      .then((res) => (res.ok ? res.json() : []))
      .then(setBolumList)
  }, [accessLevel])

  async function addBolumToTeam() {
    if (!bulkAddBolum) return
    const params = new URLSearchParams({ bolum: bulkAddBolum })
    const res = await fetch(`/api/sandbox/melike/toplu-kart-okutamama/personnel-search?${params.toString()}`)
    if (!res.ok) return
    const people: PickedPersonnel[] = await res.json()
    setTeam((prev) => {
      const existingIds = new Set(prev.map((p) => p.id))
      return [...prev, ...people.filter((p) => !existingIds.has(p.id))]
    })
  }

  function removeBolumFromTeam() {
    if (!bulkAddBolum) return
    const idsToRemove = new Set(team.filter((p) => p.bolum === bulkAddBolum).map((p) => p.id))
    setTeam((prev) => prev.filter((p) => !idsToRemove.has(p.id)))
    setTeamDrafts((prev) => {
      const next = { ...prev }
      for (const id of idsToRemove) delete next[id]
      return next
    })
    setExcludedIds((prev) => {
      const next = new Set(prev)
      for (const id of idsToRemove) next.delete(id)
      return next
    })
  }

  function updateTeamDraft(personnelId: string, field: keyof RecordDraft, value: string) {
    setTeamDrafts((prev) => {
      const base = prev[personnelId] ?? EMPTY_DRAFT
      return { ...prev, [personnelId]: { ...base, [field]: value } }
    })
  }

  function applyToAll() {
    if (!bulkTarih) return
    setTeamDrafts((prev) => {
      const next = { ...prev }
      for (const p of team) {
        if (excludedIds.has(p.id)) continue
        next[p.id] = { tarih: bulkTarih, giris: bulkGiris, cikis: bulkCikis, neden: bulkNeden }
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
      .filter((x): x is { personnelId: string; draft: RecordDraft } => !!x.draft?.tarih)
      .map((x) => ({
        personnelId: x.personnelId,
        tarih: x.draft.tarih,
        girisSaati: x.draft.giris,
        cikisSaati: x.draft.cikis,
        neden: x.draft.neden || undefined,
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
      setBulkTarih("")
      setBulkGiris("")
      setBulkCikis("")
      setBulkNeden("")
      loadRecords()
    } finally {
      setBulkSaving(false)
    }
  }

  async function handleTeamSave(personnel: PickedPersonnel) {
    const draft = teamDrafts[personnel.id]
    if (!draft?.tarih) return
    setTeamSavingId(personnel.id)
    setTeamErrors((prev) => ({ ...prev, [personnel.id]: "" }))
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personnelId: personnel.id,
          tarih: draft.tarih,
          girisSaati: draft.giris,
          cikisSaati: draft.cikis,
          neden: draft.neden || undefined,
        }),
      })
      if (res.ok) {
        setTeamDrafts((prev) => ({ ...prev, [personnel.id]: EMPTY_DRAFT }))
        loadRecords()
      } else {
        const err = await res.json()
        setTeamErrors((prev) => ({ ...prev, [personnel.id]: err.error || "Kayıt yapılamadı" }))
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
    setFormNeden("")
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
    setFormNeden(record.neden || "")
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
        neden: formNeden || undefined,
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
    if (oldBolum) params.set("bolum", oldBolum)
    if (oldStartDate) params.set("startDate", oldStartDate)
    if (oldEndDate) params.set("endDate", oldEndDate)
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

  // Süper Admin / İV / Sistem Geliştirme: bölümden bağımsız herkesi elle ekleyip çıkarabilir.
  const canManageAnyone = accessLevel === "FULL"

  // "Kaldır" o günkü listeden gerçekten çıkarır (excludedIds) — Tümüne
  // Uygula/Tümünü Kaydet bu kişileri atlar. Geri almak için "hariç
  // tutulanlar" alanından tek tıkla eklenebilir.
  const visibleTeam = team.filter((p) => !excludedIds.has(p.id))
  const hiddenTeam = team.filter((p) => excludedIds.has(p.id))

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
      <TableCell>
        <NedenSelect value={formNeden} onChange={setFormNeden} />
      </TableCell>
      <TableCell>-</TableCell>
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
        {!forbidden && (
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
            {canManageAnyone && (
              <Button variant="outline" onClick={() => setShowOldRecords((v) => !v)}>
                {showOldRecords ? "Eski Kayıtları Gizle" : "Eski Kayıtlar"}
              </Button>
            )}
          </div>
        )}
      </div>

      {pendingApprovals.length > 0 && (
        <div className="rounded-md border">
          <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">
            Onayınızı Bekleyen Kayıtlar ({pendingApprovals.length})
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sicil No</TableHead>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Giriş Saati</TableHead>
                <TableHead>Çıkış Saati</TableHead>
                <TableHead>Neden</TableHead>
                <TableHead>Talep Eden</TableHead>
                <TableHead>İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingApprovals.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.sicilNo || "-"}</TableCell>
                  <TableCell>{r.adSoyad}</TableCell>
                  <TableCell>{new Date(r.tarih).toLocaleDateString("tr-TR")}</TableCell>
                  <TableCell>{r.girisSaati || "-"}</TableCell>
                  <TableCell>{r.cikisSaati || "-"}</TableCell>
                  <TableCell>{NEDEN_OPTIONS.find((o) => o.value === r.neden)?.label || "-"}</TableCell>
                  <TableCell>{r.createdBy?.name || r.createdBy?.email}</TableCell>
                  <TableCell className="space-x-2 whitespace-nowrap">
                    <Button
                      size="sm"
                      disabled={decidingId === r.id}
                      onClick={() => handleApprovalDecision(r.id, "APPROVE")}
                    >
                      Onayla
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={decidingId === r.id}
                      onClick={() => handleApprovalDecision(r.id, "REJECT")}
                    >
                      Reddet
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {forbidden && pendingApprovals.length === 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          Bu forma erişim yetkiniz yok.
        </div>
      )}

      {!forbidden && importResult && (
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

      {!forbidden && accessLevel === "SELF" && (
        <div className="rounded-md border">
          <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">Kendi Kaydım</div>
          <div className="flex flex-wrap items-end gap-3 px-4 py-3">
            <div className="min-w-[200px]">
              <label className="mb-1 block text-xs text-muted-foreground">Sicil No / Ad Soyad</label>
              <Input
                readOnly
                value={selfPersonnel ? `${selfPersonnel.sicilNo ? selfPersonnel.sicilNo + " - " : ""}${selfPersonnel.adSoyad}` : "Yükleniyor..."}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Tarih</label>
              <Input type="date" value={selfTarih} onChange={(e) => setSelfTarih(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Giriş Saati</label>
              <Input type="time" value={selfGiris} onChange={(e) => setSelfGiris(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Çıkış Saati</label>
              <Input type="time" value={selfCikis} onChange={(e) => setSelfCikis(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Neden</label>
              <NedenSelect value={selfNeden} onChange={setSelfNeden} />
            </div>
            <Button disabled={!selfTarih || selfSaving || !selfPersonnel} onClick={handleSelfSave}>
              {selfSaving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
          {selfError && <div className="border-t px-4 py-2 text-sm text-red-600">{selfError}</div>}
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            Kaydınız müdürünüzün onayına gönderilir, onaylandıktan sonra İnsan Varlıkları&apos;na iletilir.
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Giriş Saati</TableHead>
                <TableHead>Çıkış Saati</TableHead>
                <TableHead>Neden</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Henüz kaydınız yok
                  </TableCell>
                </TableRow>
              )}
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.tarih).toLocaleDateString("tr-TR")}</TableCell>
                  <TableCell>{r.girisSaati || "-"}</TableCell>
                  <TableCell>{r.cikisSaati || "-"}</TableCell>
                  <TableCell>{NEDEN_OPTIONS.find((o) => o.value === r.neden)?.label || "-"}</TableCell>
                  <TableCell>{ONAY_DURUMU_LABELS[r.onayDurumu]}</TableCell>
                  <TableCell>
                    {r.onayDurumu === "BEKLIYOR" && (
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(r.id)}>
                        Sil
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!forbidden && !showOldRecords && accessLevel !== "SELF" && (myBolum || canManageAnyone) && (
        <div className="rounded-md border">
          <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">
            Bana Bağlı Personel {visibleTeam.length > 0 && `(${visibleTeam.length})`}
          </div>

          {canManageAnyone && (
            <div className="border-b px-4 py-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Bölüme Göre Ekle / Çıkar
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="max-w-xs flex-1 min-w-[200px]">
                    <BolumSelect
                      value={bulkAddBolum}
                      onChange={setBulkAddBolum}
                      options={bolumList}
                      placeholder="Bölüm seçin..."
                    />
                  </div>
                  <Button variant="outline" size="sm" disabled={!bulkAddBolum} onClick={addBolumToTeam}>
                    Bölümü Listeye Ekle
                  </Button>
                  <Button variant="outline" size="sm" disabled={!bulkAddBolum} onClick={removeBolumFromTeam}>
                    Bölümü Listeden Çıkar
                  </Button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Tek Kişi Ekle (bölümden bağımsız)
                </label>
                <div className="max-w-sm">
                  <PersonnelPicker value={manualAddValue} onSelect={addManualPerson} />
                </div>
              </div>
            </div>
          )}

          {canManageAnyone && (
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
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Neden</label>
                <NedenSelect value={bulkNeden} onChange={setBulkNeden} />
              </div>
              <Button variant="outline" disabled={!bulkTarih} onClick={applyToAll}>
                Tümüne Uygula
              </Button>
              <Button disabled={bulkSaving} onClick={handleBulkSaveAll}>
                {bulkSaving ? "Kaydediliyor..." : "Tümünü Kaydet"}
              </Button>
            </div>
          )}

          {canManageAnyone && bulkResult && (
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
                <TableHead>Neden</TableHead>
                <TableHead>İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Bölümünüzde kayıtlı personel bulunamadı
                  </TableCell>
                </TableRow>
              )}
              {team.length > 0 && visibleTeam.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Bugün için listede kimse yok — tümü hariç tutuldu
                  </TableCell>
                </TableRow>
              )}
              {visibleTeam.map((p) => {
                const draft = teamDrafts[p.id] || EMPTY_DRAFT
                const rowError = teamErrors[p.id]
                return (
                  <Fragment key={p.id}>
                    <TableRow>
                      <TableCell>{p.sicilNo || "-"}</TableCell>
                      <TableCell>{p.adSoyad}</TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={draft.tarih}
                          onChange={(e) => updateTeamDraft(p.id, "tarih", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={draft.giris}
                          onChange={(e) => updateTeamDraft(p.id, "giris", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={draft.cikis}
                          onChange={(e) => updateTeamDraft(p.id, "cikis", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <NedenSelect
                          value={draft.neden}
                          onChange={(v) => updateTeamDraft(p.id, "neden", v)}
                        />
                      </TableCell>
                      <TableCell className="space-x-2 whitespace-nowrap">
                        <Button
                          size="sm"
                          disabled={!draft.tarih || teamSavingId === p.id}
                          onClick={() => handleTeamSave(p)}
                        >
                          {teamSavingId === p.id ? "Kaydediliyor..." : "Kaydet"}
                        </Button>
                        {canManageAnyone && (
                          <Button size="sm" variant="outline" onClick={() => toggleExcluded(p.id)}>
                            Kaldır
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {rowError && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-1 text-xs text-red-600">
                          {rowError}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>

          {canManageAnyone && hiddenTeam.length > 0 && (
            <div className="border-t bg-muted/20 px-4 py-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Bugün için listeden kaldırılanlar ({hiddenTeam.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {hiddenTeam.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm"
                  >
                    {p.adSoyad}
                    <button
                      type="button"
                      className="text-xs text-primary underline"
                      onClick={() => toggleExcluded(p.id)}
                    >
                      Geri Ekle
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showOldRecords && canManageAnyone && (
        <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="max-w-sm flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs text-muted-foreground">Ara</label>
          <Input
            placeholder="Sicil No veya Ad Soyad ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="min-w-[200px]">
          <label className="mb-1 block text-xs text-muted-foreground">Bölüm</label>
          <BolumSelect value={oldBolum} onChange={setOldBolum} options={bolumList} placeholder="Tüm bölümler" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Başlangıç Tarihi</label>
          <Input type="date" value={oldStartDate} onChange={(e) => setOldStartDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Bitiş Tarihi</label>
          <Input type="date" value={oldEndDate} onChange={(e) => setOldEndDate(e.target.value)} />
        </div>
        {(search || oldBolum || oldStartDate || oldEndDate) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("")
              setOldBolum("")
              setOldStartDate("")
              setOldEndDate("")
            }}
          >
            Filtreleri Temizle
          </Button>
        )}
      </div>

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
              <TableHead>Neden</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Oluşturan</TableHead>
              <TableHead>İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formError && editingId && (
              <TableRow>
                <TableCell colSpan={10} className="text-sm text-red-600">
                  {formError}
                </TableCell>
              </TableRow>
            )}
            {loading && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  Yükleniyor...
                </TableCell>
              </TableRow>
            )}
            {!loading && records.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
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
                  <TableCell>{NEDEN_OPTIONS.find((o) => o.value === r.neden)?.label || "-"}</TableCell>
                  <TableCell>{ONAY_DURUMU_LABELS[r.onayDurumu]}</TableCell>
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
