'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ClipboardList, Factory, Home, Plus, Search } from 'lucide-react'
import { OperatorBadge, TERMINAL_ACCENT } from '../_shared'

interface Merkez {
  kod: string
  /** WorkCenterDescription — iş merkezi adı (boş olabilir). */
  ad: string
  adet: number
}

interface Props {
  operatorName: string
  /** Açık iş emri olan iş merkezleri (kod + ad + açık iş adedi). */
  merkezler: Merkez[]
  /** URL ?wc — seçili iş merkezi kodu; yoksa seçim ekranı gösterilir. */
  seciliWc: string | null
  /** Seçili iş merkezinin adı (varsa) — başlıkta kod yerine gösterilir. */
  seciliWcAd: string
  ifsError: string | null
}

const trLower = (s: string) => s.toLocaleLowerCase('tr')

export function TerminalMenuClient({
  operatorName,
  merkezler,
  seciliWc,
  seciliWcAd,
  ifsError,
}: Props) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-6 p-6">
      {/* Ürün kimliği + Hub'a Dön */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col leading-tight">
          <span className="text-2xl font-bold tracking-tight" style={{ color: TERMINAL_ACCENT }}>
            IPRO
          </span>
          <span className="text-xs text-muted-foreground">Üretim Takip</span>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors hover:bg-muted active:bg-muted/70"
        >
          <Home className="h-5 w-5" />
          Hub&apos;a Dön
        </Link>
      </div>

      {seciliWc ? (
        <TerminalMenu operatorName={operatorName} seciliWc={seciliWc} seciliWcAd={seciliWcAd} />
      ) : (
        <MerkezSecim operatorName={operatorName} merkezler={merkezler} ifsError={ifsError} />
      )}
    </div>
  )
}

// ── İş merkezi seçim ekranı (?wc yokken) ──────────────────────────────────────
function MerkezSecim({
  operatorName,
  merkezler,
  ifsError,
}: {
  operatorName: string
  merkezler: Merkez[]
  ifsError: string | null
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const query = trLower(q.trim())
    if (!query) return merkezler
    return merkezler.filter(
      (m) => trLower(m.kod).includes(query) || trLower(m.ad).includes(query),
    )
  }, [q, merkezler])

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col leading-tight">
          <span className="text-base font-semibold">İş merkezi seçin</span>
          <span className="text-xs text-muted-foreground">Açık iş emri olan iş merkezleri</span>
        </div>
        <OperatorBadge name={operatorName} />
      </div>

      {ifsError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-6 text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-5 w-5" />
            İş merkezleri IFS&apos;ten alınamadı
          </div>
          <p className="max-w-full break-all text-sm text-red-700/90">{ifsError}</p>
        </div>
      ) : merkezler.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Açık iş emri olan iş merkezi yok.
        </div>
      ) : (
        <>
          {/* Arama — kod veya ad (dokunmatik: büyük input) */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="İş merkezi ara — kod veya ad"
              aria-label="İş merkezi ara"
              className="h-12 min-h-12 w-full rounded-xl border bg-background pl-11 pr-4 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              &quot;{q}&quot; ile eşleşen iş merkezi yok.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((m) => (
                <Link
                  key={m.kod}
                  href={`/terminal/uretim?wc=${encodeURIComponent(m.kod)}`}
                  className="group flex min-h-[120px] flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-white transition-transform group-active:scale-95"
                    style={{ background: TERMINAL_ACCENT }}
                  >
                    <Factory className="h-6 w-6" />
                  </span>
                  <div>
                    <div
                      className="line-clamp-2 text-lg font-semibold leading-tight"
                      style={{ color: TERMINAL_ACCENT }}
                    >
                      {m.ad || m.kod}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {m.ad ? `${m.kod} · ` : ''}
                      {m.adet} açık iş emri
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

// ── Seçili iş merkezi menüsü (?wc varken) ─────────────────────────────────────
function TerminalMenu({
  operatorName,
  seciliWc,
  seciliWcAd,
}: {
  operatorName: string
  seciliWc: string
  seciliWcAd: string
}) {
  return (
    <>
      {/* Üst bar — iş merkezi (sol, değiştir linki) + operatör (sağ) */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: TERMINAL_ACCENT }}
          >
            <Factory className="h-5 w-5" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold">{seciliWcAd || seciliWc}</span>
            <Link
              href="/terminal/uretim"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {seciliWcAd ? `${seciliWc} · ` : ''}İş merkezi değiştir
            </Link>
          </div>
        </div>
        <OperatorBadge name={operatorName} />
      </div>

      {/* Büyük dokunmatik kartlar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href={`/terminal/uretim/is-emirleri?wc=${encodeURIComponent(seciliWc)}`}
          className="group flex min-h-[160px] flex-col justify-between rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
          style={{ borderColor: TERMINAL_ACCENT }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-xl text-white transition-transform group-active:scale-95"
            style={{ background: TERMINAL_ACCENT }}
          >
            <ClipboardList className="h-7 w-7" />
          </span>
          <div>
            <div className="text-lg font-semibold" style={{ color: TERMINAL_ACCENT }}>
              İş Emirleri
            </div>
            <div className="text-sm text-muted-foreground">Açık iş emirlerini gör ve bildir</div>
          </div>
        </Link>

        {/* Pasif kartlar — sonra eklenecek */}
        {[0, 1].map((i) => (
          <div
            key={i}
            aria-disabled="true"
            className="flex min-h-[160px] cursor-not-allowed flex-col justify-between rounded-2xl border border-dashed p-6 opacity-50 select-none"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Plus className="h-7 w-7" />
            </span>
            <div>
              <div className="text-lg font-semibold text-muted-foreground">Sonra eklenecek</div>
              <div className="text-sm text-muted-foreground">Bu modül ilerleyen aşamada açılacak</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
