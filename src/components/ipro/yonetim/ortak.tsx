'use client'

import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Info, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } : init?.headers,
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok && data?.ok !== false, data }
  } catch {
    // Ağ hatası (bağlantı kopması, dev sunucu yeniden yükleme) — ASLA fırlatma.
    // Fırlatırsa çağıran yukle() yarıda kalır, setYukleniyor(false) hiç çalışmaz
    // ve ekranın ortasındaki "Yükleniyor…" sonsuza kadar asılı kalır.
    return { ok: false, data: { error: 'Sunucuya ulaşılamadı' } as T & { error?: string } }
  }
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

// ── Liste araç çubuğu (5 ekranda ortak) ──────────────────────────────────

export type FiltreSecenek = { deger: string; etiket: string }
export type FiltreGrubu = {
  /** Grup etiketi — birden fazla grup varsa ayırt etmek için. */
  ad?: string
  secili: string
  sec: (deger: string) => void
  secenekler: FiltreSecenek[]
}

/**
 * Arama kutusu + filtre butonları + "gösterilen / toplam" rozeti.
 * Beş yönetim ekranı da bunu kullanır; desen tek yerde durur.
 */
export function ListeAracCubugu({
  arama,
  onArama,
  placeholder,
  gruplar = [],
  gosterilen,
  toplam,
  children,
}: {
  arama: string
  onArama: (v: string) => void
  placeholder: string
  gruplar?: FiltreGrubu[]
  gosterilen: number
  toplam: number
  /** Sağa yerleşen ek içerik — "Yeni" butonu gibi. */
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <Input value={arama} onChange={(e) => onArama(e.target.value)} placeholder={placeholder} className="pl-8" />
      </div>

      {gruplar.map((g, i) => (
        <div key={g.ad ?? i} className="flex flex-wrap items-center gap-1">
          {g.ad && <span className="mr-1 text-xs text-slate-500">{g.ad}:</span>}
          {g.secenekler.map((s) => (
            <Button
              key={s.deger}
              variant={g.secili === s.deger ? 'default' : 'outline'}
              size="sm"
              onClick={() => g.sec(s.deger)}
            >
              {s.etiket}
            </Button>
          ))}
        </div>
      ))}

      <Badge variant="outline">
        {gosterilen} / {toplam}
      </Badge>

      {children}
    </div>
  )
}

/**
 * IPRO listelerinde kompakt gövde fontu.
 *
 * `ResponsiveTable` 58 dosyada ortak kullanılıyor — ona dokunulmadı, modüle
 * özel prop da eklenmedi. Bunun yerine sarmalayıcıda arbitrary variant ile
 * YALNIZ gövde hücreleri (td) küçültülüyor; başlıklar (th) olduğu gibi kalıyor.
 * text-sm (14px) → text-xs (12px).
 *
 * NOT: mobil kart görünümünde hücreler kendi açık font sınıflarını taşıdığı
 * için bu kural onlara işlemez — masaüstü tablo için geçerlidir.
 */
export function KompaktListe({ children }: { children: ReactNode }) {
  return <div className="[&_td]:text-xs">{children}</div>
}
