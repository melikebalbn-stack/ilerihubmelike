'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Laptop, Package, PenLine, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ZimmetDurumBadge } from '../ZimmetDurumBadge'
import { getZimmetDurumRozeti } from '@/lib/zimmet/constants'

// ── Tipler ───────────────────────────────────────────────────────────────────

type ZimmetItem = {
  id: string
  tur: string
  turDiger: string | null
  aciklama: string | null
  seriNumarasi: string | null
  verilisTarihi: string | null
  durum: string
  zimmetSahibiImzaTarihi: string | null
  imzaModu: string | null
  islakImzaDosyasi: string | null
  createdBy: { name: string | null }
  createdAt: string
}

type ZimmetDurumu = 'tamamlandi' | 'imza_bekliyor' | 'onay_bekliyor' | 'reddedildi' | 'belge_bekleniyor'

// ── Sabitler ─────────────────────────────────────────────────────────────────

const TUR_LABELS: Record<string, string> = {
  NOTEBOOK_BILGISAYAR: 'Notebook Bilgisayar',
  DESKTOP_BILGISAYAR: 'Desktop Bilgisayar',
  CEP_TELEFONU: 'Cep Telefonu',
  EL_TERMINALI: 'El Terminali',
  OFFICE_365: 'Office 365',
  DIGER: 'Diğer',
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function avatarDurumu(rozetLabel: string): ZimmetDurumu {
  if (rozetLabel === 'Tamamlandı') return 'tamamlandi'
  if (rozetLabel === 'İmza Bekleniyor') return 'imza_bekliyor'
  if (rozetLabel === 'Belge Yüklenmesi Gerekmektedir') return 'belge_bekleniyor'
  if (rozetLabel === 'Reddedildi') return 'reddedildi'
  return 'onay_bekliyor'
}

function fmtDate(d: string | null | undefined) {
  return d
    ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'
}

function fmtDateTime(d: string | null | undefined) {
  return d
    ? new Date(d).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'
}

// ── İkon + avatar ─────────────────────────────────────────────────────────────

const AVATAR_COLORS: Record<ZimmetDurumu, string> = {
  tamamlandi:       'bg-emerald-100 text-emerald-600',
  imza_bekliyor:    'bg-amber-100 text-amber-600',
  belge_bekleniyor: 'bg-amber-100 text-amber-600',
  onay_bekliyor:    'bg-slate-100 text-slate-500',
  reddedildi:       'bg-red-100 text-red-500',
}

function TurIkon({ tur }: { tur: string }) {
  if (tur === 'NOTEBOOK_BILGISAYAR' || tur === 'DESKTOP_BILGISAYAR')
    return <Laptop className="w-5 h-5" />
  if (tur === 'CEP_TELEFONU' || tur === 'EL_TERMINALI')
    return <Smartphone className="w-5 h-5" />
  return <Package className="w-5 h-5" />
}

function TurAvatar({ tur, durum }: { tur: string; durum: ZimmetDurumu }) {
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${AVATAR_COLORS[durum]}`}>
      <TurIkon tur={tur} />
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkelBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className ?? ''}`} />
}

function ZimmetSkeleton() {
  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <SkelBlock className="w-10 h-10 rounded-full" />
            <div className="space-y-1.5">
              <SkelBlock className="h-4 w-28" />
              <SkelBlock className="h-3 w-16" />
            </div>
          </div>
          <SkelBlock className="h-5 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <SkelBlock key={i} className="h-8" />
          ))}
        </div>
        <div className="flex justify-end">
          <SkelBlock className="h-8 w-24 rounded-md" />
        </div>
      </CardContent>
    </Card>
  )
}

// ── Zimmet kartı ──────────────────────────────────────────────────────────────

