'use client'

/**
 * Rapor modülü ortak hata gösterimi: başlık (kalın) + açıklama + çözüm satırı,
 * ham metin "Ayrıntı" ile açılır kapanır (destek için lazım, önde durmasın).
 *
 * Renk: kırmızı = çalışmıyor (agirlik 'hata'), sarı = dikkat/düzeltilebilir ('uyari').
 */
import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, XCircle } from 'lucide-react'
import type { CevrilmisHata } from '@/lib/rapor/hata-cevir'

interface Props {
  hata: CevrilmisHata | null | undefined
  /** Doğrulama listesi gibi ek maddeler (şablon/veri seti kaydetme). */
  maddeler?: string[]
  className?: string
  /** Küçük alanlar (kaynak kartı içi) için sıkışık görünüm. */
  kucuk?: boolean
}

export default function HataKutusu({ hata, maddeler, className = '', kucuk = false }: Props) {
  const [acik, setAcik] = useState(false)
  if (!hata) return null
  const uyari = hata.agirlik === 'uyari'
  const renk = uyari
    ? 'border-amber-300 bg-amber-50 text-amber-900'
    : 'border-red-200 bg-red-50 text-red-800'
  const Ikon = uyari ? AlertTriangle : XCircle

  return (
    <div className={`rounded-md border ${renk} ${kucuk ? 'px-2.5 py-2 text-[11px]' : 'px-3 py-2.5 text-xs'} ${className}`} role="alert">
      <div className="flex items-start gap-2">
        <Ikon className={`${kucuk ? 'h-3.5 w-3.5' : 'h-4 w-4'} mt-0.5 shrink-0`} />
        <div className="min-w-0 flex-1">
          <p className="m-0 font-semibold">{hata.baslik}</p>
          <p className="m-0 mt-0.5 leading-relaxed">{hata.aciklama}</p>
          {hata.cozum && (
            <p className="m-0 mt-1.5 leading-relaxed">
              <span className="font-semibold">Ne yapmalı: </span>{hata.cozum}
            </p>
          )}
          {!!maddeler?.length && (
            <ul className="list-disc ml-4 mt-1.5 space-y-0.5">
              {maddeler.slice(0, 8).map((m, i) => <li key={i}>{m}</li>)}
              {maddeler.length > 8 && <li>… {maddeler.length - 8} madde daha</li>}
            </ul>
          )}
          {hata.teknikDetay && (
            <>
              <button
                type="button"
                onClick={() => setAcik((a) => !a)}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium opacity-80 hover:opacity-100 hover:underline"
                aria-expanded={acik}
              >
                {acik ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}Ayrıntı
              </button>
              {acik && (
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-white/70 p-2 font-mono text-[10.5px] leading-snug">
                  {hata.teknikDetay}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
