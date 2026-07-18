'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowDownUp,
  Check,
  ClipboardList,
  Info,
  ScanLine,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { OperatorBadge, TERMINAL_ACCENT } from '../../_shared'

interface Props {
  operatorName: string
}

interface Adim {
  n: string
  baslik: string
  aciklama: string
}

// ── İçerik (statik) ─────────────────────────────────────────────────────
const STOK_TASIMA_ADIMLARI: Adim[] = [
  {
    n: '1',
    baslik: 'Kaynak rafı okutun',
    aciklama:
      'Terminalin tarayıcısı ile taşınacak malzemenin bulunduğu raf barkodunu okutun.',
  },
  {
    n: '2',
    baslik: 'Malzemeyi hedef rafa taşıyın',
    aciklama:
      'Malzemeyi fiziksel olarak taşıyın ve hedef raf barkodunu okutarak konumu doğrulayın.',
  },
  {
    n: '3',
    baslik: 'Yeni etiketi yazdırın',
    aciklama:
      'Sistem taşımayı kaydeder; gerekiyorsa yeni konum etiketini yazdırıp yapıştırın.',
  },
]

const TOPLAMA_ADIMLARI: Adim[] = [
  {
    n: '1',
    baslik: 'İş emri barkodunu okutun',
    aciklama: 'Toplama listesini açmak için iş emri belgesindeki barkodu okutun.',
  },
  {
    n: '2',
    baslik: 'FIFO sırasına göre toplayın',
    aciklama:
      'Sistem, ilk giren ilk çıkar kuralına göre toplanacak rafı ve partiyi önerir.',
  },
  {
    n: '3',
    baslik: 'Miktarı onaylayın',
    aciklama:
      'Toplanan miktarı girin ve onaylayın. Liste tamamlanınca iş emri kapanır.',
  },
]

const TOPLAM_EKRAN = 5

export function DepoYardimClient({ operatorName }: Props) {
  const [ekran, setEkran] = useState(0)

  const sonEkran = ekran === TOPLAM_EKRAN - 1
  const ileri = () => setEkran((e) => (e + 1) % TOPLAM_EKRAN)
  const geri = () => setEkran((e) => Math.max(0, e - 1))

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
        {ekran === 0 && <Hosgeldiniz />}
        {ekran === 1 && <GenelBakis />}
        {ekran === 2 && (
          <AdimlarEkrani
            sira="1"
            modul="Stok Taşıma"
            adimlar={STOK_TASIMA_ADIMLARI}
            ipucu='Yanlış raf okutulursa sistem sizi uyarır. İşlemi istediğiniz an "Geri" ile iptal edebilirsiniz.'
          />
        )}
        {ekran === 3 && (
          <AdimlarEkrani
            sira="2"
            modul="Malzeme Toplama"
            adimlar={TOPLAMA_ADIMLARI}
            ipucu="Önerilen parti yerine farklı parti toplanması yetki gerektirir ve kayıt altına alınır."
          />
        )}
        {ekran === 4 && <Bitis />}
      </div>

      {/* Alt gezinme — nokta göstergesi + Geri/İleri */}
      <div className="flex flex-col gap-3 pb-2">
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: TOPLAM_EKRAN }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === ekran ? 'w-5' : 'w-1.5 bg-muted-foreground/30',
              )}
              style={i === ekran ? { background: TERMINAL_ACCENT } : undefined}
            />
          ))}
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

function Hosgeldiniz() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-2 text-center">
      <span
        className="flex h-20 w-20 items-center justify-center rounded-2xl text-white"
        style={{ background: TERMINAL_ACCENT }}
      >
        <ScanLine className="h-10 w-10" />
      </span>
      <h2 className="text-2xl font-bold leading-tight">
        ILERIHub El Terminali&apos;ne Hoş Geldiniz
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Bu kısa tanıtım, depo operasyonlarınızı el terminali üzerinden nasıl yürüteceğinizi
        adım adım gösterir.
      </p>
    </div>
  )
}

function GenelBakis() {
  const moduller: { label: string; alt: string; Icon: LucideIcon }[] = [
    { label: 'Stok Taşıma', alt: 'Raf okut, taşı, etiketle', Icon: ArrowDownUp },
    { label: 'Malzeme Toplama', alt: 'İş emri okut, FIFO ile topla', Icon: ClipboardList },
  ]
  return (
    <div className="flex flex-col gap-3 pt-1">
      <h2 className="text-xl font-bold">Modüle Genel Bakış</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        El Terminali modülü iki temel işlevden oluşur. Ana ekrandan ilgili karta dokunarak
        işleme başlayabilirsiniz.
      </p>
      <div className="mt-1 flex flex-col gap-3">
        {moduller.map(({ label, alt, Icon }) => (
          <div
            key={label}
            className="flex min-h-20 items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm"
            style={{ borderColor: TERMINAL_ACCENT }}
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: TERMINAL_ACCENT }}
            >
              <Icon className="h-6 w-6" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-lg font-semibold">{label}</span>
              <span className="text-xs text-muted-foreground">{alt}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AdimlarEkrani({
  sira,
  modul,
  adimlar,
  ipucu,
}: {
  sira: string
  modul: string
  adimlar: Adim[]
  ipucu: string
}) {
  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
          style={{ background: TERMINAL_ACCENT }}
        >
          {sira}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Nasıl kullanılır
          </span>
          <span className="text-lg font-bold">{modul}</span>
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {adimlar.map((a) => (
          <div key={a.n} className="flex gap-3 rounded-xl border bg-card p-3.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold"
              style={{ color: TERMINAL_ACCENT }}
            >
              {a.n}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-sm font-semibold">{a.baslik}</span>
              <span className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {a.aciklama}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-muted px-3.5 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TERMINAL_ACCENT }} />
        <p className="text-xs leading-relaxed text-muted-foreground">{ipucu}</p>
      </div>
    </div>
  )
}

function Bitis() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-2 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50">
        <Check className="h-10 w-10 text-emerald-700" />
      </span>
      <h2 className="text-2xl font-bold leading-tight">Hazırsınız!</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Tanıtımı tamamladınız. Bu rehbere dilediğiniz zaman depo ana ekranındaki{' '}
        <span className="font-medium text-foreground">Nasıl kullanılır?</span> bağlantısından
        yeniden ulaşabilirsiniz.
      </p>
    </div>
  )
}
