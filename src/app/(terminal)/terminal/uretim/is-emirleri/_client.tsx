'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, RefreshCw, Search } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { TerminalIsEmri } from '@/lib/uretim/terminal-mock'
import { OperatorBadge } from '../../_shared'

interface Props {
  operatorName: string
  isMerkezi: string
  /** İş merkezi adı (WorkCenterDescription) — başlıkta kod yerine gösterilir. */
  isMerkeziAdi: string
  isEmirleri: TerminalIsEmri[]
  /** IFS okuma hatası (varsa) — tablo yerine hata kutusu gösterilir. */
  error?: string | null
}

/** Üst arama kutusunun taradığı alanlar. */
const SEARCH_FIELDS: ((r: TerminalIsEmri) => string)[] = [
  (r) => r.isEmriNo,
  (r) => r.stokKodu,
  (r) => r.stokAdi,
]

// Teslim tarihi 'yyyy-MM-dd' → 'dd.MM.yyyy' (tz-güvenli, elle).
function formatTeslim(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}.${m}.${y}` : iso
}

interface ColumnDef {
  key: string
  label: string
  numeric: boolean
  get: (r: TerminalIsEmri) => string
}

const COLUMNS: ColumnDef[] = [
  { key: 'isMerkezi', label: 'İş Merkezi', numeric: false, get: (r) => r.isMerkezi },
  { key: 'isEmriNo', label: 'İş Emri No', numeric: false, get: (r) => r.isEmriNo },
  { key: 'operasyon', label: 'Operasyon', numeric: false, get: (r) => r.operasyon },
  { key: 'stokKodu', label: 'Stok Kodu', numeric: false, get: (r) => r.stokKodu },
  { key: 'stokAdi', label: 'Stok Adı', numeric: false, get: (r) => r.stokAdi },
  {
    key: 'teslimTarihi',
    label: 'Teslim Tarihi',
    numeric: false,
    get: (r) => formatTeslim(r.teslimTarihi),
  },
  { key: 'miktar', label: 'Miktar', numeric: true, get: (r) => String(r.miktar) },
  { key: 'kalanMiktar', label: 'Kalan', numeric: true, get: (r) => String(r.kalanMiktar) },
  { key: 'uretilenMiktar', label: 'Üretilen', numeric: true, get: (r) => String(r.uretilenMiktar) },
  { key: 'hurdaMiktar', label: 'Hurda', numeric: true, get: (r) => String(r.hurdaMiktar) },
]

const trLower = (s: string) => s.toLocaleLowerCase('tr')

export function IsEmirleriClient({
  operatorName,
  isMerkezi,
  isMerkeziAdi,
  isEmirleri,
  error,
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})

  const filtered = useMemo(() => {
    const q = trLower(search.trim())
    const active = COLUMNS.map((c) => ({
      col: c,
      q: trLower((filters[c.key] ?? '').trim()),
    })).filter((f) => f.q.length > 0)

    return isEmirleri.filter((row) => {
      // Üst arama: iş emri no / parça kodu / parça adı içinde (herhangi biri).
      if (q && !SEARCH_FIELDS.some((get) => trLower(get(row)).includes(q))) return false
      // Kolon filtreleri: hepsi eşleşmeli.
      return active.every(({ col, q: cq }) => trLower(col.get(row)).includes(cq))
    })
  }, [search, filters, isEmirleri])

  const setFilter = (key: string, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const handleRowClick = (row: TerminalIsEmri) => {
    router.push(`/terminal/uretim/is-emirleri/${row.id}`)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-6">
      {/* Üst bar — geri + başlık (sol) + operatör (sağ) */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/terminal/uretim?wc=${encodeURIComponent(isMerkezi)}`}
            aria-label="Ana menüye dön"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors hover:bg-muted active:bg-muted/70"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold">{isMerkeziAdi || isMerkezi}</span>
            <span className="text-xs text-muted-foreground">
              İş Emirleri
              {isMerkeziAdi ? ` · ${isMerkezi}` : ''}
              {error ? '' : ` · ${filtered.length} kayıt`}
            </span>
          </div>
        </div>
        <OperatorBadge name={operatorName} />
      </div>

      {error ? (
        /* IFS hatası — tablo yerine hata kutusu + yeniden dene */
        <div className="flex flex-col items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-6 text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-5 w-5" />
            İş emirleri IFS&apos;ten alınamadı
          </div>
          <p className="max-w-full break-all text-sm text-red-700/90">{error}</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 active:translate-y-px"
          >
            <RefreshCw className="h-4 w-4" />
            Yeniden Dene
          </button>
        </div>
      ) : (
      <>
      {/* Üst arama — iş emri no / parça kodu / parça adı (dokunmatik: büyük input) */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ara — iş emri no, parça kodu veya parça adı"
          aria-label="İş emri ara"
          className="h-12 min-h-12 w-full rounded-xl border bg-background pl-11 pr-4 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Tablo — geniş, yatay scroll */}
      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow>
              {COLUMNS.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn('whitespace-nowrap', c.numeric && 'text-right')}
                >
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
            {/* İkinci satır — kolon filtreleri */}
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((c) => (
                <TableHead key={c.key} className="p-1.5">
                  <input
                    value={filters[c.key] ?? ''}
                    onChange={(e) => setFilter(c.key, e.target.value)}
                    placeholder="Filtre"
                    aria-label={`${c.label} filtresi`}
                    className={cn(
                      'h-8 w-full min-w-[80px] rounded-md border bg-background px-2 text-xs font-normal outline-none focus:ring-1 focus:ring-ring',
                      c.numeric && 'text-right',
                    )}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={COLUMNS.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  Kayıt bulunamadı
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => handleRowClick(row)}
                  className="cursor-pointer active:bg-muted/70"
                >
                  {COLUMNS.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn(
                        'h-12 whitespace-nowrap',
                        c.numeric && 'text-right tabular-nums',
                        c.key === 'stokAdi' && 'whitespace-normal',
                      )}
                    >
                      {c.get(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </>
      )}
    </div>
  )
}
