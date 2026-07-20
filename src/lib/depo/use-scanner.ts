'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FocusEvent, KeyboardEvent } from 'react'

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
    onBlur: (e: FocusEvent<HTMLInputElement>) => {
      if (!active) return
      // Odak GERÇEK bir form alanına geçtiyse geri çalma: kullanıcı klavyeyle
      // yazıyor demektir (ör. toplama arama kutusu). Aksi halde geri-odaklama
      // gizli scanner'ı tekrar aktif eder ve tuş vuruşlarını çalardı. relatedTarget
      // null (boşluğa/karta dokunma, bazı dokunmatik durumlar) ise eski davranış korunur.
      const next = e.relatedTarget as HTMLElement | null
      if (next?.matches('input, textarea, select, [contenteditable="true"]')) return
      setTimeout(() => ref.current?.focus(), 50)
    },
    autoFocus: true,
    'aria-hidden': true,
    inputMode: 'none' as const,
    className: 'pointer-events-none absolute left-0 top-0 h-0 w-0 opacity-0',
  }

  return { inputProps }
}
