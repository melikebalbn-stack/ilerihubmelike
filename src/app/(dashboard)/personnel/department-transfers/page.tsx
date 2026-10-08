'use client'

// PR-PERSONNEL-DEPARTMENT-TRANSFER: Tüm bölüm transferleri listesi + filtreler.

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect as Select } from '@/components/ui/select'
import { ArrowRightLeft, Loader2 } from 'lucide-react'
import { SplitBadge } from '@/components/akademi/SplitBadge'
import { gerekceLabel, talepEdenLabel, onayLabel } from '@/components/personnel/department-transfer/constants'

interface Transfer {
  id: string
  talepTarihi: string | null
  talepEden: string | null
  isgOnayi: string | null
  doktorOnayi: string | null
  gerekceler: string[]
  gerekceDigerKisi: string | null
  gerekceDigerIs: string | null
  transferEdenBolum: string
  transferEdilenBolum: string
  transferTarihi: string | null
  isHistorical: boolean
  createdAt: string
  personnel: { id: string; sicilNo: string; adSoyad: string; bolum: string | null }
  kayitEden: { id: string; name: string | null; email: string } | null
}

interface Department {
  id: string
  name: string
}

function formatTrDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString('tr-TR')
  } catch {
    return s
  }
}

export default function DepartmentTransfersListPage() {
  const router = useRouter()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [bolum, setBolum] = useState('')
  const [isHistorical, setIsHistorical] = useState('') // '' (all) | 'false' (yeni form) | 'true' (historical)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (bolum) params.set('bolum', bolum)
    if (isHistorical !== '') params.set('isHistorical', isHistorical)
    try {
      const res = await fetch(`/api/personnel/department-transfers?${params}`)
      if (res.ok) setTransfers(await res.json())
      else setTransfers([])
    } catch {
      setTransfers([])
    } finally {
      setLoading(false)
    }
  }, [from, to, bolum, isHistorical])

  useEffect(() => {
    fetch('/api/settings/hr-departments')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setDepartments(d ?? []))
      .catch(() => setDepartments([]))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ArrowRightLeft className="h-5 w-5" /> Bölüm Değişiklikleri
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tüm aktif bölüm transferleri (son 500 kayıt).
          </p>
        </div>
        <SplitBadge
          color="gray"
          left="Filtreler"
          right="Sıfırla"
          onClick={() => {
            setFrom('')
            setTo('')
            setBolum('')
            setIsHistorical('')
          }}
        />
      </div>

      {/* Süzgeçler AYRI KART DEĞİL — bkz. components/ui/FORM-SAYFA-STANDARDI.md */}
      <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="from">Tarih (başlangıç)</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="to">Tarih (bitiş)</Label>
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
              <Label htmlFor="kaynak">Kaynak</Label>
              <Select id="kaynak" value={isHistorical} onChange={(e) => setIsHistorical(e.target.value)}>
                <option value="">Tümü</option>
                <option value="false">Yeni form</option>
                <option value="true">Historical</option>
              </Select>
            </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
          Transfer Listesi ({transfers.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left font-semibold uppercase tracking-wide text-slate-500">
              <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2.5">
                <th>#</th>
                <th>Sicil / Ad Soyad</th>
                <th>Talep Tar.</th>
                <th>Talep Eden</th>
                <th>İSG</th>
                <th>Doktor</th>
                <th>Gerekçeler</th>
                <th>Eski → Yeni Bölüm</th>
                <th>Transfer Tar.</th>
                <th>Kayıt Eden</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!loading && transfers.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    Filtrelerle eşleşen kayıt yok.
                  </td>
                </tr>
              )}
              {!loading &&
                transfers.map((t, idx) => (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/personnel/${t.personnel.id}`)}
                    className="[&>td]:px-3 [&>td]:py-2.5 hover:bg-slate-50 cursor-pointer"
                  >
                      <td className="text-slate-400 tabular-nums">{idx + 1}</td>
                      <td>
                        <div className="font-medium text-slate-900 flex items-center gap-1.5">
                          {t.personnel.adSoyad}
                          {t.isHistorical && (
                            <Badge
                              variant="outline"
                              className="text-xs font-normal bg-amber-50 text-amber-700 border-amber-200 px-1.5 py-0"
                            >
                              Historical
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{t.personnel.sicilNo}</div>
                      </td>
                      <td className="tabular-nums">{t.talepTarihi ? formatTrDate(t.talepTarihi) : '-'}</td>
                      <td>{t.talepEden ? talepEdenLabel(t.talepEden) : '-'}</td>
                      <td>
                        {t.isgOnayi ? (
                          <Badge
                            variant="outline"
                            className={t.isgOnayi === 'UYGUN' ? 'border-emerald-300 text-emerald-700' : 'border-rose-300 text-rose-700'}
                          >
                            {onayLabel(t.isgOnayi)}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td>
                        {t.doktorOnayi ? (
                          <Badge
                            variant="outline"
                            className={t.doktorOnayi === 'UYGUN' ? 'border-emerald-300 text-emerald-700' : 'border-rose-300 text-rose-700'}
                          >
                            {onayLabel(t.doktorOnayi)}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {t.gerekceler.map((g) => (
                            <Badge key={g} variant="secondary" className="text-xs font-normal">
                              {gerekceLabel(g)}
                            </Badge>
                          ))}
                          {t.gerekceDigerKisi && (
                            <Badge variant="secondary" className="text-xs font-normal">
                              Diğer (kişi)
                            </Badge>
                          )}
                          {t.gerekceDigerIs && (
                            <Badge variant="secondary" className="text-xs font-normal">
                              Diğer (iş)
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="text-slate-500">{t.transferEdenBolum}</span>
                        <ArrowRightLeft className="inline w-3 h-3 mx-1.5 text-slate-400" />
                        <span className="font-medium">{t.transferEdilenBolum}</span>
                      </td>
                      <td className="tabular-nums font-medium">{t.transferTarihi ? formatTrDate(t.transferTarihi) : '-'}</td>
                      <td className="text-xs text-slate-500">
                        {t.kayitEden?.name ?? t.kayitEden?.email ?? '-'}
                      </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
