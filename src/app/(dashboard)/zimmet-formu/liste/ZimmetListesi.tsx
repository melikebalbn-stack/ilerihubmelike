'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, Eye, Plus, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getZimmetDurumRozeti } from '@/lib/zimmet/constants'
import { ZimmetDurumBadge } from '../ZimmetDurumBadge'
import { IslakImzaYukleDialog } from '../IslakImzaYukleDialog'

// ── Tipler ──────────────────────────────────────────────────────────────────

type ZimmetKisi = { name: string | null; email: string }

type ZimmetItem = {
  id: string
  zimmetSahibi: ZimmetKisi
  altZimmetSahibi: string | null
  departman: string | null
  tur: string
  turDiger: string | null
  seriNumarasi: string | null
  verilisTarihi: string | null
  cihazDurumu: string
  durum: string
  imzaModu: string | null
  zimmetSahibiImzaTarihi: string | null
  islakImzaDosyasi: string | null
  createdBy: ZimmetKisi
  createdAt: string
}

// ── Sabitler ────────────────────────────────────────────────────────────────

const TUR_LABELS: Record<string, string> = {
  NOTEBOOK_BILGISAYAR: 'Notebook Bilgisayar',
  DESKTOP_BILGISAYAR: 'Desktop Bilgisayar',
  CEP_TELEFONU: 'Cep Telefonu',
  EL_TERMINALI: 'El Terminali',
  OFFICE_365: 'Office 365',
  DIGER: 'Diğer',
}

const FILTRELER = [
  { key: 'tumu', label: 'Tümü' },
  { key: 'onay_bekliyor', label: 'Onay Bekliyor' },
  { key: 'onaylandi', label: 'Onaylandı' },
  { key: 'imza_bekleniyor', label: 'İmza Bekleniyor' },
  { key: 'belge_bekliyor', label: 'Belge Bekliyor' },
  { key: 'reddedildi', label: 'Reddedildi' },
] as const

type FiltreKey = (typeof FILTRELER)[number]['key']

// Sunucuya gönderilecek "durum" query param'ı — onaylandi/imza_bekleniyor/belge_bekliyor
// üçü de ONAYLANDI kayıtları çeker, aralarındaki ayrım client tarafında getZimmetDurumRozeti() ile yapılır.
const FILTRE_DURUM_PARAM: Record<FiltreKey, string> = {
  tumu: '',
  onay_bekliyor: 'ONAY_BEKLIYOR',
  onaylandi: 'ONAYLANDI',
  imza_bekleniyor: 'ONAYLANDI',
  belge_bekliyor: 'ONAYLANDI',
  reddedildi: 'REDDEDILDI',
}

// ── Yardımcı bileşenler ──────────────────────────────────────────────────────

function Avatarlar({ name }: { name: string | null | undefined }) {
  const initials = (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'
  return (
    <div className="w-9 h-9 rounded-full bg-[#1B4F72] text-white text-sm font-semibold flex items-center justify-center shrink-0">
      {initials}
    </div>
  )
}

function fmtDate(d: string | null | undefined) {
  return d
    ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'
}

// ── Skeleton (animate-pulse, shadcn Skeleton yokken) ────────────────────────

function SkelBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className ?? ''}`} />
}

function ZimmetSkeleton() {
  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <SkelBlock className="w-9 h-9 rounded-full" />
            <div className="space-y-1.5">
              <SkelBlock className="h-4 w-32" />
              <SkelBlock className="h-3 w-20" />
            </div>
          </div>
          <SkelBlock className="h-5 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <SkelBlock key={i} className="h-8" />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <SkelBlock className="h-8 w-16 rounded-md" />
          <SkelBlock className="h-8 w-16 rounded-md" />
        </div>
      </CardContent>
    </Card>
  )
}

// ── PDF indirme ─────────────────────────────────────────────────────────────

async function indirlePdf(id: string, durum: string) {
  if (durum !== 'ONAYLANDI') {
    toast.error('PDF indirmek için onay gereklidir')
    return
  }
  try {
    const res = await fetch(`/api/zimmet-formu/${id}/pdf?mod=dijital`)
    if (!res.ok) throw new Error('PDF indirilemedi')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zimmet-${id.slice(0, 8)}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'PDF indirilemedi')
  }
}

// ── Islak imza belgesi indirme ──────────────────────────────────────────────

async function indirBelge(id: string) {
  try {
    const res = await fetch(`/api/zimmet-formu/${id}/belge`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}) as { error?: string })
      throw new Error((data as { error?: string }).error || 'Belge indirilemedi')
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zimmet-${id.slice(0, 8)}-belge`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Belge indirilemedi')
  }
}

// ── Zimmet kartı ─────────────────────────────────────────────────────────────

