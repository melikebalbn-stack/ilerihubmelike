'use client'

import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { zimmetSahibiBaslik, zimmetSahibiAltBaslik } from '@/lib/zimmet/constants'
import { temizleAciklama } from '@/lib/zimmet/aciklama'
import { zimmetTurGosterim } from '@/lib/zimmet/tur'
import { ZimmetDurumGecmisiTimeline } from '../../ZimmetDurumGecmisiTimeline'

// ── Tipler ───────────────────────────────────────────────────────────────────

type ZimmetKisi = { name: string | null; email: string }

export type ZimmetOnayData = {
  id: string
  zimmetSahibi: ZimmetKisi | null
  departman: string | null
  tur: string
  turDiger: string | null
  aciklama: string | null
  seriNumarasi: string | null
  verilisTarihi: string | null
  teslimNotu: string | null
  durum: string
  onaylayan: ZimmetKisi | null
  createdBy: ZimmetKisi
  createdAt: string
  updatedAt: string
  teslimEdenImzaTarihi: string | null
}

// ── Yardımcılar ───────────────────────────────────────────────────────────────

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

function InfoRow({ label, value, altDeger }: { label: string; value: string; altDeger?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-400 mb-0.5">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{value || '—'}</dd>
      {altDeger && <dd className="text-xs text-slate-400 mt-0.5">{altDeger}</dd>}
    </div>
  )
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────

export function ZimmetOnayClient({ zimmet }: { zimmet: ZimmetOnayData }) {
  const [not, setNot] = useState('')
  const [durum, setDurum] = useState(zimmet.durum)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const turLabel = zimmetTurGosterim(zimmet)
  // Reddedilmiş kayıtta artık kimseye ait değil - "IT Envanterinde (önceki
  // aday: X)" gösterilir (Liste ekranıyla AYNI fonksiyon, bkz. constants.ts).
  // Local `durum` state kullanılıyor - onayla/reddet/tekrar-onaya-gönder
  // sonrası sayfa yenilenmeden anında güncellensin diye.
  const zimmetSahibiGirdi = { durum, zimmetSahibi: zimmet.zimmetSahibi }
  const zimmetSahibiAdi = zimmetSahibiBaslik(zimmetSahibiGirdi)

  async function islemYap(karar: 'ONAYLANDI' | 'REDDEDILDI') {
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch(`/api/zimmet-formu/${zimmet.id}/onayla`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ karar, not }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(data.error || 'İşlem tamamlanamadı')
      }
      setDurum(karar)
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'İşlem tamamlanamadı')
    } finally {
      setYukleniyor(false)
    }
  }

  // Yanlışlıkla reddedilen kaydı tekrar ONAY_BEKLIYOR'a çevirir - bkz.
  // [id]/tekrar-onaya-gonder/route.ts.
  async function tekrarOnayaGonder() {
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch(`/api/zimmet-formu/${zimmet.id}/tekrar-onaya-gonder`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(data.error || 'İşlem tamamlanamadı')
      }
      setDurum('ONAY_BEKLIYOR')
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'İşlem tamamlanamadı')
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">

        {/* Geri */}
        <Link
          href="/zimmet-formu/liste"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Listeye dön
        </Link>

        {/* Başlık + durum rozeti */}
        <Card>
          <CardContent className="pt-6 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Zimmet Onay</h1>
                <p className="text-xs text-slate-400 mt-0.5">Kayıt No: {zimmet.id.slice(0, 8)}</p>
              </div>
              {durum === 'ONAY_BEKLIYOR' && (
                <Badge className="bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100 shrink-0">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  Onay Bekliyor
                </Badge>
              )}
              {durum === 'ONAYLANDI' && (
                <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Onaylandı
                </Badge>
              )}
              {durum === 'REDDEDILDI' && (
                <Badge className="bg-red-100 text-red-700 border border-red-200 hover:bg-red-100 shrink-0">
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Reddedildi
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Oluşturulma: {fmtDateTime(zimmet.createdAt)} · {zimmet.createdBy.name ?? zimmet.createdBy.email}
            </p>
          </CardContent>
        </Card>

        {/* Zimmet bilgileri */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#1B4F72]">Zimmet Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow
                label="Zimmet Sahibi"
                value={zimmetSahibiAdi}
                altDeger={zimmetSahibiAltBaslik(zimmetSahibiGirdi)}
              />
              <InfoRow label="Departman" value={zimmet.departman ?? '—'} />
              <InfoRow label="Tür" value={turLabel} />
              <InfoRow label="Seri Numarası" value={zimmet.seriNumarasi ?? '—'} />
              {zimmet.aciklama && <InfoRow label="Açıklama" value={temizleAciklama(zimmet.aciklama)} />}
              <InfoRow label="Veriliş Tarihi" value={fmtDate(zimmet.verilisTarihi)} />
            </dl>
          </CardContent>
        </Card>

        {/* Teslim koşulları */}
        {zimmet.teslimNotu && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-[#1B4F72]">Teslim Koşulları</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-slate-700 leading-relaxed">{zimmet.teslimNotu}</p>
            </CardContent>
          </Card>
        )}

        {/* İmza durumu */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#1B4F72]">İmza Durumu</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {zimmet.teslimEdenImzaTarihi ? (
              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Zimmeti veren imzaladı — {fmtDateTime(zimmet.teslimEdenImzaTarihi)}
              </Badge>
            ) : (
              <p className="text-sm font-medium text-amber-600">
                Zimmeti veren henüz imzalamadı
              </p>
            )}
          </CardContent>
        </Card>

        {/* Onay notu + butonlar — sadece ONAY_BEKLIYOR ise */}
        {durum === 'ONAY_BEKLIYOR' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="onayNotu">Onay notu <span className="text-xs text-slate-400">(opsiyonel)</span></Label>
              <Textarea
                id="onayNotu"
                value={not}
                onChange={(e) => setNot(e.target.value)}
                placeholder="Onay veya red gerekçesini buraya yazabilirsiniz..."
                rows={3}
              />
            </div>

            {hata && <p className="text-sm text-rose-600">{hata}</p>}

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                disabled={yukleniyor}
                onClick={() => islemYap('REDDEDILDI')}
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                {yukleniyor ? 'İşleniyor…' : 'Reddet'}
              </Button>
              <Button
                type="button"
                className="flex-1 bg-[#1B4F72] hover:bg-[#1B4F72]/90"
                disabled={yukleniyor}
                onClick={() => islemYap('ONAYLANDI')}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {yukleniyor ? 'İşleniyor…' : 'E-İmzala ve onayla'}
              </Button>
            </div>
          </>
        )}

        {/* Reddedilmiş kayıt: yanlışlıkla reddedildiyse tekrar onaya sokma imkanı */}
        {durum === 'REDDEDILDI' && (
          <>
            {hata && <p className="text-sm text-rose-600">{hata}</p>}
            <Button
              type="button"
              variant="outline"
              className="w-full border-sky-300 text-sky-600 hover:bg-sky-50 hover:border-sky-400"
              disabled={yukleniyor}
              onClick={tekrarOnayaGonder}
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              {yukleniyor ? 'İşleniyor…' : 'Tekrar onaya gönder'}
            </Button>
          </>
        )}

        <ZimmetDurumGecmisiTimeline zimmetId={zimmet.id} />

      </div>
    </div>
  )
}
