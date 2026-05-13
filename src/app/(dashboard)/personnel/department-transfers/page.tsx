'use client'

// PR-PERSONNEL-DEPARTMENT-TRANSFER: Tüm bölüm transferleri listesi + filtreler.

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { NativeSelect as Select } from '@/components/ui/select'
import { ArrowRightLeft, Loader2, RefreshCcw } from 'lucide-react'
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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6 text-[#1B4F72]" />
          Bölüm Değişiklikleri
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tüm aktif bölüm transferleri (son 500 kayıt).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtreler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
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
            <Button
              variant="outline"
              onClick={() => {
                setFrom('')
                setTo('')
                setBolum('')
                setIsHistorical('')
              }}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Sıfırla
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Transfer Listesi</span>
            <Badge variant="outline">{transfers.length} kayıt</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Yükleniyor...
            </div>
          ) : transfers.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Filtrelerle eşleşen kayıt yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-2 py-2 text-left">#</th>
                    <th className="px-2 py-2 text-left">Sicil / Ad Soyad</th>
                    <th className="px-2 py-2 text-left">Talep Tar.</th>
                    <th className="px-2 py-2 text-left">Talep Eden</th>
                    <th className="px-2 py-2 text-left">İSG</th>
                    <th className="px-2 py-2 text-left">Doktor</th>
                    <th className="px-2 py-2 text-left">Gerekçeler</th>
                    <th className="px-2 py-2 text-left">Eski → Yeni Bölüm</th>
                    <th className="px-2 py-2 text-left">Transfer Tar.</th>
                    <th className="px-2 py-2 text-left">Kayıt Eden</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t, idx) => (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/personnel/${t.personnel.id}`)}
                      className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-2 py-2 text-slate-400 tabular-nums">{idx + 1}</td>
                      <td className="px-2 py-2">
                        <div className="font-medium text-slate-900 flex items-center gap-1.5">
                          {t.personnel.adSoyad}
                          {t.isHistorical && (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-normal bg-amber-50 text-amber-700 border-amber-200 px-1.5 py-0"
                            >
                              Historical
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{t.personnel.sicilNo}</div>
                      </td>
                      <td className="px-2 py-2 tabular-nums">{t.talepTarihi ? formatTrDate(t.talepTarihi) : '-'}</td>
                      <td className="px-2 py-2">{t.talepEden ? talepEdenLabel(t.talepEden) : '-'}</td>
                      <td className="px-2 py-2">
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
                      <td className="px-2 py-2">
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
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {t.gerekceler.map((g) => (
                            <Badge key={g} variant="secondary" className="text-[10px] font-normal">
                              {gerekceLabel(g)}
                            </Badge>
                          ))}
                          {t.gerekceDigerKisi && (
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              Diğer (kişi)
                            </Badge>
                          )}
                          {t.gerekceDigerIs && (
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              Diğer (iş)
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span className="text-slate-500">{t.transferEdenBolum}</span>
                        <ArrowRightLeft className="inline w-3 h-3 mx-1.5 text-slate-400" />
                        <span className="font-medium">{t.transferEdilenBolum}</span>
                      </td>
                      <td className="px-2 py-2 tabular-nums font-medium">{t.transferTarihi ? formatTrDate(t.transferTarihi) : '-'}</td>
                      <td className="px-2 py-2 text-xs text-slate-500">
                        {t.kayitEden?.name ?? t.kayitEden?.email ?? '-'}
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
