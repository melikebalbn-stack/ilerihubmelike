"use client"

import { useState } from "react"
import { Star, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { PUAN_MAX, PUANLAMA_PENCERESI_GUN } from "@/lib/tickets/memnuniyet"

/**
 * IT Destek — kapanış sonrası memnuniyet puanlaması.
 *
 * GÖRÜNÜRLÜK kararı burada VERİLMEZ; çağıran taraf `puanlayabilirMi` ile karar
 * verir (tek kaynak: @/lib/tickets/memnuniyet). Bu bileşen yalnız çizer.
 * Sunucu aynı kuralları PUT'ta tekrar uygular — UI'ya güvenilmez.
 */

export function MemnuniyetSonucu({
  puan,
  yorum,
}: {
  puan: number
  yorum: string | null
}) {
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Değerlendirmeniz:</span>
        <span className="flex items-center gap-0.5">
          {Array.from({ length: PUAN_MAX }, (_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${i < puan ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
            />
          ))}
        </span>
        <span className="text-sm font-medium">{puan}/{PUAN_MAX}</span>
      </div>
      {yorum && <p className="mt-1 text-sm text-muted-foreground">&ldquo;{yorum}&rdquo;</p>}
    </div>
  )
}

export function MemnuniyetKarti({
  kalanGun,
  gonderiliyor,
  onGonder,
}: {
  kalanGun: number | null
  gonderiliyor: boolean
  onGonder: (puan: number, yorum: string) => Promise<void>
}) {
  const [puan, setPuan] = useState(0)
  const [uzerinde, setUzerinde] = useState(0)
  const [yorum, setYorum] = useState("")

  const gosterilen = uzerinde || puan

  return (
    <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-4 dark:bg-emerald-950/40">
      <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
        Bu talep çözüldü. Aldığınız hizmeti değerlendirir misiniz?
      </h3>

      <div className="mt-3 flex items-center gap-1">
        {Array.from({ length: PUAN_MAX }, (_, i) => {
          const deger = i + 1
          return (
            <button
              key={deger}
              type="button"
              aria-label={`${deger} yıldız`}
              className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              onMouseEnter={() => setUzerinde(deger)}
              onMouseLeave={() => setUzerinde(0)}
              onFocus={() => setUzerinde(deger)}
              onBlur={() => setUzerinde(0)}
              onClick={() => setPuan(deger)}
              disabled={gonderiliyor}
            >
              <Star
                className={`h-7 w-7 ${
                  deger <= gosterilen
                    ? "fill-amber-400 text-amber-400"
                    : "text-emerald-700/30 dark:text-emerald-300/30"
                }`}
              />
            </button>
          )
        })}
        {puan > 0 && (
          <span className="ml-2 text-sm text-emerald-800 dark:text-emerald-200">
            {puan}/{PUAN_MAX}
          </span>
        )}
      </div>

      <Input
        value={yorum}
        onChange={(e) => setYorum(e.target.value)}
        placeholder="Eklemek istediğiniz bir şey var mı? (isteğe bağlı)"
        maxLength={500}
        disabled={gonderiliyor}
        className="mt-3 bg-white dark:bg-background"
      />

      <div className="mt-3 flex items-center gap-3">
        <Button
          size="sm"
          disabled={puan === 0 || gonderiliyor}
          onClick={async () => {
            if (puan === 0) {
              toast.error("Lütfen bir puan seçin")
              return
            }
            await onGonder(puan, yorum.trim())
          }}
        >
          {gonderiliyor && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Gönder
        </Button>
        <span className="text-xs text-emerald-800/70 dark:text-emerald-200/70">
          {kalanGun !== null
            ? `Değerlendirme için ${kalanGun} gününüz var.`
            : `Değerlendirme ${PUANLAMA_PENCERESI_GUN} gün açık kalır.`}
        </span>
      </div>
    </div>
  )
}
