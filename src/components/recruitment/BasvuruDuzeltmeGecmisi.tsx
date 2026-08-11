'use client'

// Başvuru düzeltme geçmişi — kim, ne zaman, hangi alan, eski → yeni.
// Kaynak: GET .../job-applications/[id]/duzeltme-gecmisi (PermissionAuditLog).
// Kayıt yoksa HİÇBİR ŞEY render edilmez (temiz başvuruda boş kutu görünmesin).

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { History } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Degisiklik = { alan: string; etiket: string; eski: unknown; yeni: unknown }
type Kayit = {
  id: string
  createdAt: string
  degistiren: string | null
  degisiklikler: Degisiklik[]
}

// Denetimde saklanan ham değer her tipte olabilir (tarih, dizi, nesne, bool, null).
function goster(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Evet' : 'Hayır'
  if (typeof v === 'object') {
    // Dizi/nesne alanları (iş tecrübesi, referanslar…) — satır sayısı yeterli bilgi;
    // tam içeriği basmak geçmişi okunmaz hale getirir.
    const n = Array.isArray(v) ? v.length : Object.keys(v as object).length
    return `${n} kayıt`
  }
  const s = String(v)
  // ISO tarih ise gün olarak göster.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return format(d, 'd MMM yyyy', { locale: tr })
  }
  return s.length > 80 ? `${s.slice(0, 80)}…` : s
}

export function BasvuruDuzeltmeGecmisi({
  applicationId,
  yenile,
}: {
  applicationId: string
  /** Değeri her değiştiğinde geçmiş yeniden çekilir (kaydet sonrası tazeleme). */
  yenile?: number
}) {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([])

  const cek = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/strategic-hr/recruitment/job-applications/${applicationId}/duzeltme-gecmisi`,
      )
      if (!res.ok) return // 403 (müdür) ya da hata → bölüm hiç görünmez
      const json = await res.json()
      setKayitlar(Array.isArray(json.gecmis) ? json.gecmis : [])
    } catch {
      // sessiz — geçmiş ikincil bilgi, sayfayı bozmasın
    }
  }, [applicationId])

  useEffect(() => {
    cek()
  }, [cek, yenile])

  if (kayitlar.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Düzeltme Geçmişi ({kayitlar.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {kayitlar.map((k) => (
          <div key={k.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-medium text-slate-700">{k.degistiren ?? 'Bilinmiyor'}</span>
              <span>{format(new Date(k.createdAt), 'd MMM yyyy HH:mm', { locale: tr })}</span>
            </div>
            <div className="space-y-1">
              {k.degisiklikler.map((d, i) => (
                <div key={i} className="text-sm flex flex-wrap items-baseline gap-x-2">
                  <span className="text-slate-600">{d.etiket || d.alan}:</span>
                  <span className="text-red-700 line-through">{goster(d.eski)}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-green-700 font-medium">{goster(d.yeni)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
