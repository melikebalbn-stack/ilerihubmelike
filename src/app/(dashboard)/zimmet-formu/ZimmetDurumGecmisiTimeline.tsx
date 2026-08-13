'use client'

// PersonnelTransferHistory.tsx'in görsel desenini taklit eder (Card + sayaç
// rozeti + bordürlü satır listesi) - zimmet durum geçmişine özel.

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { History, ArrowRight, Loader2 } from 'lucide-react'

interface GecmisKaydi {
  id: string
  eskiDurum: string | null
  yeniDurum: string
  not?: string | null
  createdAt: string
  islemYapan: { name: string | null; email: string } | null
}

interface Props {
  zimmetId: string
}

const DURUM_LABELS: Record<string, string> = {
  ONAY_BEKLIYOR: 'Onay Bekliyor',
  ONAYLANDI: 'Onaylandı',
  REDDEDILDI: 'Reddedildi',
  İMZA_BEKLENIYOR: 'İmza Bekleniyor',
  İMZALANDI: 'İmzalandı',
  SILINDI: 'Silindi',
}

function durumLabel(durum: string): string {
  return DURUM_LABELS[durum] ?? durum
}

function formatTrDateTime(s: string): string {
  try {
    return new Date(s).toLocaleString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return s
  }
}

export function ZimmetDurumGecmisiTimeline({ zimmetId }: Props) {
  const [kayitlar, setKayitlar] = useState<GecmisKaydi[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/zimmet-formu/${zimmetId}/gecmis`)
      if (res.ok) {
        setKayitlar(await res.json())
      } else {
        setKayitlar([])
      }
    } catch {
      setKayitlar([])
    } finally {
      setLoading(false)
    }
  }, [zimmetId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <History className="h-5 w-5 text-[#1B4F72]" />
            Durum Geçmişi
          </span>
          <Badge variant="outline">{kayitlar.length} kayıt</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Yükleniyor...</span>
          </div>
        ) : kayitlar.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz durum değişikliği kaydı yok.</p>
        ) : (
          <div className="space-y-3">
            {kayitlar.map((k) => (
              <div key={k.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/40">
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="font-medium text-sm text-slate-900 flex items-center gap-2 flex-wrap">
                    {k.eskiDurum ? (
                      <>
                        <span className="text-slate-600">{durumLabel(k.eskiDurum)}</span>
                        <ArrowRight className="inline w-3.5 h-3.5 text-slate-400" />
                      </>
                    ) : null}
                    <span>{durumLabel(k.yeniDurum)}</span>
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    {formatTrDateTime(k.createdAt)}
                  </div>
                </div>
                {k.not && <div className="text-xs italic text-slate-500 mt-1">{k.not}</div>}
                <div className="text-[10px] text-slate-400 pt-2 mt-2 border-t border-slate-200/60">
                  İşlemi yapan: {k.islemYapan ? (k.islemYapan.name ?? k.islemYapan.email) : 'Bilinmiyor'}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
