'use client'

import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Download } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { zimmetSahibiBaslik, zimmetSahibiAltBaslik } from '@/lib/zimmet/constants'
import { zimmetTurGosterim } from '@/lib/zimmet/tur'

// ── Tipler ───────────────────────────────────────────────────────────────────

type ZimmetKisi = { name: string | null; email: string }

export type ZimmetImzalaData = {
  id: string
  zimmetSahibi: ZimmetKisi | null
  tur: string
  turDiger: string | null
  seriNumarasi: string | null
  onayTarihi: string | null
  zimmetSahibiImzaTarihi: string | null
  durum: string
  teslimNotu: string | null
  aciklama: string | null
  departman: string | null
  verilisTarihi: string | null
}

// ── Yardımcı ─────────────────────────────────────────────────────────────────

function fmtDateTime(d: string | null | undefined): string {
  return d
    ? new Date(d).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────

export function ZimmetImzalaClient({ zimmet }: { zimmet: ZimmetImzalaData }) {
  const [imzaTarihi, setImzaTarihi] = useState<string | null>(zimmet.zimmetSahibiImzaTarihi)
  const [imzalaniyor, setImzalaniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [pdfHata, setPdfHata] = useState<string | null>(null)

  const isImzalandi = imzaTarihi !== null
  const turLabel = zimmetTurGosterim(zimmet)
  // Reddedilmiş kayıtta artık kimseye ait değil - Liste/Onayla ekranlarıyla
  // AYNI fonksiyon (bkz. constants.ts). Bu sayfaya zaten sadece zimmetSahibiId
  // eşleşen kullanıcı erişebiliyor (page.tsx) - REDDEDILDI durumunda pratikte
  // nadiren görülür ama tutarlılık için aynı mantık uygulanıyor.
  const zimmetSahibiGirdi = { durum: zimmet.durum, zimmetSahibi: zimmet.zimmetSahibi }
  const zimmetSahibiAdi = zimmetSahibiBaslik(zimmetSahibiGirdi)
  const zimmetSahibiAlt = zimmetSahibiAltBaslik(zimmetSahibiGirdi)

  async function handleImzala() {
    setImzalaniyor(true)
    setHata(null)
    try {
      const res = await fetch(`/api/zimmet-formu/${zimmet.id}/imzala`, {
        method: 'PATCH',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(data.error || 'İmzalama tamamlanamadı')
      }
      const updated = await res.json()
      setImzaTarihi(
        updated.zimmetSahibiImzaTarihi
          ? new Date(updated.zimmetSahibiImzaTarihi).toISOString()
          : new Date().toISOString(),
      )
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'İmzalama tamamlanamadı')
    } finally {
      setImzalaniyor(false)
    }
  }

  async function handlePdfIndir() {
    setPdfStatus('loading')
    setPdfHata(null)
    try {
      const res = await fetch(
        `/api/zimmet-formu/${zimmet.id}/pdf?mod=dijital`,
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(data.error || 'PDF indirilemedi')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `zimmet-${zimmet.id.slice(0, 8)}-imzali.pdf`
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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">

        {/* Geri */}
        <Link
          href="/zimmet-formu/zimmetlerim"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Zimmetlerime dön
        </Link>

        {/* Başlık */}
        <div>
          <h1 className="text-2xl font-medium text-slate-900">Zimmet İmzala</h1>
          <p className="mt-1 text-sm text-slate-500">Kayıt No: {zimmet.id.slice(0, 8)}</p>
        </div>

        {/* Melih onay bilgisi */}
        {zimmet.durum === 'ONAYLANDI' ? (
          <Card>
            <CardContent className="pt-6 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600">Melih Dilben tarafından onaylandı</p>
              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {zimmet.onayTarihi && fmtDateTime(zimmet.onayTarihi)}
              </Badge>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">Onay bekleniyor — Melih Dilben onayına gönderildi.</p>
          </div>
        )}

        {/* Zimmet özeti */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#1B4F72]">Zimmet Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <dt className="text-xs text-slate-400 mb-0.5">Zimmet Sahibi</dt>
                <dd className="text-sm font-medium text-slate-800">
                  {zimmetSahibiAdi}
                </dd>
                {zimmetSahibiAlt && (
                  <dd className="text-xs text-slate-400 mt-0.5">{zimmetSahibiAlt}</dd>
                )}
              </div>
              <div>
                <dt className="text-xs text-slate-400 mb-0.5">Tür</dt>
                <dd className="text-sm font-medium text-slate-800">{turLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 mb-0.5">Seri Numarası</dt>
                <dd className="text-sm font-medium text-slate-800">{zimmet.seriNumarasi ?? '—'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Teslim koşulları */}
        {zimmet.teslimNotu && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-[#1B4F72]">Teslim Koşulları / Notlar</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{zimmet.teslimNotu}</p>
            </CardContent>
          </Card>
        )}

        {/* İmza durumu */}
        {zimmet.durum === 'ONAYLANDI' ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-[#1B4F72]">İmza Durumu</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {isImzalandi ? (
                <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  E-İmzalandı: {zimmetSahibiAdi} —{' '}
                  {fmtDateTime(imzaTarihi)}
                </Badge>
              ) : (
                <>
                  <p className="text-sm text-slate-600">
                    Zimmet tutanağını e-imzalamak için aşağıdaki butona tıklayın.
                  </p>
                  {hata && <p className="text-sm text-rose-600">{hata}</p>}
                  <Button
                    type="button"
                    className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
                    disabled={imzalaniyor}
                    onClick={handleImzala}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {imzalaniyor ? 'İmzalanıyor...' : 'E-İmzala'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">
              Melih Dilben onayından sonra e-imzalayabilirsiniz.
            </p>
          </div>
        )}

        {/* PDF indirme */}
        {zimmet.durum === 'ONAYLANDI' && (
          <div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={!isImzalandi || pdfStatus === 'loading'}
              onClick={handlePdfIndir}
            >
              <Download className="w-4 h-4 mr-1.5" />
              {pdfStatus === 'loading' ? 'İndiriliyor...' : "İmzalı PDF'i indir"}
            </Button>
            {pdfHata && <p className="mt-1.5 text-sm text-rose-600">{pdfHata}</p>}
            {!isImzalandi && (
              <p className="mt-1.5 text-xs text-slate-400">
                PDF indirmek için önce e-imzalamanız gerekiyor.
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