function ZimmetKart({ zimmet }: { zimmet: ZimmetItem }) {
  const rozet = getZimmetDurumRozeti(zimmet)
  const durum = avatarDurumu(rozet.label)
  const turLabel = TUR_LABELS[zimmet.tur] ?? zimmet.turDiger ?? zimmet.tur
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [pdfHata, setPdfHata] = useState<string | null>(null)
  const [belgeStatus, setBelgeStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [belgeHata, setBelgeHata] = useState<string | null>(null)

  async function handleBelgeIndir() {
    setBelgeStatus('loading')
    setBelgeHata(null)
    try {
      const res = await fetch(`/api/zimmet-formu/${zimmet.id}/belge`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error((data as { error?: string }).error || 'Belge indirilemedi')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `zimmet-${zimmet.id.slice(0, 8)}-belge`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setBelgeStatus('idle')
    } catch (err) {
      setBelgeStatus('error')
      setBelgeHata(err instanceof Error ? err.message : 'Belge indirilemedi')
    }
  }

  async function handlePdfIndir() {
    setPdfStatus('loading')
    setPdfHata(null)
    try {
      const res = await fetch(`/api/zimmet-formu/${zimmet.id}/pdf?mod=dijital`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error((data as { error?: string }).error || 'PDF indirilemedi')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `zimmet-${zimmet.id.slice(0, 8)}-dijital.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setPdfStatus('idle')
    } catch (err) {
      setPdfStatus('error')
      setPdfHata(err instanceof Error ? err.message : 'PDF indirilemedi')
    }
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* Üst satır: avatar + tur + rozet */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <TurAvatar tur={zimmet.tur} durum={durum} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{turLabel}</p>
              <p className="text-xs text-slate-500 truncate">{zimmet.seriNumarasi ?? zimmet.aciklama ?? '—'}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ZimmetDurumBadge zimmet={zimmet} />
            {durum === 'belge_bekleniyor' && (
              <p className="text-[11px] text-slate-400 whitespace-nowrap">IT ekibi tarafından yüklenecektir</p>
            )}
          </div>
        </div>

        {/* 3 sütun bilgi */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs pt-1 border-t border-slate-100">
          <div>
            <span className="text-slate-400 block mb-0.5">Teslim tarihi</span>
            <span className="font-medium text-slate-700">{fmtDate(zimmet.verilisTarihi)}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Teslim eden</span>
            <span className="font-medium text-slate-700 truncate block">{zimmet.createdBy.name ?? '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Açıklama</span>
            <span className="font-medium text-slate-700 truncate block">{zimmet.aciklama ?? '—'}</span>
          </div>
        </div>

        {/* Aksiyon butonları */}
        {(durum === 'tamamlandi' || durum === 'imza_bekliyor') && (
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
            {durum === 'tamamlandi' && (
              <div className="flex flex-col items-end gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pdfStatus === 'loading'}
                  onClick={handlePdfIndir}
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  {pdfStatus === 'loading' ? 'İndiriliyor...' : 'PDF indir'}
                </Button>
                {pdfHata && <p className="text-xs text-rose-600">{pdfHata}</p>}
                {zimmet.imzaModu === 'ISLAK' && zimmet.islakImzaDosyasi && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={belgeStatus === 'loading'}
                      onClick={handleBelgeIndir}
                      className="border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      {belgeStatus === 'loading' ? 'İndiriliyor...' : 'Islak imza belgesi'}
                    </Button>
                    {belgeHata && <p className="text-xs text-rose-600">{belgeHata}</p>}
                  </>
                )}
              </div>
            )}
            {durum === 'imza_bekliyor' && (
              <Link
                href={`/zimmet-formu/${zimmet.id}/imzala`}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#1B4F72] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1B4F72]/90"
              >
                <PenLine className="w-3.5 h-3.5" />
                E-İmzala
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────

export function ZimmetlerimListesi() {
  const [zimmetler, setZimmetler] = useState<ZimmetItem[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  const fetchZimmetler = useCallback(() => {
    setYukleniyor(true)
    setHata(null)
    return fetch('/api/zimmet-formu/zimmetlerim')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Zimmetler yüklenemedi'))))
      .then((data: ZimmetItem[]) => setZimmetler(data))
      .catch((e: unknown) => setHata(e instanceof Error ? e.message : 'Bilinmeyen hata'))
      .finally(() => setYukleniyor(false))
  }, [])

  useEffect(() => {
    fetchZimmetler()
  }, [fetchZimmetler])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-24 space-y-5">
        {/* Başlık */}
        <div>
          <h1 className="text-2xl font-medium text-slate-900">Zimmetlerim</h1>
          <p className="mt-1 text-sm text-slate-500">Size teslim edilen cihaz ve lisanslar</p>
        </div>

        {/* Hata */}
        {hata && <p className="text-sm text-rose-600">{hata}</p>}

        {/* İçerik */}
        {yukleniyor ? (
          <div className="space-y-3">
            <ZimmetSkeleton />
            <ZimmetSkeleton />
            <ZimmetSkeleton />
          </div>
        ) : zimmetler.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Henüz size zimmet atanmamış
          </div>
        ) : (
          <div className="space-y-3">
            {zimmetler.map((z) => (
              <ZimmetKart key={z.id} zimmet={z} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
