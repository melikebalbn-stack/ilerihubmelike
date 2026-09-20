'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Database, Loader2, Plus, Trash2 } from 'lucide-react'
import { GeriRozet, RozetLink } from '../../_components/rozet-link'

const NAVY = '#1B4F72'

interface VeriSeti { id: string; ad: string; aciklama: string | null; aktif: boolean; guncellenme: string; kaynakSayisi: number; sablonSayisi: number }

const tarihMetni = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function VeriSetiListeClient() {
  const [liste, setListe] = useState<VeriSeti[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)

  const yukle = () => {
    fetch('/api/raporlar/veri-setleri')
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`); setListe(d.veriSetleri ?? []) })
      .catch((e: Error) => { setHata(e.message); setListe([]) })
  }
  useEffect(yukle, [])

  async function sil(v: VeriSeti) {
    if (!confirm(`'${v.ad}' veri seti silinsin mi?`)) return
    const r = await fetch(`/api/raporlar/veri-setleri/${v.id}`, { method: 'DELETE' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setHata(d.error ?? `HTTP ${r.status}`); return }
    setHata(null)
    yukle()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <GeriRozet href="/raporlar">Raporlar</GeriRozet>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Database className="h-6 w-6 lg:h-7 lg:w-7" style={{ color: NAVY }} />
            Veri Setleri
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Raporların beslendiği IFS / Hub kaynak birleşimleri</p>
        </div>
        <RozetLink href="/raporlar/veri-setleri/yeni" icon={<Plus className="h-3.5 w-3.5" />}>Yeni veri seti</RozetLink>
      </div>

      {hata && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{hata}</div>}

      {liste === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…</div>
      ) : liste.length === 0 ? (
        <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">Henüz veri seti yok. "Yeni veri seti" ile başlayın.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {liste.map((v) => (
            <Card key={v.id} className="h-full">
              <CardContent className="p-5 flex flex-col gap-3 h-full">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/raporlar/veri-setleri/${v.id}`} className="font-semibold hover:underline" style={{ color: NAVY }}>{v.ad}</Link>
                  {!v.aktif && <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Pasif</Badge>}
                </div>
                <p className="text-sm text-muted-foreground flex-1 line-clamp-3">{v.aciklama || '—'}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{v.kaynakSayisi} kaynak · {v.sablonSayisi} şablon · {tarihMetni(v.guncellenme)}</span>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600 hover:text-red-700" onClick={() => sil(v)} disabled={v.sablonSayisi > 0} title={v.sablonSayisi > 0 ? 'Şablon kullanıyor' : 'Sil'}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
