"use client"

import { useEffect, useRef } from "react"
import { Loader2, Send } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

/**
 * Mesaj giriş formu. FOCUS FIX: gönderim sırasında Input `disabled` olunca
 * tarayıcı focus'u düşürüyordu (Enter'dan sonra tekrar tıklamak gerekiyordu).
 * `gonderiliyor` false'a döndüğünde (input tekrar enable) requestAnimationFrame
 * ile focus geri verilir. Tek satır Input → Shift+Enter yeni satır davranışı yok.
 */
export function MesajGirisiFormu({
  value,
  onChange,
  onGonder,
  gonderiliyor,
}: {
  value: string
  onChange: (v: string) => void
  onGonder: () => void
  gonderiliyor: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!gonderiliyor) requestAnimationFrame(() => ref.current?.focus())
  }, [gonderiliyor])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onGonder()
      }}
      className="flex gap-2"
    >
      <Input
        ref={ref}
        placeholder="Mesajinizi yazin..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={gonderiliyor}
        autoFocus
      />
      <Button type="submit" disabled={!value.trim() || gonderiliyor}>
        {gonderiliyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </form>
  )
}
