'use client'

/**
 * QRCodeDisplay — Tıklanabilir/statik QR kod render component'i.
 *
 * - `qrcode` lib (Node + browser destekli) DataURL üretir
 * - useEffect içinde async — SSR-safe (initial render skeleton)
 * - onClick verilirse <button>, yoksa <div> render edilir
 */

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

type Props = {
  value: string
  size?: number
  className?: string
  onClick?: () => void
}

export function QRCodeDisplay({
  value,
  size = 200,
  className,
  onClick,
}: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch((err) => {
        if (!cancelled) setError(String(err))
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (error) {
    return (
      <div className={className} style={{ width: size, height: size }}>
        <div className="w-full h-full bg-rose-50 border border-rose-200 flex items-center justify-center text-xs text-rose-600">
          QR oluşturulamadı
        </div>
      </div>
    )
  }

  if (!dataUrl) {
    return (
      <div className={className} style={{ width: size, height: size }}>
        <div className="w-full h-full bg-slate-100 animate-pulse" />
      </div>
    )
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        style={{ width: size, height: size }}
        title="Etiket basma sayfasını aç"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt={`QR: ${value}`}
          width={size}
          height={size}
          className="block"
        />
      </button>
    )
  }

  return (
    <div className={className} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`QR: ${value}`}
        width={size}
        height={size}
        className="block"
      />
    </div>
  )
}
