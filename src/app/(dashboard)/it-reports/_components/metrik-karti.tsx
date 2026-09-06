"use client"

/**
 * KPI metrik kartı — boş-veri kuralının TEK uygulandığı yer.
 *
 * KURAL: örneklem n < YETERLI_ORNEKLEM ise sayı GÖSTERİLMEZ; yerine
 * "n kayıt — henüz yeterli veri yok" yazar. n yeterliyse değer + örneklem
 * gösterilir ("%57 · 7 talepten").
 *
 * Neden tek bileşen: eşik ya da metin değişirse tek dosya değişsin. API zaten
 * ham gerçeği ({value, n}) döndürüyor; gizleme kararı yalnız burada.
 *
 * Neden gizliyoruz: tek puandan üretilmiş "ortalama memnuniyet 1,0" gibi bir
 * rakam ekranda kişi hakkında yargıya dönüşür. Sayıyı saklamak veriyi
 * saklamak değil — örneklem yazılı olarak duruyor.
 */

import { Card, CardContent } from "@/components/ui/card"
import { YETERLI_ORNEKLEM, type Olcum } from "@/lib/tickets/kpi"

export interface MetrikKartiProps {
  baslik: string
  olcum: Olcum
  /** Değeri biçimlendirir (yüzde işareti, saat, puan…). */
  bicimle?: (v: number) => string
  /** Örneklem cümlesi: n yeterliyken değerin altında görünür. */
  ornekEki?: (n: number) => string
  /** Yetersiz veri metninde geçen birim: "kayıt", "puan", "talep". */
  birim?: string
  /** Kalıcı açıklama — veri durumundan bağımsız, hep görünür. */
  dipnot?: string
  /** Değeri renklendir (iyi/kötü). Yalnız yeterli veri varken uygulanır. */
  vurgu?: "iyi" | "kotu"
}

export function yeterliVeri(olcum: Olcum): boolean {
  return olcum.n >= YETERLI_ORNEKLEM && olcum.value !== null
}

export function MetrikKarti({
  baslik,
  olcum,
  bicimle = (v) => String(v),
  ornekEki,
  birim = "kayıt",
  dipnot,
  vurgu,
}: MetrikKartiProps) {
  const yeterli = yeterliVeri(olcum)

  const vurguSinifi =
    !yeterli || !vurgu
      ? ""
      : vurgu === "iyi"
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400"

  return (
    <Card className={yeterli ? undefined : "bg-muted/40"}>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{baslik}</p>

        {yeterli ? (
          <>
            <p className={`text-2xl font-semibold mt-1.5 tabular-nums ${vurguSinifi}`}>
              {bicimle(olcum.value as number)}
            </p>
            {ornekEki && (
              <p className="text-[11px] text-muted-foreground mt-1">{ornekEki(olcum.n)}</p>
            )}
          </>
        ) : (
          <p className="text-sm font-medium text-muted-foreground mt-1.5">
            {olcum.n} {birim} — henüz yeterli veri yok
          </p>
        )}

        {dipnot && (
          <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-dashed">
            {dipnot}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
