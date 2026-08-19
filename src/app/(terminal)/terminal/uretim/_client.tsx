'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, Building2, Home, Search } from 'lucide-react'
import { OperatorBadge, TERMINAL_ACCENT } from '../_shared'

interface Departman {
  /** DepartmentNo — bölüm kodu (WLZ, …). */
  kod: string
  /** Description — bölüm adı (LAZER KESİM, …). */
  ad: string
}

interface Props {
  operatorName: string
  /** IFS bölümleri (kod + ad). Filtrelenmeden 10 kayıt. */
  departmanlar: Departman[]
  /** URL ?dept — seçili bölüm kodu; yoksa seçim ekranı gösterilir. */
  seciliDept: string | null
  /** Seçili bölümün adı (varsa). */
  seciliDeptAd: string
  ifsError: string | null
}

const trLower = (s: string) => s.toLocaleLowerCase('tr')

export function TerminalMenuClient({
  operatorName,
  departmanlar,
  seciliDept,
  seciliDeptAd,
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

      {seciliDept ? (
        <BolumSecildi seciliDept={seciliDept} seciliDeptAd={seciliDeptAd} operatorName={operatorName} />
      ) : (
        <BolumSecim operatorName={operatorName} departmanlar={departmanlar} ifsError={ifsError} />
      )}
    </div>
  )
}

// ── Bölüm seçim ekranı (?dept yokken) ─────────────────────────────────────────
function BolumSecim({
  operatorName,
  departmanlar,
  ifsError,
}: {
  operatorName: string
  departmanlar: Departman[]
  ifsError: string | null
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const query = trLower(q.trim())
    if (!query) return departmanlar
    return departmanlar.filter(
      (d) => trLower(d.kod).includes(query) || trLower(d.ad).includes(query),
    )
  }, [q, departmanlar])

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col leading-tight">
          <span className="text-base font-semibold">Bölüm seçin</span>
          <span className="text-xs text-muted-foreground">Bakım atölyesi bölümleri</span>
        </div>
        <OperatorBadge name={operatorName} />
      </div>

      {ifsError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-6 text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-5 w-5" />
            Bölümler IFS&apos;ten alınamadı
          </div>
          <p className="max-w-full break-all text-sm text-red-700/90">{ifsError}</p>
        </div>
      ) : departmanlar.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Bölüm bulunamadı.
        </div>
      ) : (
        <>
          {/* Arama — kod veya ad (dokunmatik: büyük input) */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Bölüm ara — kod veya ad"
              aria-label="Bölüm ara"
              className="h-12 min-h-12 w-full rounded-xl border bg-background pl-11 pr-4 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              &quot;{q}&quot; ile eşleşen bölüm yok.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((d) => (
                <Link
                  key={d.kod}
                  href={`/terminal/uretim?dept=${encodeURIComponent(d.kod)}`}
                  className="group flex min-h-[120px] flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-white transition-transform group-active:scale-95"
                    style={{ background: TERMINAL_ACCENT }}
                  >
                    <Building2 className="h-6 w-6" />
                  </span>
                  <div>
                    <div
                      className="line-clamp-2 text-lg font-semibold leading-tight"
                      style={{ color: TERMINAL_ACCENT }}
                    >
                      {d.ad || d.kod}
                    </div>
                    <div className="text-sm text-muted-foreground">{d.kod}</div>
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

// ── Bölüm seçildi — yer tutucu (alt akış: tezgah/iş emri ayrı iş) ─────────────
function BolumSecildi({
  seciliDept,
  seciliDeptAd,
  operatorName,
}: {
  seciliDept: string
  seciliDeptAd: string
  operatorName: string
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: TERMINAL_ACCENT }}
          >
            <Building2 className="h-5 w-5" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold">{seciliDeptAd || seciliDept}</span>
            <span className="text-xs text-muted-foreground">{seciliDept}</span>
          </div>
        </div>
        <OperatorBadge name={operatorName} />
      </div>

      <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed p-8">
        <p className="text-sm text-muted-foreground">
          Bu bölümün tezgah ve iş emri listesi bir sonraki adımda eklenecek.
        </p>
        <Link
          href="/terminal/uretim"
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors hover:bg-muted active:bg-muted/70"
        >
          <ArrowLeft className="h-5 w-5" />
          Bölüm değiştir
        </Link>
      </div>
    </>
  )
}
