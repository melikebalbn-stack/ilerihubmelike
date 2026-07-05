'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'
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
import { OperatorBadge } from '../_shared'

interface Props {
  operatorName: string
  isMerkezi: string
  isEmirleri: TerminalIsEmri[]
  /** IFS okuma hatası (varsa) — tablo yerine hata kutusu gösterilir. */
  error?: string | null
}

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
  isEmirleri,
  error,
}: Props) {
  const router = useRouter()
  const [filters, setFilters] = useState<Record<string, string>>({})

  const filtered = useMemo(() => {
    const active = COLUMNS.map((c) => ({
      col: c,
      q: trLower((filters[c.key] ?? '').trim()),
    })).filter((f) => f.q.length > 0)

    if (active.length === 0) return isEmirleri
    return isEmirleri.filter((row) =>
      active.every(({ col, q }) => trLower(col.get(row)).includes(q)),
    )
  }, [filters, isEmirleri])

  const setFilter = (key: string, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const handleRowClick = (row: TerminalIsEmri) => {
    router.push(`/uretim/terminal/is-emirleri/${row.id}`)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-6">
      {/* Üst bar — geri + başlık (sol) + operatör (sağ) */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/uretim/terminal"
            aria-label="Ana menüye dön"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors hover:bg-muted active:bg-muted/70"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold">İş Emirleri</span>
            <span className="text-xs text-muted-foreground">
              {isMerkezi}
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
      /* Tablo — geniş, yatay scroll */
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
      )}
    </div>
  )
}
