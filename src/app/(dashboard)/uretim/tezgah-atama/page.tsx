"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useAuthenticatedData } from "@/hooks/use-authenticated-data"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, ShieldAlert, Factory } from "lucide-react"
import { toast } from "sonner"
import { WorkstationDialog } from "./_components/workstation-dialog"
import { AtamaTabs } from "./_components/atama-tabs"
import type { DeptOption, Workstation } from "./_components/types"

const PERMISSION = "uretim.tezgah.manage"

export default function TezgahAtamaPage() {
  const { data: session, status } = useSession()
  const canManage = (session?.user?.permissions ?? []).includes(PERMISSION)

  const [workstations, setWorkstations] = useState<Workstation[]>([])
  const [deptOptions, setDeptOptions] = useState<DeptOption[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Workstation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Workstation | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchInitial = async () => {
    const [wsRes, deptRes] = await Promise.all([
      fetch("/api/workstations?includeInactive=true"),
      fetch("/api/workstations/department-options"),
    ])
    if (!wsRes.ok || !deptRes.ok) throw new Error("Veriler yüklenemedi")
    setWorkstations(await wsRes.json())
    setDeptOptions(await deptRes.json())
  }

  // Auth-gate + loading/error/timeout ortak hook. Yetki yoksa fetch etme (enabled).
  const { loading, loadError, retry } = useAuthenticatedData(fetchInitial, { enabled: canManage })

  // Arka planda sessiz tazeleme (spinner göstermeden) — kaydet/sil sonrası.
  const refresh = () => {
    fetch("/api/workstations?includeInactive=true")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setWorkstations)
      .catch(() => toast.error("Liste tazelenemedi"))
  }

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(w: Workstation) {
    setEditing(w)
    setDialogOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/workstations/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Tezgah silindi")
      setDeleteTarget(null)
      refresh()
    } catch {
      toast.error("Tezgah silinemedi")
    } finally {
      setDeleting(false)
    }
  }

  // --- Gate / durum ekranları ---
  if (status === "loading" || loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!canManage) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Panele dön</Link>
        </Button>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-center">
        <Factory className="h-12 w-12 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Veriler yüklenemedi.</p>
        <Button variant="outline" onClick={retry}>
          Yeniden dene
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Tezgah Atama</h1>
            <p className="text-sm text-muted-foreground">
              Fiziksel tezgahları tanımlayın ve personel eşlemesini yönetin.
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Yeni Tezgah
        </Button>
      </div>

      {/* Üst — Tezgah listesi + CRUD */}
      <Card>
        <CardHeader>
          <CardTitle>Tezgahlar</CardTitle>
          <CardDescription>{workstations.length} tezgah</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>IFS İş Merkezi</TableHead>
                  <TableHead>Bölüm</TableHead>
                  <TableHead className="text-center">Atanmış</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workstations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Henüz tezgah tanımlanmamış.
                    </TableCell>
                  </TableRow>
                ) : (
                  workstations.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.kod}</TableCell>
                      <TableCell>{w.ad}</TableCell>
                      <TableCell>{w.ifsWorkCenterKod}</TableCell>
                      <TableCell>{w.department?.name ?? "—"}</TableCell>
                      <TableCell className="text-center">{w._count.personnel}</TableCell>
                      <TableCell>
                        {w.isActive ? (
                          <Badge variant="default">Aktif</Badge>
                        ) : (
                          <Badge variant="secondary">Pasif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(w)} title="Düzenle">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(w)}
                            title="Sil"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Alt — Atama (iki yön) */}
      <Card>
        <CardHeader>
          <CardTitle>Personel Atama</CardTitle>
          <CardDescription>Tezgah bazlı veya personel bazlı çok-çok eşleme.</CardDescription>
        </CardHeader>
        <CardContent>
          <AtamaTabs workstations={workstations} deptOptions={deptOptions} onChanged={refresh} />
        </CardContent>
      </Card>

      {/* CRUD dialog */}
      <WorkstationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        deptOptions={deptOptions}
        editing={editing}
        onSaved={refresh}
      />

      {/* Silme onayı */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tezgahı sil?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.kod}</strong> ({deleteTarget?.ad}) silinecek.
              {deleteTarget && deleteTarget._count.personnel > 0 && (
                <>
                  {" "}
                  Bu tezgaha atanmış <strong>{deleteTarget._count.personnel}</strong> personel ataması da
                  kaldırılacak.
                </>
              )}{" "}
              Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
