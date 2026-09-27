'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, LifeBuoy, ScanLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { OperatorBadge, TERMINAL_ACCENT } from '../../_shared'
import { MODULLER, type ModulYardim } from '../_yardim-icerik'
import { YardimGovde } from '../_yardim-govde'

interface Props {
  operatorName: string
}

const KURALLAR = [
  'Önce okut, sonra miktar gir.',
  'Ekranda yeşil tik gördüysen işlem tamam.',
  'Kırmızı uyarı çıkarsa işlemi tekrarlama, ekrandaki yazıyı oku; çözemezsen şefine haber ver.',
]

const SORUNLAR = [
  '"Bulunamadı" çıkarsa etiketi tekrar okut; olmazsa elle gir.',
  '"Yetki yok" çıkarsa şefine haber ver.',
  'Bir işlemi yarıda bıraktıysan aynı ekrana dönüp devam edebilirsin.',
]

// Genel + Genel bakış + her modül bir sayfa + Sorun olursa (= 12).
const TOPLAM_EKRAN = 2 + MODULLER.length + 1

export function DepoYardimClient({ operatorName }: Props) {
  const [ekran, setEkran] = useState(0)

  const sonEkran = ekran === TOPLAM_EKRAN - 1
  const ileri = () => { setEkran((e) => Math.min(TOPLAM_EKRAN - 1, e + 1)); window.scrollTo(0, 0) }
  const geri = () => { setEkran((e) => Math.max(0, e - 1)); window.scrollTo(0, 0) }
  const git = (i: number) => { setEkran(i); window.scrollTo(0, 0) }
  const modul = ekran >= 2 && ekran < 2 + MODULLER.length ? MODULLER[ekran - 2] : null

  return (
    <div className="flex min-h-screen flex-col gap-3 py-2">
      {/* Üst bar — depo sayfalarıyla aynı desen */}
      <div className="flex items-center gap-2 pt-1">
        <Link
          href="/terminal/depo"
          aria-label="Depo menüsüne dön"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-base font-semibold leading-tight">Depo El Terminali</h1>
        <OperatorBadge name={operatorName} />
      </div>

      {/* İçerik */}
      <div className="flex flex-1 flex-col">
        {ekran === 0 && <Genel />}
        {ekran === 1 && <GenelBakis onSec={(i) => git(2 + i)} />}
        {modul && <ModulEkrani modul={modul} />}
        {sonEkran && <SorunOlursa />}
      </div>

      {/* Alt gezinme — nokta göstergesi (12 sayfa) + sayfa no + Geri/İleri */}
      <div className="flex flex-col gap-3 pb-2">
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: TOPLAM_EKRAN }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === ekran ? 'w-4' : 'w-1.5 bg-muted-foreground/30',
                )}
                style={i === ekran ? { background: TERMINAL_ACCENT } : undefined}
              />
            ))}
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {ekran + 1}/{TOPLAM_EKRAN}
          </span>
        </div>
        <div className="flex gap-2">
          {ekran > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={geri}
              className="min-h-12 rounded-xl px-6 text-base"
            >
              Geri
            </Button>
          )}
          {sonEkran ? (
            <Link
              href="/terminal/depo"
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl text-base font-semibold text-white active:translate-y-px"
              style={{ background: TERMINAL_ACCENT }}
            >
              Başla
            </Link>
          ) : (
            <Button
              type="button"
              onClick={ileri}
              className="min-h-12 flex-1 rounded-xl text-base font-semibold text-white hover:opacity-90"
              style={{ background: TERMINAL_ACCENT }}
            >
              İleri
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Ekranlar ────────────────────────────────────────────────────────────

function Genel() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-2 text-center">
      <span
        className="flex h-20 w-20 items-center justify-center rounded-2xl text-white"
        style={{ background: TERMINAL_ACCENT }}
      >
        <ScanLine className="h-10 w-10" />
      </span>
      <h2 className="text-2xl font-bold leading-tight">El Terminali Ne İşe Yarar?</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Depodaki her hareketi bu cihazla yaparsın. Okuttuğun her şey anında sisteme (IFS)
        işlenir; kâğıda yazmana gerek kalmaz.
      </p>
      <div className="flex w-full flex-col gap-2 text-left">
        {KURALLAR.map((k, i) => (
          <div key={i} className="flex gap-3 rounded-xl border bg-card p-3.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold"
              style={{ color: TERMINAL_ACCENT }}
            >
              {i + 1}
            </span>
            <span className="text-sm font-medium leading-snug">{k}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GenelBakis({ onSec }: { onSec: (i: number) => void }) {
  return (
    <div className="flex flex-col gap-3 pt-1">
      <h2 className="text-xl font-bold">Modüllere Genel Bakış</h2>
      <div className="flex flex-col gap-2">
        {MODULLER.map(({ label, kisa, Icon }, i) => (
          <button
            key={label}
            type="button"
            onClick={() => onSec(i)}
            className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3 text-left shadow-sm active:translate-y-px active:shadow-none"
            style={{ borderColor: TERMINAL_ACCENT }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: TERMINAL_ACCENT }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-base font-semibold" style={{ color: TERMINAL_ACCENT }}>{label}</span>
              <span className="text-xs text-muted-foreground">{kisa}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ModulEkrani({ modul }: { modul: ModulYardim }) {
  const { Icon } = modul
  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: TERMINAL_ACCENT }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Nasıl kullanılır
          </span>
          <span className="text-lg font-bold">{modul.baslik}</span>
        </span>
      </div>

      <YardimGovde modul={modul} />
    </div>
  )
}

function SorunOlursa() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-2 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50">
        <LifeBuoy className="h-10 w-10 text-emerald-700" />
      </span>
      <h2 className="text-2xl font-bold leading-tight">Sorun olursa</h2>
      <div className="flex w-full flex-col gap-2 text-left">
        {SORUNLAR.map((s, i) => (
          <div key={i} className="flex gap-3 rounded-xl border bg-card p-3.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TERMINAL_ACCENT }} />
            <span className="text-sm leading-snug">{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
