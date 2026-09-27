// OEE eşik halkası — İzleme'deki Halka deseniyle aynı SVG; eşik renkleri /ipro/analiz mockup'ından
// (≥%85 yeşil, ≥%60 kehribar, <%60 kırmızı). Presentational; hem kart hem tablo hücresinde kullanılır.
export function esikRenk(oran: number | null): string {
  if (oran == null) return '#94a3b8'
  if (oran >= 0.85) return '#15803d'
  if (oran >= 0.6) return '#b45309'
  return '#b91c1c'
}

export function yuzdeMetin(oran: number | null): string {
  if (oran == null) return '—'
  return '%' + (oran * 100).toFixed(1).replace('.', ',')
}

export function OeeHalka({ deger, boyut = 66, kalinlik = 7, etiket }: { deger: number | null; boyut?: number; kalinlik?: number; etiket?: string }) {
  const r = (boyut - kalinlik) / 2
  const cevre = 2 * Math.PI * r
  const oran = deger == null ? 0 : Math.max(0, Math.min(1, deger))
  const renk = esikRenk(deger)
  return (
    <div className="relative flex aspect-square items-center justify-center" style={{ width: boyut }}>
      <svg viewBox={`0 0 ${boyut} ${boyut}`} className="h-full w-full -rotate-90">
        <circle cx={boyut / 2} cy={boyut / 2} r={r} fill="none" stroke="#e6e9ee" strokeWidth={kalinlik} />
        <circle
          cx={boyut / 2}
          cy={boyut / 2}
          r={r}
          fill="none"
          stroke={renk}
          strokeWidth={kalinlik}
          strokeLinecap="round"
          strokeDasharray={cevre}
          strokeDashoffset={cevre * (1 - oran)}
        />
      </svg>
      {etiket ? (
        <span className="absolute text-[9px] font-semibold text-slate-400">{etiket}</span>
      ) : null}
    </div>
  )
}
