'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'

/**
 * Ortak okutma altyapısı (depo terminal ekranları). Görünmez, her zaman odakta
 * bir input tutar; barkod okuyucu karakterleri yazıp Enter gönderir → Enter'da
 * onScan(value) çağrılır ve buffer temizlenir. active=true iken odak korunur
 * (ekrana dokunulup blur olursa 50ms sonra geri gelir). stok-tasima ve toplama
 * ekranları bu hook'u paylaşır (davranış birebir aynı).
 */
export function useScanner(active: boolean, onScan: (v: string) => void) {
  const ref = useRef<HTMLInputElement>(null)
  const [buf, setBuf] = useState('')

  useEffect(() => {
    if (active) ref.current?.focus()
  }, [active])

  const inputProps = {
    ref,
    value: buf,
    onChange: (e: ChangeEvent<HTMLInputElement>) => setBuf(e.target.value),
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const v = buf
        setBuf('')
        onScan(v)
      }
    },
    onBlur: () => {
      if (active) setTimeout(() => ref.current?.focus(), 50)
    },
    autoFocus: true,
    'aria-hidden': true,
    inputMode: 'none' as const,
    className: 'pointer-events-none absolute left-0 top-0 h-0 w-0 opacity-0',
  }

  return { inputProps }
}
