'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Wallet, Clock } from 'lucide-react'

type Personel = {
  id: string
  adSoyad: string
  bolum: string | null
  isSelf: boolean
}

type ApiResponse = {
  sorumlu: { id: string; adSoyad: string }
  bolumler: string[]
  personel: Personel[]
  donemYil: number
  donemAy: number
}

function baslar(adSoyad: string) {
  return adSoyad
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

function sonBasvuruTarihi(donemYil: number, donemAy: number): string {
  const tarih = new Date(donemYil, donemAy - 1, 18)
  return tarih.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function AvansFormuPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [hataMesaji, setHataMesaji] = useState<string | null>(null)
  const [secimler, setSecimler] = useState<Record<string, boolean>>({})
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [gonderildi, setGonderildi] = useState(false)

  useEffect(() => {
    fetch('/api/avans-formu')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error ?? 'Liste alınamadı')
        }
        return res.json()
      })
      .then((json: ApiResponse) => setData(json))
      .catch((err) => setHataMesaji(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleGonder() {
    if (!data) return
    setGonderiliyor(true)
    try {
      const now = new Date()
      const res = await fetch('/api/avans-formu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donemYil: now.getFullYear(),
          donemAy: now.getMonth() + 1,
          secimler: data.personel.map((p) => ({
            personelId: p.id,
            avansIstiyorMu: secimler[p.id] ?? false,
          })),
        }),
      })
      const sonucBody = await res.json().catch(() => null)
      if (!res.ok) throw new Error(sonucBody?.error ?? 'Form gönderilemedi')
      toast.success('Avans formu kaydedildi')
      setGonderildi(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Form gönderilemedi')
    } finally {
      setGonderiliyor(false)
    }
  }

  const secilenSayisi = data
    ? data.personel.filter((p) => secimler[p.id]).length
    : 0

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-24 space-y-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ backgroundColor: '#1B4F72' }}
          >
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Avans Formu</h1>
            <p className="text-sm text-slate-500">
              Ekibiniz için avans talebi bildiriniz
            </p>
          </div>
        </div>

        {!loading && data && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Dönem
              </p>
              <p className="text-base font-semibold text-slate-800">
                {new Date(data.donemYil, data.donemAy - 1, 1).toLocaleDateString('tr-TR', {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">
              <Clock className="h-3.5 w-3.5" />
              Son başvuru tarihi: {sonBasvuruTarihi(data.donemYil, data.donemAy)}
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        )}

        {!loading && hataMesaji && (
          <p className="text-sm text-red-600">{hataMesaji}</p>
        )}

        {!loading && data && (
          <>
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-medium text-slate-600">Personel Listesi</p>
              <p className="text-xs text-slate-400">
                {secilenSayisi} / {data.personel.length} işaretlendi
              </p>
            </div>

            <div className="space-y-2.5">
              {data.personel.map((p) => (
                <Card key={p.id} className="border-slate-200 shadow-none">
                  <CardContent className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: p.isSelf ? '#1B4F72' : '#64748b' }}
                      >
                        {baslar(p.adSoyad)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {p.adSoyad}
                          {p.isSelf && (
                            <span className="ml-2 text-xs font-normal text-slate-400">
                              (siz)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{p.bolum ?? '—'}</p>
                      </div>
                    </div>
                    <Switch
                      id={`switch-${p.id}`}
                      checked={secimler[p.id] ?? false}
                      onCheckedChange={(checked) => {
                        setSecimler((prev) => ({ ...prev, [p.id]: checked }))
                        setGonderildi(false)
                      }}
                      className="data-[state=checked]:bg-emerald-600 shrink-0"
                    />
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={handleGonder}
                disabled={gonderiliyor || gonderildi}
                className="bg-[#1B4F72] hover:bg-[#1B4F72]/90 px-6"
              >
                {gonderiliyor ? 'Gönderiliyor…' : gonderildi ? 'Gönderildi ✓' : 'Gönder'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
