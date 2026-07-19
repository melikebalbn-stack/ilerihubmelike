'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { BayrakTanim } from '@/lib/ipro/yonetim-etiketler'

/** IPRO yönetim API zarfı: { ok, ... } / { ok:false, error }. */
export async function iproFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } : init?.headers,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok && data?.ok !== false, data }
}

/** Yazma işlemi + toast. Başarılıysa true döner. */
export async function iproYaz(
  url: string,
  init: RequestInit,
  basariMesaji: string,
): Promise<boolean> {
  const { ok, data } = await iproFetch(url, init)
  if (ok) {
    toast.success(basariMesaji)
    return true
  }
  toast.error(data?.error ?? 'İşlem başarısız')
  return false
}

export function AktifRozet({ aktif }: { aktif: boolean }) {
  return aktif ? <Badge variant="secondary">Aktif</Badge> : <Badge variant="outline">Pasif</Badge>
}

/**
 * Bayraklar için katlanır "Gelişmiş" bölümü. Varsayılan kapalı — hurda 7,
 * duruş 10 bayrak taşıyor, hepsi açıkken form okunamıyor.
 */
export function GelismisBolum({
  bayraklar,
  degerler,
  onDegis,
  readOnly,
}: {
  bayraklar: BayrakTanim[]
  degerler: Record<string, boolean>
  onDegis: (alan: string, deger: boolean) => void
  readOnly?: boolean
}) {
  const [acik, setAcik] = useState(false)
  const isaretliSayisi = bayraklar.filter((b) => degerler[b.alan]).length

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setAcik(!acik)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {acik ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="flex-1 text-left">Gelişmiş</span>
        <span className="text-xs text-slate-500">
          {isaretliSayisi}/{bayraklar.length} işaretli
        </span>
      </button>

      {acik && (
        <TooltipProvider>
          <div className="grid gap-3 border-t px-4 py-4 sm:grid-cols-2">
            {bayraklar.map((b) => (
              <div key={b.alan} className="flex items-center justify-between gap-3">
                <Label
                  htmlFor={`bayrak-${b.alan}`}
                  className={`flex items-center gap-1.5 text-sm font-normal ${b.uygulanmiyor ? 'text-slate-400' : ''}`}
                >
                  {b.etiket}
                  {b.ipucu && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{b.ipucu}</TooltipContent>
                    </Tooltip>
                  )}
                </Label>
                <Switch
                  id={`bayrak-${b.alan}`}
                  checked={Boolean(degerler[b.alan])}
                  onCheckedChange={(v) => onDegis(b.alan, v)}
                  disabled={readOnly}
                />
              </div>
            ))}
          </div>
        </TooltipProvider>
      )}
    </div>
  )
}
