'use client'

// Büyük dokunmatik numpad — ekran klavyesi güvenilmez (eldivenli operatör).
// value string tutulur (baştaki 0 temizlenir); onChange sayı-string döndürür.
export function Numpad({
  value,
  onChange,
  max = 99999,
}: {
  value: string
  onChange: (v: string) => void
  max?: number
}) {
  function bas(d: string) {
    const next = value === '0' ? d : value + d
    if (Number(next) > max) return
    onChange(next)
  }
  function sil() {
    onChange(value.length <= 1 ? '0' : value.slice(0, -1))
  }
  function temizle() {
    onChange('0')
  }

  const tuslar = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  const btn =
    'h-20 rounded-xl bg-slate-800 text-3xl font-bold text-slate-100 active:bg-slate-700 transition-colors'

  return (
    <div className="grid grid-cols-3 gap-3">
      {tuslar.map((t) => (
        <button key={t} type="button" className={btn} onClick={() => bas(t)}>
          {t}
        </button>
      ))}
      <button type="button" className={`${btn} text-amber-400 text-xl`} onClick={temizle}>
        C
      </button>
      <button type="button" className={btn} onClick={() => bas('0')}>
        0
      </button>
      <button type="button" className={`${btn} text-xl`} onClick={sil}>
        ⌫
      </button>
    </div>
  )
}
