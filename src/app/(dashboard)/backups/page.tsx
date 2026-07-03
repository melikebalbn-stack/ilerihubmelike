"use client"

import { useSession } from "next-auth/react"
import { useAuthenticatedData } from "@/hooks/use-authenticated-data"
import { useEffect, useState } from "react"
import { redirect } from "next/navigation"
import {
  HardDrive,
  Download,
  Trash2,
  RotateCcw,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Database,
  Server,
  Calendar,
  RefreshCw,
  AlertTriangle,
  FileArchive,
  Settings
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

// Tipler
interface BackupLog {
  id: string
  backupName: string
  backupType: string
  projectName: string
  filePath: string
  fileSize: number
  status: string
  errorMessage?: string
  includeDatabase: boolean
  startedAt: string
  completedAt?: string
  duration?: number
  createdBy: string
  createdByName: string
  serverIp?: string
  notes?: string
  createdAt: string
}

interface BackupSchedule {
  id: string
  name: string
  projectName: string
  frequency: string
  time: string
  dayOfWeek?: number
  dayOfMonth?: number
  retentionDays: number
  includeDatabase: boolean
  isActive: boolean
  lastRunAt?: string
  nextRunAt?: string
  createdBy: string
}

interface BackupStats {
  summary: {
    totalBackups: number
    completedBackups: number
    failedBackups: number
    inProgressBackups: number
    activeSchedules: number
    totalSize: number
    totalSizeFormatted: string
    lastBackupDate: string | null
    lastBackupProject: string | null
  }
  byProject: Record<string, number>
  recentBackups: Array<{
    id: string
    backupName: string
    projectName: string
    fileSize: number
    fileSizeFormatted: string
    createdAt: string
  }>
}

// Boyut formatla
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

// Durum badge
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    PENDING: { color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-3 w-3" />, label: "Bekliyor" },
    IN_PROGRESS: { color: "bg-blue-100 text-blue-800", icon: <Loader2 className="h-3 w-3 animate-spin" />, label: "Devam Ediyor" },
    COMPLETED: { color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" />, label: "Tamamlandı" },
    FAILED: { color: "bg-red-100 text-red-800", icon: <XCircle className="h-3 w-3" />, label: "Başarısız" }
  }

  const { color, icon, label } = config[status] || config.PENDING

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {icon}
      {label}
    </span>
  )
}

// Proje badge
function ProjectBadge({ project }: { project: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode }> = {
    ILERIHub: { color: "bg-blue-100 text-blue-800", icon: <Server className="h-3 w-3" /> },
    Akademi: { color: "bg-purple-100 text-purple-800", icon: <Server className="h-3 w-3" /> },
    Database: { color: "bg-orange-100 text-orange-800", icon: <Database className="h-3 w-3" /> },
    All: { color: "bg-gray-100 text-gray-800", icon: <FileArchive className="h-3 w-3" /> }
  }

  const { color, icon } = config[project] || config.All

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {icon}
      {project}
    </span>
  )
}

// Sıklık formatla
function formatFrequency(freq: string, dayOfWeek?: number, dayOfMonth?: number): string {
  const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"]

  switch (freq) {
    case "DAILY":
      return "Her gün"
    case "WEEKLY":
      return `Her ${days[dayOfWeek || 0]}`
    case "MONTHLY":
      return `Her ayın ${dayOfMonth || 1}. günü`
    default:
      return freq
  }
}

