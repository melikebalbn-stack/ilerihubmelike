'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

type Kategori = { id: string; ad: string; aktif: boolean; siraNo: number }

/** Uygunsuzluk kategorileri (ölçüsel, görsel vb.) — basit ekle/pasifleştir ekranı. */
export function KategoriYonetimiClient() {
  const [items, setItems] = useState<Kategori[]>([])
  const [loading, setLoading] = useState(true)
  const [yeniAd, setYeniAd] = useState('')
  const [ekleniyor, setEkleniyor] = useState(false)

  const yukle = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/quality/uygunsuzluk-kategori?hepsi=1')
      const json = await res.json().catch(() => ({ items: [] }))
      setItems(json.items ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    yukle()
  }, [])

  async function ekle() {
    if (!yeniAd.trim() || ekleniyor) return
    setEkleniyor(true)
    try {
      const res = await fetch('/api/quality/uygunsuzluk-kategori', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad: yeniAd.trim() }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'Eklenemedi')
      setYeniAd('')
      toast.success('Kategori eklendi')
      yukle()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata')
    } finally {
      setEkleniyor(false)
    }
  }

  async function aktifDegistir(id: string, aktif: boolean) {
    setItems((prev) => prev.map((k) => (k.id === id ? { ...k, aktif } : k)))
    const res = await fetch(`/api/quality/uygunsuzluk-kategori/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktif }),
    })
    if (!res.ok) {
      toast.error('Güncellenemedi')
      yukle()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
          <Link href="/kalite/uygunsuzluk">
            <ArrowLeft className="h-4 w-4 mr-1" /> Listeye dön
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-[#1B4F72]">Uygunsuzluk Kategorileri</h1>
        <p className="text-sm text-slate-500 mt-1">
          Form üzerindeki Kategori açılır listesini buradan yönetirsiniz (ör. Ölçüsel, Görsel).
        </p>
      </div>

      <div className="rounded-md border bg-white p-4 space-y-2">
        <Label className="text-xs text-slate-600">Yeni kategori</Label>
        <div className="flex gap-2">
          <Input
            value={yeniAd}
            onChange={(e) => setYeniAd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ekle()}
            placeholder="ör. Ölçüsel"
            className="h-9"
          />
          <Button onClick={ekle} disabled={ekleniyor || !yeniAd.trim()}>
            {ekleniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white divide-y">
        {loading ? (
          <div className="p-6 text-center text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">Henüz kategori eklenmemiş</div>
        ) : (
          items.map((k) => (
            <div key={k.id} className="flex items-center justify-between px-4 py-3">
              <span className={k.aktif ? '' : 'text-slate-400 line-through'}>{k.ad}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{k.aktif ? 'Aktif' : 'Pasif'}</span>
                <Switch checked={k.aktif} onCheckedChange={(v) => aktifDegistir(k.id, v)} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