function ZimmetKart({ zimmet, onUploaded }: { zimmet: ZimmetItem; onUploaded: () => void }) {
  const turLabel = TUR_LABELS[zimmet.tur] ?? zimmet.tur
  const rozet = getZimmetDurumRozeti(zimmet)

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatarlar name={zimmet.zimmetSahibi.name} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {zimmet.zimmetSahibi.name ?? zimmet.zimmetSahibi.email}
              </p>
              <p className="text-xs text-slate-500 truncate">{zimmet.departman ?? '—'}</p>
            </div>
          </div>
          <ZimmetDurumBadge zimmet={zimmet} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Tür</span>
            <span className="font-medium text-slate-700">{turLabel}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Seri no</span>
            <span className="font-medium text-slate-700">{zimmet.seriNumarasi ?? '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Teslim tarihi</span>
            <span className="font-medium text-slate-700">{fmtDate(zimmet.verilisTarihi)}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Oluşturan</span>
            <span className="font-medium text-slate-700 truncate block">
              {zimmet.createdBy.name ?? zimmet.createdBy.email}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
          {rozet.label === 'Belge Yüklenmesi Gerekmektedir' && (
            <IslakImzaYukleDialog zimmetId={zimmet.id} onUploaded={onUploaded} />
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => indirlePdf(zimmet.id, zimmet.durum)}
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            PDF
          </Button>
          {zimmet.imzaModu === 'ISLAK' && zimmet.islakImzaDosyasi && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => indirBelge(zimmet.id)}
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Islak imza belgesi
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/zimmet-formu/${zimmet.id}/onayla`}>
              <Eye className="h-4 w-4 mr-1" />
              Detay
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Ana bileşen ──────────────────────────────────────────────────────────────

export function ZimmetListesi() {
  const [filtre, setFiltre] = useState<FiltreKey>('tumu')
  const [aramaText, setAramaText] = useState('')
  const [aramaDebounced, setAramaDebounced] = useState('')
  const [zimmetler, setZimmetler] = useState<ZimmetItem[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setAramaDebounced(aramaText), 300)
    return () => clearTimeout(t)
  }, [aramaText])

  const fetchZimmetler = useCallback(() => {
    setYukleniyor(true)
    setHata(null)

    const params = new URLSearchParams()
    const durumParam = FILTRE_DURUM_PARAM[filtre]
    if (durumParam) params.set('durum', durumParam)
    if (aramaDebounced) params.set('ara', aramaDebounced)

    return fetch(`/api/zimmet-formu/liste?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Liste yüklenemedi'))))
      .then((data: ZimmetItem[]) => setZimmetler(data))
      .catch((e: unknown) => setHata(e instanceof Error ? e.message : 'Bilinmeyen hata'))
      .finally(() => setYukleniyor(false))
  }, [filtre, aramaDebounced])

  // Fetch (filtre veya arama değişince yeniden çeker)
  useEffect(() => {
    fetchZimmetler()
  }, [fetchZimmetler])

  // 'onaylandi', 'imza_bekleniyor' ve 'belge_bekliyor' aynı ONAYLANDI durumunu paylaşıyor — ayrım burada yapılır.
  const zimmetlerGorunen = useMemo(() => {
    if (filtre === 'belge_bekliyor') {
      return zimmetler.filter(
        (z) => getZimmetDurumRozeti(z).label === 'Belge Yüklenmesi Gerekmektedir',
      )
    }
    if (filtre === 'imza_bekleniyor') {
      return zimmetler.filter((z) => getZimmetDurumRozeti(z).label === 'İmza Bekleniyor')
    }
    if (filtre === 'onaylandi') {
      return zimmetler.filter((z) => getZimmetDurumRozeti(z).label === 'Tamamlandı')
    }
    return zimmetler
  }, [zimmetler, filtre])

  function handleExcelExport() {
    setExporting(true)
    window.open('/api/zimmet-formu/export-excel', '_blank')
    setTimeout(() => setExporting(false), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-24 space-y-5">
        {/* Başlık */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-medium text-slate-900">Zimmet geçmişi</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExcelExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4 shrink-0" />
              {exporting ? 'İndiriliyor…' : "Excel'e aktar"}
            </button>
            <Link
              href="/zimmet-formu"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#1B4F72] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B4F72]/90"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Yeni zimmet
            </Link>
          </div>
        </div>

        {/* Arama */}
        <Input
          placeholder="Zimmet sahibi adı veya seri no ara..."
          value={aramaText}
          onChange={(e) => setAramaText(e.target.value)}
        />

        {/* Durum filtresi */}
        <div className="flex flex-wrap gap-2">
          {FILTRELER.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setFiltre(s.key)}
              className={
                filtre === s.key
                  ? 'px-3 py-1.5 text-sm rounded-md font-medium bg-[#1B4F72] text-white'
                  : 'px-3 py-1.5 text-sm rounded-md font-medium border border-slate-300 text-slate-600 hover:bg-slate-100'
              }
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Hata */}
        {hata && (
          <p className="text-sm text-rose-600">{hata}</p>
        )}

        {/* İçerik */}
        {yukleniyor ? (
          <div className="space-y-3">
            <ZimmetSkeleton />
            <ZimmetSkeleton />
            <ZimmetSkeleton />
          </div>
        ) : zimmetlerGorunen.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Henüz zimmet kaydı yok
          </div>
        ) : (
          <div className="space-y-3">
            {zimmetlerGorunen.map((z) => (
              <ZimmetKart key={z.id} zimmet={z} onUploaded={fetchZimmetler} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
