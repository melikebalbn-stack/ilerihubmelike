'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Download, Laptop, Package, PenLine, Printer, Smartphone, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ZimmetDurumBadge } from '../ZimmetDurumBadge'
import { getZimmetDurumRozeti } from '@/lib/zimmet/constants'

// NOT: Bu ekranda şu an bir arama kutusu yok (kişinin kendi zimmetleri zaten
// az sayıda). İleride eklenirse src/lib/sandbox/zimmet-arama.ts'teki
// cokluAlandaAra/metinEslesiyorMu kullanılmalı - ZimmetListesi.tsx ve
// PersonelCombobox.tsx ile aynı Türkçe karakter katlamalı arama mantığı.

// ── Tipler ───────────────────────────────────────────────────────────────────

type ZimmetItem = {
  id: string
  tur: string
  turDiger: string | null
  aciklama: string | null
  ozellik: string | null
  pcAdi: string | null
  departman: string | null
  seriNumarasi: string | null
  verilisTarihi: string | null
  durum: string
  kaynak: string
  redSebebi: string | null
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

// Devir kayıtlarının açıklamasındaki teknik damga — UI'da GİZLENİR (DB'de kalır).
const DEVIR_ONEK = '[Syteline devri] '
function temizAciklama(a: string | null | undefined): string {
  if (!a) return ''
  const s = a.startsWith(DEVIR_ONEK) ? a.slice(DEVIR_ONEK.length) : a
  return s.trim()
}

// Başlık: DIGER ise "Diğer · turDiger" (ör. yazılım lisansı adı), değilse tür etiketi.
function turBaslik(tur: string, turDiger: string | null): string {
  if (tur === 'DIGER' && turDiger?.trim()) return `Diğer · ${turDiger.trim()}`
  return TUR_LABELS[tur] ?? tur
}

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
            <div className="flex items-center gap-1.5">
              <ZimmetDurumBadge zimmet={zimmet} />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={durum === 'onay_bekliyor' ? 'Taslak PDF' : 'PDF indir'}
                        disabled={
                          (durum !== 'tamamlandi' && durum !== 'onay_bekliyor') ||
                          pdfStatus === 'loading'
                        }
                        onClick={handlePdfIndir}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {durum === 'onay_bekliyor' && (
                    <TooltipContent>Taslak PDF (onay bekliyor)</TooltipContent>
                  )}
                  {durum !== 'tamamlandi' && durum !== 'onay_bekliyor' && (
                    <TooltipContent>Onaylanıp imzalanınca aktif olur.</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
            {pdfHata && <p className="text-[11px] text-rose-600 whitespace-nowrap">{pdfHata}</p>}
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
        {(durum === 'imza_bekliyor' ||
          (durum === 'tamamlandi' && zimmet.imzaModu === 'ISLAK' && zimmet.islakImzaDosyasi)) && (
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
            {durum === 'tamamlandi' && (
              <div className="flex flex-col items-end gap-1">
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

// ── Devir onay akışı (Syteline devri kayıtları, sahip kısmi onayı) ─────────────

const HAZIR_GEREKCELER = [
  'Bu cihaz/lisans bende değil',
  'Daha önce iade ettim',
  'Başka bir çalışana ait',
  'Cihaz hurdaya ayrıldı',
]

type DevirKarar = { karar: 'KABUL' | 'RED' | null; sebep: string }

function DevirOnayBlok({
  kayitlar,
  onTamamlandi,
}: {
  kayitlar: ZimmetItem[]
  onTamamlandi: () => void
}) {
  const [kararlar, setKararlar] = useState<Record<string, DevirKarar>>(() =>
    Object.fromEntries(kayitlar.map((z) => [z.id, { karar: null, sebep: '' }])),
  )
  const [gonderiliyor, setGonderiliyor] = useState(false)

  const setKarar = (id: string, karar: 'KABUL' | 'RED') =>
    setKararlar((s) => ({ ...s, [id]: { ...s[id], karar } }))
  const setSebep = (id: string, sebep: string) =>
    setKararlar((s) => ({ ...s, [id]: { ...s[id], sebep } }))
  const hepsiBende = () =>
    setKararlar((s) =>
      Object.fromEntries(kayitlar.map((z) => [z.id, { karar: 'KABUL' as const, sebep: s[z.id]?.sebep ?? '' }])),
    )

  const kabulN = Object.values(kararlar).filter((k) => k.karar === 'KABUL').length
  const redN = Object.values(kararlar).filter((k) => k.karar === 'RED').length
  const bekleyenN = kayitlar.length - kabulN - redN
  const redEksikGerekce = kayitlar.some(
    (z) => kararlar[z.id]?.karar === 'RED' && !kararlar[z.id]?.sebep.trim(),
  )
  const gonderilemez = bekleyenN > 0 || redEksikGerekce || gonderiliyor

  async function gonder() {
    setGonderiliyor(true)
    try {
      const payload = {
        kararlar: kayitlar.map((z) => ({
          id: z.id,
          karar: kararlar[z.id].karar,
          sebep: kararlar[z.id].karar === 'RED' ? kararlar[z.id].sebep.trim() : undefined,
        })),
      }
      const res = await fetch('/api/zimmet-formu/devir-onay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}) as { error?: string })
        throw new Error((d as { error?: string }).error || 'İşlem tamamlanamadı')
      }
      const d = (await res.json()) as { kabul: number; red: number }
      toast.success(`${d.kabul} onaylandı, ${d.red} reddedildi`)
      onTamamlandi()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem tamamlanamadı')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
      {/* Üst bant */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-amber-900">
            Üzerinize kayıtlı {kayitlar.length} zimmet onayınızı bekliyor
          </p>
          <p className="text-xs text-amber-700">
            Eski sistemden aktarıldı. Size ait olanları onaylayın, olmayanları gerekçesiyle reddedin.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={hepsiBende}>
          Hepsi bende
        </Button>
      </div>

      {/* Kartlar */}
      <div className="space-y-2">
        {kayitlar.map((z) => {
          const k = kararlar[z.id]
          // Alt satır: temiz açıklama (önek gizli) + seri no — ikisi de varsa "· " ile.
          const altSatir = [temizAciklama(z.aciklama), z.seriNumarasi?.trim()]
            .filter((x): x is string => !!x)
            .join(' · ')
          // Detay: boş alanlar HİÇ render edilmez.
          const detaylar: { label?: string; value: string }[] = []
          if (z.verilisTarihi) detaylar.push({ label: 'Teslim tarihi', value: fmtDate(z.verilisTarihi) })
          if (z.createdBy?.name) detaylar.push({ label: 'Teslim eden', value: z.createdBy.name })
          if (z.ozellik?.trim()) detaylar.push({ value: z.ozellik.trim() })
          if (z.pcAdi?.trim()) detaylar.push({ label: 'Cihaz adı', value: z.pcAdi.trim() })
          if (z.departman?.trim()) detaylar.push({ value: z.departman.trim() })
          return (
            <div key={z.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{turBaslik(z.tur, z.turDiger)}</p>
                  {altSatir && <p className="text-xs text-slate-500 truncate">{altSatir}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant={k?.karar === 'KABUL' ? 'default' : 'outline'}
                    aria-pressed={k?.karar === 'KABUL'}
                    onClick={() => setKarar(z.id, 'KABUL')}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Bende
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={k?.karar === 'RED' ? 'destructive' : 'outline'}
                    aria-pressed={k?.karar === 'RED'}
                    onClick={() => setKarar(z.id, 'RED')}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Bende değil
                  </Button>
                </div>
              </div>

              {/* Detay: teslim tarihi/eden + özellik + cihaz adı + departman (boşlar gizli) */}
              {detaylar.length > 0 && (
                <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                  {detaylar.map((d, i) => (
                    <span key={i}>
                      {d.label ? `${d.label}: ` : ''}
                      {d.value}
                    </span>
                  ))}
                </p>
              )}

              {/* Bende değil → gerekçe */}
              {k?.karar === 'RED' && (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {HAZIR_GEREKCELER.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setSebep(z.id, g)}
                        className="rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={k.sebep}
                    onChange={(e) => setSebep(z.id, e.target.value)}
                    placeholder="Red gerekçesi (zorunlu)"
                    className="min-h-[60px] text-sm"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Sticky alt bar */}
      <div className="sticky bottom-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <p className="text-xs text-slate-600">
          <span className="text-emerald-600 font-medium">{kabulN} onay</span> ·{' '}
          <span className="text-rose-600 font-medium">{redN} red</span> ·{' '}
          <span className="text-slate-500">{bekleyenN} bekleyen</span>
        </p>
        <Button type="button" size="sm" disabled={gonderilemez} onClick={gonder}>
          {gonderiliyor ? 'Gönderiliyor…' : 'E-imzala ve tamamla'}
        </Button>
      </div>
    </div>
  )
}

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

  // Devir kayıtları (onay bekleyen) üstte ayrı blokta; normal listeden çıkarılır.
  const devirBekleyen = zimmetler.filter(
    (z) => z.kaynak === 'SYTELINE_DEVIR' && z.durum === 'ONAY_BEKLIYOR',
  )
  const digerZimmetler = zimmetler.filter(
    (z) => !(z.kaynak === 'SYTELINE_DEVIR' && z.durum === 'ONAY_BEKLIYOR'),
  )

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
            {devirBekleyen.length > 0 && (
              <DevirOnayBlok
                key={devirBekleyen.map((z) => z.id).join(',')}
                kayitlar={devirBekleyen}
                onTamamlandi={fetchZimmetler}
              />
            )}
            {digerZimmetler.map((z) => (
              <ZimmetKart key={z.id} zimmet={z} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
