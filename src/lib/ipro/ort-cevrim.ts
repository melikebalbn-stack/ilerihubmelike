/**
 * Ortalama çevrim (birim süre) — MAS "ORT. BİRİM SÜRE" ile aynı tanım:
 *   net süre = iş süresi − iş penceresine düşen duruşlar (planlı + plansız)
 *   ort. çevrim = net süre / üretilen adet
 * SAF FONKSİYON (DB yok). Duruş aralıkları birleştirilir (çakışan iki kayıt iki kez düşülmez).
 */
export interface OrtCevrim {
  /** saniye/adet; adet 0 veya net süre 0 ise null */
  ortSn: number | null
  netSn: number
  durusSn: number
}

export function ortalamaCevrim(girdi: {
  baslangic: Date
  bitis: Date
  adet: number
  duruslar: { baslangic: Date; bitis: Date | null }[]
}): OrtCevrim {
  const bas = girdi.baslangic.getTime()
  const bit = girdi.bitis.getTime()
  const toplamSn = Math.max(0, (bit - bas) / 1000)

  const araliklar = girdi.duruslar
    .map((d) => [Math.max(bas, d.baslangic.getTime()), Math.min(bit, (d.bitis ?? girdi.bitis).getTime())] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])

  let durusMs = 0
  let curS = -1
  let curE = -1
  for (const [s, e] of araliklar) {
    if (s > curE) {
      if (curE > curS) durusMs += curE - curS
      curS = s
      curE = e
    } else if (e > curE) {
      curE = e
    }
  }
  if (curE > curS) durusMs += curE - curS

  const durusSn = durusMs / 1000
  const netSn = Math.max(0, toplamSn - durusSn)
  const ortSn = girdi.adet > 0 && netSn > 0 ? netSn / girdi.adet : null
  return { ortSn, netSn, durusSn }
}
