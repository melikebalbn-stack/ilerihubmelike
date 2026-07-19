'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Info, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'
import { useIsMobile } from '@/hooks/useIsMobile'
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


// ── Sıralanabilir tablo ──────────────────────────────────────────────────

export type SiraTipi = 'metin' | 'sayi' | 'bool'

export type SiralanabilirKolon<T> = ResponsiveColumn<T> & {
  siralanabilir?: boolean
  /** Karşılaştırma türü — metin Türkçe locale ile, sayı sayısal. */
  siraTipi?: SiraTipi
  /**
   * Sıralama için HAM değer. `render` JSX döndürdüğünde satırdan doğrudan
   * okunamadığı için gerekli (ör. Durum kolonu rozet basıyor ama sıralama
   * `aktif` boolean'ına göre yapılmalı).
   */
  siraDeger?: (row: T) => string | number | boolean | null | undefined
}

type SiraDurum = { key: string; yon: 'artan' | 'azalan' } | null

function karsilastir(a: unknown, b: unknown, tip: SiraTipi): number {
  // null/undefined her zaman sona — hangi yönde sıralanırsa sıralansın.
  const aBos = a === null || a === undefined || a === ''
  const bBos = b === null || b === undefined || b === ''
  if (aBos && bBos) return 0
  if (aBos) return 1
  if (bBos) return -1

  if (tip === 'sayi') return Number(a) - Number(b)
  if (tip === 'bool') return Number(Boolean(a)) - Number(Boolean(b))
  // Türkçe locale: İ/ı, Ç, Ş, Ğ, Ö, Ü doğru sıralansın.
  return String(a).localeCompare(String(b), 'tr', { numeric: true, sensitivity: 'base' })
}

/**
 * IPRO listelerinin ortak tablosu: başlığa tıklayınca sıralar
 * (artan → azalan → varsayılan), aktif kolonda ▲/▼ gösterir.
 *
 * Masaüstünde kendi başlıklarını çizer; MOBİLDE `ResponsiveTable`'a devreder —
 * kart görünümünde `label` düz metin olarak basıldığı için oraya tıklanabilir
 * başlık koymak kart etiketlerini bozardı. Ortak bileşen değiştirilmedi.
 */
export function SiralanabilirTablo<T extends Record<string, any>>({
  kolonlar,
  veri,
  emptyMessage = 'Kayıt bulunamadı',
  keyField = 'id',
}: {
  kolonlar: SiralanabilirKolon<T>[]
  veri: T[]
  emptyMessage?: string
  keyField?: string
}) {
  const isMobile = useIsMobile()
  const [sira, setSira] = useState<SiraDurum>(null)

  const siraliVeri = useMemo(() => {
    if (!sira) return veri
    const kolon = kolonlar.find((k) => k.key === sira.key)
    if (!kolon) return veri
    const tip = kolon.siraTipi ?? 'metin'
    const deger = (row: T) => (kolon.siraDeger ? kolon.siraDeger(row) : row[kolon.key])
    // Kopya üzerinde sırala — prop dizisini yerinde değiştirme.
    return [...veri].sort((a, b) => {
      const s = karsilastir(deger(a), deger(b), tip)
      return sira.yon === 'artan' ? s : -s
    })
  }, [veri, sira, kolonlar])

  function basligaTikla(key: string) {
    setSira((mevcut) => {
      if (!mevcut || mevcut.key !== key) return { key, yon: 'artan' }
      if (mevcut.yon === 'artan') return { key, yon: 'azalan' }
      return null // üçüncü tık → varsayılan sıra
    })
  }

  if (isMobile) {
    return <ResponsiveTable columns={kolonlar} data={veri} emptyMessage={emptyMessage} keyField={keyField} />
  }

  if (veri.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">{emptyMessage}</div>
  }

  return (
    <div className="rounded-md border [&_td]:text-xs">
      <Table>
        <TableHeader>
          <TableRow>
            {kolonlar.map((k) => (
              <TableHead key={k.key}>
                {k.siralanabilir ? (
                  <button
                    type="button"
                    onClick={() => basligaTikla(k.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    title="Sıralamak için tıklayın"
                  >
                    {k.label}
                    {sira?.key === k.key ? (
                      sira.yon === 'artan' ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
                    )}
                  </button>
                ) : (
                  k.label
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {siraliVeri.map((row) => (
            <TableRow key={row[keyField]}>
              {kolonlar.map((k) => (
                <TableCell key={k.key}>{k.render ? k.render(row) : (row[k.key] ?? '-')}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
