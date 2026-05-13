'use client'

// PR-PERSONNEL-DEPARTMENT-TRANSFER: Personel detayında bölüm değişiklik geçmişi.

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRightLeft, Loader2 } from 'lucide-react'
import { gerekceLabel, talepEdenLabel, onayLabel } from './constants'

interface Transfer {
  id: string
  talepTarihi: string | null
  talepEden: string | null
  isgOnayi: string | null
  doktorOnayi: string | null
  gerekceler: string[]
  gerekceAciklamasi: string | null
  gerekceDigerKisi: string | null
  gerekceDigerIs: string | null
  transferEdenBolum: string
  transferEdilenBolum: string
  transferTarihi: string | null
  isHistorical: boolean
  createdAt: string
  kayitEden: { id: string; name: string | null; email: string } | null
}

interface Props {
  personnelId: string
  /** Modal save sonrası refetch için dış component'in incrementlediği değer. */
  refreshKey?: number
}

function formatTrDate(s: string | null | undefined): string {
  if (!s) return '-'
  try {
    return new Date(s).toLocaleDateString('tr-TR')
  } catch {
    return s
  }
}

export function PersonnelTransferHistory({ personnelId, refreshKey = 0 }: Props) {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/personnel/${personnelId}/department-transfer`)
      if (res.ok) {
        setTransfers(await res.json())
      } else {
        setTransfers([])
      }
    } catch {
      setTransfers([])
    } finally {
      setLoading(false)
    }
  }, [personnelId])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-[#1B4F72]" />
            Bölüm Değişiklik Geçmişi
          </span>
          <Badge variant="outline">{transfers.length} kayıt</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Yükleniyor...</span>
          </div>
        ) : transfers.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz bölüm değişikliği yok.</p>
        ) : (
          <div className="space-y-3">
            {transfers.map((t) => (
              <div key={t.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/40">
                <div className="flex flex-wrap justify-between gap-2 mb-2">
                  <div className="font-medium text-sm text-slate-900 flex items-center gap-2 flex-wrap">
                    <span className="text-slate-600">{t.transferEdenBolum}</span>
                    <ArrowRightLeft className="inline w-3.5 h-3.5 text-slate-400" />
                    <span>{t.transferEdilenBolum}</span>
                    {t.isHistorical && (
                      <Badge
                        variant="outline"
                        className="text-[9px] font-normal bg-amber-50 text-amber-700 border-amber-200 px-1.5 py-0"
                      >
                        Historical
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    {t.transferTarihi ? formatTrDate(t.transferTarihi) : '(tarih yok)'}
                  </div>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  {t.isHistorical ? (
                    <div className="text-slate-500 italic">
                      İK Excel listesinden import edilmiş tarihsel kayıt — form alanları (talep/onay) o dönemde tutulmamış.
                    </div>
                  ) : (
                    <>
                      <div>
                        Talep eden: <strong>{t.talepEden ? talepEdenLabel(t.talepEden) : '-'}</strong> · Talep tarihi:{' '}
                        {t.talepTarihi ? formatTrDate(t.talepTarihi) : '-'}
                      </div>
                      <div>
                        İSG: <strong>{t.isgOnayi ? onayLabel(t.isgOnayi) : '-'}</strong> · Doktor:{' '}
                        <strong>{t.doktorOnayi ? onayLabel(t.doktorOnayi) : '-'}</strong>
                      </div>
                    </>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {t.gerekceler.map((g) => (
                      <Badge key={g} variant="secondary" className="text-[10px] font-normal">
                        {gerekceLabel(g)}
                      </Badge>
                    ))}
                    {t.gerekceDigerKisi && (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Diğer (kişi): {t.gerekceDigerKisi}
                      </Badge>
                    )}
                    {t.gerekceDigerIs && (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Diğer (iş): {t.gerekceDigerIs}
                      </Badge>
                    )}
                  </div>
                  {t.gerekceAciklamasi && (
                    <div className="italic text-slate-500 mt-1">{t.gerekceAciklamasi}</div>
                  )}
                  {t.kayitEden && (
                    <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-200/60 mt-2">
                      Kayıt eden: {t.kayitEden.name ?? t.kayitEden.email} ·{' '}
                      {new Date(t.createdAt).toLocaleString('tr-TR')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
