"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Plus, Trash2, Loader2, Briefcase, Search, X, Building2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface ListItem {
  id: string
  name: string
  isActive: boolean
}

function ManageableList({
  title,
  subtitle,
  icon: Icon,
  apiUrl,
  placeholder,
}: {
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  apiUrl: string
  placeholder: string
}) {
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState("")

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}?all=true`)
      if (!res.ok) throw new Error()
      setItems(await res.json())
    } catch {
      toast.error(`${title} listesi yüklenemedi`)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, title])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function handleAdd() {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Eklenemedi")
      }
      toast.success(`${title.slice(0, -1)} eklendi`)
      setNewName("")
      fetchItems()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setAdding(false)
    }
  }

  async function handleToggle(item: ListItem) {
    try {
      const res = await fetch(apiUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
      })
      if (!res.ok) throw new Error()
      setItems((prev) => prev.map((j) => (j.id === item.id ? { ...j, isActive: !j.isActive } : j)))
    } catch {
      toast.error("Güncelleme başarısız")
    }
  }

  async function handleDelete(item: ListItem) {
    if (!window.confirm(`"${item.name}" silinsin mi?`)) return
    try {
      const res = await fetch(apiUrl, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })
      if (!res.ok) throw new Error()
      setItems((prev) => prev.filter((j) => j.id !== item.id))
      toast.success("Silindi")
    } catch {
      toast.error("Silme başarısız")
    }
  }

  const filtered = items.filter((j) => !search || j.name.toLowerCase().includes(search.toLowerCase()))
  const activeCount = items.filter((j) => j.isActive).length

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle} — {activeCount} aktif / {items.length} toplam</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-48"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 border-b bg-muted/30 flex items-center gap-2">
        <Input
          placeholder={placeholder}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="max-w-sm"
        />
        <Button size="sm" onClick={handleAdd} disabled={adding || !newName.trim()}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          Ekle
        </Button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Yükleniyor...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            {search ? "Sonuç bulunamadı" : "Henüz kayıt yok"}
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between px-4 py-2 border-b last:border-0 hover:bg-muted/30 ${
                !item.isActive ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    item.isActive ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    item.isActive ? "translate-x-4" : "translate-x-0.5"
                  }`} />
                </button>
                <span className="text-sm font-medium">{item.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                onClick={() => handleDelete(item)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function HRSettingsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Ayarlar
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Briefcase className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">İV Ayarları</h1>
            <p className="text-sm text-muted-foreground">Görev tanımları, bölümler ve İnsan Varlıkları yapılandırması</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ManageableList
          title="Görev Tanımları"
          subtitle="Personel formundaki görev seçenekleri"
          icon={Briefcase}
          apiUrl="/api/settings/job-titles"
          placeholder="Yeni görev adı..."
        />

        <ManageableList
          title="Bölüm Tanımları"
          subtitle="Personel formundaki bölüm seçenekleri"
          icon={Building2}
          apiUrl="/api/settings/hr-departments"
          placeholder="Yeni bölüm adı..."
        />
      </div>
    </div>
  )
}
