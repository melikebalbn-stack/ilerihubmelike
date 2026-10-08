'use client'

// PR-PERSONNEL-LEAVERS-LIST: Ayrılan personel raporlama listesi.
// Bölüm Değişiklikleri sayfası pattern'i, exit alanlarına uyarlandı.

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect as Select } from '@/components/ui/select'
import { UserMinus, Loader2, Search } from 'lucide-react'
import { SplitBadge } from '@/components/akademi/SplitBadge'
import { toast } from 'sonner'

// PR-EXIT-READ-FROM-PERIODS: her satır = bir kapalı EmploymentPeriod (dönem).
interface Leaver {
  periodId: string
  personnelId: string
  sicilNo: string
  adSoyad: string
  bolum: string | null
  gorev: string | null
  aktif: boolean
  girisTarihi: string | null
  cikisTarihi: string | null
  exitParty: string | null
  exitCode: string | null
  exitReason: string | null
  exitRootCause: string | null
  exitTurnoverType: string | null
  exitGeneralNote: string | null
  exitRecordedAt: string | null
  exitRecordedBy: { name: string | null; email: string } | null
  workingPeriod: { years: number; months: number; totalMonths: number } | null
  status: 'LEFT' | 'REENTRY'
}

interface Department {
  id: string
  name: string
}

function formatTrDate(s: string | null): string {
  if (!s) return '-'
  try {
    return new Date(s).toLocaleDateString('tr-TR')
  } catch {
    return s
  }
}

function workingPeriodText(wp: Leaver['workingPeriod']): string {
  if (!wp) return '-'
  return wp.years > 0 ? `${wp.years} yıl ${wp.months} ay` : `${wp.months} ay`
}

const PARTY_OPTIONS = ['İŞÇİ', 'İŞVEREN', 'KARŞILIKLI']
const TURNOVER_OPTIONS = ['İSTENEN', 'İSTENMEYEN']

