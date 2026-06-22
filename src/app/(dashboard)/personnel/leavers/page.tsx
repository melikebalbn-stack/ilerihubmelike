'use client'

// PR-PERSONNEL-LEAVERS-LIST: Ayrılan personel raporlama listesi.
// Bölüm Değişiklikleri sayfası pattern'i, exit alanlarına uyarlandı.

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { NativeSelect as Select } from '@/components/ui/select'
import { UserMinus, Loader2, RefreshCcw, Search } from 'lucide-react'

interface Leaver {
  id: string
  sicilNo: string
  adSoyad: string
  bolum: string | null
  gorev: string | null
  iseGirisTarihi: string | null
  exitDate: string | null
  exitParty: string | null
  exitCode: string | null
  exitReason: string | null
  exitRootCause: string | null
  exitTurnoverType: string | null
  exitGeneralNote: string | null
  exitRecordedAt: string | null
  exitRecordedBy: { id: string; name: string | null; email: string } | null
  workingPeriod: { years: number; months: number; totalMonths: number } | null
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
      (l) => l.exitDate && new Date(l.exitDate) >= thisMonthStart
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserMinus className="h-6 w-6 text-[#1B4F72]" />
          Ayrılan Personel
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aktifte olmayan + çıkış bilgisi kayıtlı personel (son 500 kayıt).
        </p>
      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Toplam Ayrılan" value={kpis.total} />
        <KpiCard label="Bu Ay" value={kpis.thisMonth} accent="amber" />
        <KpiCard label="İstenmeyen Kayıp" value={kpis.istenmeyen} accent="rose" />
        <KpiCard label="İşveren Çıkarması" value={kpis.isverenCikarma} accent="slate" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtreler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
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
            <Button variant="outline" onClick={resetFilters} disabled={!hasFilter}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Sıfırla
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Ayrılan Personel Listesi</span>
            <Badge variant="outline">{leavers.length} kayıt</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Yükleniyor...
            </div>
          ) : leavers.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <UserMinus className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">
                {hasFilter ? 'Filtrelerle eşleşen kayıt yok.' : 'Henüz ayrılan personel kaydı yok.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-2 py-2 text-left">Sicil</th>
                    <th className="px-2 py-2 text-left">Ad Soyad</th>
                    <th className="px-2 py-2 text-left">Bölüm</th>
                    <th className="px-2 py-2 text-left">Görev</th>
                    <th className="px-2 py-2 text-left">Çıkış</th>
                    <th className="px-2 py-2 text-left">Süre</th>
                    <th className="px-2 py-2 text-left">Taraf</th>
                    <th className="px-2 py-2 text-left">Kod</th>
                    <th className="px-2 py-2 text-left">Tip</th>
                    <th className="px-2 py-2 text-left">Sebep / Kök Neden</th>
                    <th className="px-2 py-2 text-left">Kayıt Eden</th>
                  </tr>
                </thead>
                <tbody>
                  {leavers.map((l) => (
                    <tr
                      key={l.id}
                      onClick={() => router.push(`/personnel/${l.id}`)}
                      className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-2 py-2 font-mono text-[11px] text-slate-500">{l.sicilNo}</td>
                      <td className="px-2 py-2 font-medium text-slate-900">{l.adSoyad}</td>
                      <td className="px-2 py-2">{l.bolum ?? '-'}</td>
                      <td className="px-2 py-2 text-slate-600">{l.gorev ?? '-'}</td>
                      <td className="px-2 py-2 tabular-nums">{formatTrDate(l.exitDate)}</td>
                      <td className="px-2 py-2 text-slate-600">{workingPeriodText(l.workingPeriod)}</td>
                      <td className="px-2 py-2">
                        {l.exitParty && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {l.exitParty}
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-2 text-slate-600">{l.exitCode ?? '-'}</td>
                      <td className="px-2 py-2">
                        {l.exitTurnoverType && (
                          <Badge
                            variant="outline"
                            className={
                              l.exitTurnoverType === 'İSTENMEYEN'
                                ? 'border-rose-300 text-rose-700 text-[10px] font-normal'
                                : 'border-emerald-300 text-emerald-700 text-[10px] font-normal'
                            }
                          >
                            {l.exitTurnoverType}
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-2 max-w-xs text-slate-600">
                        <div className="truncate" title={[l.exitReason, l.exitRootCause].filter(Boolean).join(' / ')}>
                          {l.exitReason ?? '-'}
                          {l.exitRootCause && (
                            <span className="text-slate-400"> · {l.exitRootCause}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-500">
                        {l.exitRecordedBy?.name ?? l.exitRecordedBy?.email ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({ label, value, accent = 'blue' }: { label: string; value: number; accent?: 'blue' | 'amber' | 'rose' | 'slate' }) {
  const accentCls =
    accent === 'amber'
      ? 'text-amber-700'
      : accent === 'rose'
        ? 'text-rose-700'
        : accent === 'slate'
          ? 'text-slate-700'
          : 'text-[#1B4F72]'
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accentCls}`}>{value}</p>
    </div>
  )
}