export default function BackupsPage() {
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState<"backups" | "schedules">("backups")
  const [backups, setBackups] = useState<BackupLog[]>([])
  const [schedules, setSchedules] = useState<BackupSchedule[]>([])
  const [stats, setStats] = useState<BackupStats | null>(null)
  const [creating, setCreating] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [selectedProject, setSelectedProject] = useState("ILERIHub")
  const [includeDatabase, setIncludeDatabase] = useState(false)
  // Restore kill switch — fail-closed default (PR-3a)
  const [restoreEnabled, setRestoreEnabled] = useState(false)

  // PR-Y13: enum check yerine RBAC permission.
  // admin.backup.manage → it-admin, super-admin
  const hasAccess = session?.user?.permissions?.includes("admin.backup.manage") ?? false

  useEffect(() => {
    if (status === "authenticated" && !hasAccess) {
      redirect("/dashboard")
    }
  }, [status, hasAccess])

  // Restore feature flag fetch (auth-gated endpoint)
  useEffect(() => {
    if (!session?.user?.email) return
    fetch("/api/backups/config")
      .then((r) => (r.ok ? r.json() : { restoreEnabled: false }))
      .then((c) => setRestoreEnabled(c.restoreEnabled === true))
      .catch(() => setRestoreEnabled(false))
  }, [session?.user?.email])

  // Verileri yükle (loading/auth-gate/timeout + 10sn polling artık useAuthenticatedData'da)
  const fetchData = async () => {
    try {
      const [backupsRes, schedulesRes, statsRes] = await Promise.all([
        fetch("/api/backups"),
        fetch("/api/backups/schedules"),
        fetch("/api/backups/stats")
      ])

      if (backupsRes.ok) {
        const data = await backupsRes.json()
        setBackups(data)
      }

      if (schedulesRes.ok) {
        const data = await schedulesRes.json()
        setSchedules(data)
      }

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Veri yükleme hatası:", error)
    }
  }

  // Her 10 saniyede bir güncelle (devam eden yedekler için) — polling hook'ta.
  const { loading } = useAuthenticatedData(fetchData, { pollMs: 10000 })

  // Yedek oluştur
  const createBackup = async () => {
    setCreating(true)
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: selectedProject,
          includeDatabase
        })
      })

      if (res.ok) {
        setShowCreateDialog(false)
        fetchData()
      } else {
        const error = await res.json()
        alert(error.error || "Yedekleme başlatılamadı")
      }
    } catch (error) {
      console.error("Yedekleme hatası:", error)
      alert("Yedekleme başlatılamadı")
    } finally {
      setCreating(false)
    }
  }

  // Yedek indir
  const downloadBackup = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/backups/download/${id}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = name
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert("İndirme başarısız")
      }
    } catch (error) {
      console.error("İndirme hatası:", error)
      alert("İndirme başarısız")
    }
  }

  // Yedek sil
  const deleteBackup = async (id: string) => {
    if (!confirm("Bu yedeği silmek istediğinizden emin misiniz?")) return

    try {
      const res = await fetch(`/api/backups/${id}`, { method: "DELETE" })
      if (res.ok) {
        fetchData()
      } else {
        alert("Silme başarısız")
      }
    } catch (error) {
      console.error("Silme hatası:", error)
      alert("Silme başarısız")
    }
  }

  // Geri yükle
  const restoreBackup = async (id: string, name: string) => {
    // Defense-in-depth: client-side kill switch check (PR-3a)
    if (!restoreEnabled) {
      alert("Geri yükleme geçici olarak devre dışı. Sistem yöneticisi ile iletişime geçin.")
      return
    }

    if (!confirm(`${name} yedeğini geri yüklemek istediğinizden emin misiniz?\n\nBu işlem mevcut verilerin üzerine yazacaktır!`)) return
    if (!confirm("Bu işlem geri alınamaz. Devam etmek istediğinizden EMİN misiniz?")) return

    try {
      const res = await fetch(`/api/backups/restore/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmRestore: true })
      })

      if (res.ok) {
        const data = await res.json()
        alert(`Geri yükleme başarılı!\n\nPre-restore yedek: ${data.preRestoreBackup}`)
        fetchData()
      } else {
        const error = await res.json()
        alert(error.error || "Geri yükleme başarısız")
      }
    } catch (error) {
      console.error("Geri yükleme hatası:", error)
      alert("Geri yükleme başarısız")
    }
  }

  // Zamanlama sil
  const deleteSchedule = async (id: string) => {
    if (!confirm("Bu zamanlamayı silmek istediğinizden emin misiniz?")) return

    try {
      const res = await fetch(`/api/backups/schedules/${id}`, { method: "DELETE" })
      if (res.ok) {
        fetchData()
      } else {
        alert("Silme başarısız")
      }
    } catch (error) {
      console.error("Silme hatası:", error)
      alert("Silme başarısız")
    }
  }

  // Zamanlama durumunu değiştir
  const toggleSchedule = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/backups/schedules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive })
      })
      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error("Güncelleme hatası:", error)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Erişim Reddedildi</h2>
          <p className="text-muted-foreground mt-2">Bu sayfaya erişim yetkiniz yok.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="h-7 w-7 text-primary" />
            Yedekleme Yönetimi
          </h1>
          <p className="text-muted-foreground mt-1">
            Sistem yedeklerini yönetin ve zamanlanmış yedeklemeler oluşturun
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchData()}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" />
            Yenile
          </button>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Yedek Al
          </button>
        </div>
      </div>

      {/* İstatistik Kartları */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileArchive className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Toplam Yedek</p>
                <p className="text-2xl font-bold">{stats.summary.totalBackups}</p>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <HardDrive className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Toplam Boyut</p>
                <p className="text-2xl font-bold">{stats.summary.totalSizeFormatted}</p>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aktif Zamanlama</p>
                <p className="text-2xl font-bold">{stats.summary.activeSchedules}</p>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Son Yedek</p>
                <p className="text-lg font-bold">
                  {stats.summary.lastBackupDate
                    ? format(new Date(stats.summary.lastBackupDate), "dd MMM HH:mm", { locale: tr })
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Menüsü */}
      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("backups")}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === "backups"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileArchive className="h-4 w-4 inline mr-2" />
            Yedekler ({backups.length})
          </button>
          <button
            onClick={() => setActiveTab("schedules")}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === "schedules"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="h-4 w-4 inline mr-2" />
            Zamanlamalar ({schedules.length})
          </button>
        </div>
      </div>

      {/* Yedekler Tablosu */}
      {activeTab === "backups" && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-sm font-medium">Yedek Adı</th>
                <th className="text-left p-3 text-sm font-medium">Proje</th>
                <th className="text-left p-3 text-sm font-medium">Tür</th>
                <th className="text-left p-3 text-sm font-medium">Boyut</th>
                <th className="text-left p-3 text-sm font-medium">Durum</th>
                <th className="text-left p-3 text-sm font-medium">Tarih</th>
                <th className="text-right p-3 text-sm font-medium">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Henüz yedek bulunmuyor
                  </td>
                </tr>
              ) : (
                backups.map((backup) => (
                  <tr key={backup.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium text-sm">{backup.backupName}</div>
                      {backup.notes && (
                        <div className="text-xs text-muted-foreground mt-1">{backup.notes}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <ProjectBadge project={backup.projectName} />
                    </td>
                    <td className="p-3 text-sm">
                      {backup.backupType === "MANUAL" ? "Manuel" :
                       backup.backupType === "SCHEDULED" ? "Zamanlanmış" :
                       backup.backupType === "PRE_RESTORE" ? "Pre-Restore" : backup.backupType}
                    </td>
                    <td className="p-3 text-sm">
                      {backup.status === "COMPLETED" ? formatSize(Number(backup.fileSize)) : "-"}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={backup.status} />
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {format(new Date(backup.createdAt), "dd MMM yyyy HH:mm", { locale: tr })}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {backup.status === "COMPLETED" && (
                          <>
                            <button
                              onClick={() => downloadBackup(backup.id, backup.backupName)}
                              className="p-2 hover:bg-accent rounded-lg"
                              title="İndir"
                            >
                              <Download className="h-4 w-4 text-blue-600" />
                            </button>
                            {backup.projectName !== "Database" && (
                              restoreEnabled ? (
                                <button
                                  onClick={() => restoreBackup(backup.id, backup.backupName)}
                                  className="p-2 hover:bg-accent rounded-lg"
                                  title="Geri Yükle"
                                >
                                  <RotateCcw className="h-4 w-4 text-orange-600" />
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="p-2 rounded-lg opacity-40 cursor-not-allowed"
                                  title="Geri yükleme geçici olarak devre dışı (PR-3b bekleniyor)"
                                >
                                  <RotateCcw className="h-4 w-4 text-orange-600" />
                                </button>
                              )
                            )}
                          </>
                        )}
                        <button
                          onClick={() => deleteBackup(backup.id)}
                          className="p-2 hover:bg-accent rounded-lg"
                          title="Sil"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Zamanlamalar Tablosu */}
      {activeTab === "schedules" && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-sm font-medium">Ad</th>
                <th className="text-left p-3 text-sm font-medium">Proje</th>
                <th className="text-left p-3 text-sm font-medium">Sıklık</th>
                <th className="text-left p-3 text-sm font-medium">Saat</th>
                <th className="text-left p-3 text-sm font-medium">Sonraki Çalışma</th>
                <th className="text-left p-3 text-sm font-medium">Durum</th>
                <th className="text-right p-3 text-sm font-medium">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Henüz zamanlama bulunmuyor
                  </td>
                </tr>
              ) : (
                schedules.map((schedule) => (
                  <tr key={schedule.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium text-sm">{schedule.name}</td>
                    <td className="p-3">
                      <ProjectBadge project={schedule.projectName} />
                    </td>
                    <td className="p-3 text-sm">
                      {formatFrequency(schedule.frequency, schedule.dayOfWeek ?? undefined, schedule.dayOfMonth ?? undefined)}
                    </td>
                    <td className="p-3 text-sm">{schedule.time}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {schedule.nextRunAt
                        ? format(new Date(schedule.nextRunAt), "dd MMM HH:mm", { locale: tr })
                        : "-"}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleSchedule(schedule.id, schedule.isActive)}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          schedule.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {schedule.isActive ? "Aktif" : "Pasif"}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => deleteSchedule(schedule.id)}
                        className="p-2 hover:bg-accent rounded-lg"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Yedek Oluşturma Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Yeni Yedek Oluştur</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Proje</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="ILERIHub">ILERIHub (172.16.16.33)</option>
                  <option value="Akademi">Akademi (172.16.16.30)</option>
                  <option value="Database">Veritabanı</option>
                  <option value="All">Tümü</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeDb"
                  checked={includeDatabase}
                  onChange={(e) => setIncludeDatabase(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="includeDb" className="text-sm">
                  Veritabanı yedeği de al
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="px-4 py-2 border rounded-lg hover:bg-accent"
              >
                İptal
              </button>
              <button
                onClick={createBackup}
                disabled={creating}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Başlatılıyor...
                  </>
                ) : (
                  <>
                    <HardDrive className="h-4 w-4" />
                    Yedeklemeyi Başlat
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