export default function LeaversListPage() {
  const router = useRouter()
  const [leavers, setLeavers] = useState<Leaver[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [bolum, setBolum] = useState('')
  const [taraf, setTaraf] = useState('')
  const [tip, setTip] = useState('')
  const [q, setQ] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (bolum) params.set('bolum', bolum)
    if (taraf) params.set('taraf', taraf)
    if (tip) params.set('tip', tip)
    if (q.trim()) params.set('q', q.trim())
    try {
      const res = await fetch(`/api/personnel/leavers?${params}`)
      if (res.ok) setLeavers(await res.json())
      else setLeavers([])
    } catch {
      setLeavers([])
    } finally {
      setLoading(false)
    }
  }, [from, to, bolum, taraf, tip, q])

  useEffect(() => {
    fetch('/api/settings/hr-departments')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setDepartments(d ?? []))
      .catch(() => setDepartments([]))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // KPI özetler (filtre uygulanmış liste üzerinden)
  const kpis = useMemo(() => {
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const total = leavers.length
    const thisMonth = leavers.filter(
      (l) => l.cikisTarihi && new Date(l.cikisTarihi) >= thisMonthStart
    ).length
    const istenmeyen = leavers.filter((l) => l.exitTurnoverType === 'İSTENMEYEN').length
    const isverenCikarma = leavers.filter((l) => l.exitParty === 'İŞVEREN').length
    return { total, thisMonth, istenmeyen, isverenCikarma }
  }, [leavers])

  const resetFilters = () => {
    setFrom('')
    setTo('')
    setBolum('')
    setTaraf('')
    setTip('')
    setQ('')
  }

  const hasFilter = !!(from || to || bolum || taraf || tip || q)

  // Excel: EKRANDAKİ FİLTRELERİN AYNISI uca gider (sunucu tarafında aynı sorgu
  // çekirdeği kullanılır), böylece inen dosya ekranda görülenle birebir aynıdır.
  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (bolum) params.set('bolum', bolum)
      if (taraf) params.set('taraf', taraf)
      if (tip) params.set('tip', tip)
      if (q) params.set('q', q)
      const res = await fetch(`/api/personnel/leavers/export?${params}`)
      if (!res.ok) throw new Error('Export hatası')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ayrilan_personel_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Excel dosyası indirildi')
    } catch (err: any) {
      toast.error(err?.message || 'Export başarısız')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <UserMinus className="h-5 w-5" /> Ayrılan Personel
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kapanmış istihdam dönemleri — her çıkış ayrı satır (çıkış-giriş geçmişi dahil).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SplitBadge color="gray" left="Filtreler" right="Sıfırla" onClick={resetFilters} disabled={!hasFilter} />
          <SplitBadge
            color="blue"
            left="Liste"
            right="Excel'e Aktar"
            onClick={() => void handleExport()}
            disabled={loading || leavers.length === 0}
          />
        </div>
      </div>

      {/* KPI kutuları KALDIRILDI (bkz. components/ui/FORM-SAYFA-STANDARDI.md);
          sayılar alttaki legend satırında duruyor — bilgi korundu, kutu gitti. */}
      <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="from">Çıkış Tarihi (başlangıç)</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="to">Çıkış Tarihi (bitiş)</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bolum">Bölüm</Label>
              <Select id="bolum" value={bolum} onChange={(e) => setBolum(e.target.value)}>
                <option value="">Tümü</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="taraf">Taraf</Label>
              <Select id="taraf" value={taraf} onChange={(e) => setTaraf(e.target.value)}>
                <option value="">Tümü</option>
                {PARTY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="tip">Tip</Label>
              <Select id="tip" value={tip} onChange={(e) => setTip(e.target.value)}>
                <option value="">Tümü</option>
                {TURNOVER_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Label htmlFor="q">Arama (Ad / Sicil)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="q"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Aramak için yazın..."
                  className="pl-8"
                />
              </div>
            </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
          Ayrılan Personel Listesi ({leavers.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left font-semibold uppercase tracking-wide text-slate-500">
              <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2.5">
                    <th>Sicil</th>
                    <th>Ad Soyad</th>
                    <th>Bölüm</th>
                    <th>Görev</th>
                    <th>Çıkış</th>
                    <th>Süre</th>
                    <th>Durum</th>
                    <th>Taraf</th>
                    <th>Kod</th>
                    <th>Tip</th>
                    <th>Sebep / Kök Neden</th>
                    <th>Kayıt Eden</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!loading && leavers.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-muted-foreground">
                    {hasFilter ? 'Filtrelerle eşleşen kayıt yok.' : 'Henüz ayrılan personel kaydı yok.'}
                  </td>
                </tr>
              )}
              {!loading &&
                leavers.map((l) => (
                  <tr
                    key={l.periodId}
                    onClick={() => router.push(`/personnel/${l.personnelId}`)}
                    className="[&>td]:px-3 [&>td]:py-2.5 hover:bg-slate-50 cursor-pointer"
                  >
                      <td className="font-mono text-xs text-slate-500">{l.sicilNo}</td>
                      <td className="font-medium text-slate-900">{l.adSoyad}</td>
                      <td>{l.bolum ?? '-'}</td>
                      <td className="text-slate-600">{l.gorev ?? '-'}</td>
                      <td className="tabular-nums">{formatTrDate(l.cikisTarihi)}</td>
                      <td className="text-slate-600">{workingPeriodText(l.workingPeriod)}</td>
                      <td>
                        {l.status === 'REENTRY' ? (
                          <Badge variant="outline" className="border-sky-300 text-sky-700 text-xs font-normal">
                            Çıkış-Giriş
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-slate-300 text-slate-600 text-xs font-normal">
                            Ayrıldı
                          </Badge>
                        )}
                      </td>
                      <td>
                        {l.exitParty && (
                          <Badge variant="outline" className="text-xs font-normal">
                            {l.exitParty}
                          </Badge>
                        )}
                      </td>
                      <td className="text-slate-600">{l.exitCode ?? '-'}</td>
                      <td>
                        {l.exitTurnoverType && (
                          <Badge
                            variant="outline"
                            className={
                              l.exitTurnoverType === 'İSTENMEYEN'
                                ? 'border-rose-300 text-rose-700 text-xs font-normal'
                                : 'border-emerald-300 text-emerald-700 text-xs font-normal'
                            }
                          >
                            {l.exitTurnoverType}
                          </Badge>
                        )}
                      </td>
                      <td className="max-w-xs text-slate-600">
                        <div className="truncate" title={[l.exitReason, l.exitRootCause].filter(Boolean).join(' / ')}>
                          {l.exitReason ?? '-'}
                          {l.exitRootCause && (
                            <span className="text-slate-400"> · {l.exitRootCause}</span>
                          )}
                        </div>
                      </td>
                      <td className="text-xs text-slate-500">
                        {l.exitRecordedBy?.name ?? l.exitRecordedBy?.email ?? '-'}
                      </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend — KPI kutularının taşındığı yer (standart: kart DIŞINDA tek satır). */}
      <p className="text-xs text-muted-foreground">
        Toplam ayrılan: {kpis.total} · Bu ay: {kpis.thisMonth} · İstenmeyen kayıp: {kpis.istenmeyen} ·
        İşveren çıkarması: {kpis.isverenCikarma}
      </p>
    </div>
  )
}
