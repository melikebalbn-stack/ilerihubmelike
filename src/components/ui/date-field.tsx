'use client'

// Tek yeniden kullanılabilir tarih alanı — maskeli metin girişi + yıl/ay açılır listeli takvim.
//
// NEDEN: repodaki tarih girişi native `<input type="date">` idi. Doğum tarihi gibi uzak
// tarihlerde tarayıcının takvimi aydan aya tıklatıyor; yıl seçimi yok. Bu bileşen yıl ve ayı
// AÇILIR LİSTEDEN seçtirir (tek tek ileri/geri tıklama yok) ve elle GG.AA.YYYY yazmaya izin verir.
//
// SÖZLEŞME FormDateInput ile AYNI: dışarı ISO `YYYY-MM-DD` (veya boş string) çıkar.
// Yeni bağımlılık YOK — mevcut @radix-ui/react-popover + date-fns kullanılır.

import { useEffect, useMemo, useState } from 'react'
import { addDays, format, isValid, parse, startOfMonth, startOfWeek } from 'date-fns'
import { tr } from 'date-fns/locale'
import { CalendarDays } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const ISO = 'yyyy-MM-dd'
const GOSTERIM = 'dd.MM.yyyy'

/** ISO (yyyy-MM-dd) → Date | null. Takvim-dışı değerler (31.02) reddedilir. */
export function isoToDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = parse(iso, ISO, new Date())
  if (!isValid(d)) return null
  // Round-trip: parse toleranslıdır, geri yazınca aynı değilse gerçek tarih değildir.
  return format(d, ISO) === iso ? d : null
}

/** Kullanıcı metni → ISO veya null. GG.AA.YYYY beklenir; yapıştırmada esnek. */
export function metinToIso(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  // Yapıştırma toleransı: ayraç ne olursa olsun rakamları al.
  const rakam = s.replace(/\D/g, '')
  let gun: string, ay: string, yil: string
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    // ISO yapıştırıldı
    ;[yil, ay, gun] = s.split('-')
  } else if (rakam.length === 8) {
    gun = rakam.slice(0, 2)
    ay = rakam.slice(2, 4)
    yil = rakam.slice(4, 8)
  } else {
    return null
  }
  const iso = `${yil}-${ay}-${gun}`
  return isoToDate(iso) ? iso : null
}

/** Yazarken maske: rakamları GG.AA.YYYY biçimine sokar. */
function maskele(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`
}

interface Props {
  /** ISO yyyy-MM-dd veya boş string. */
  value: string
  /** ISO yyyy-MM-dd veya boş string döner. */
  onChange: (value: string) => void
  disabled?: boolean
  /** ISO alt sınır. */
  min?: string
  /** ISO üst sınır. */
  max?: string
  /** Değer yokken takvimin açılacağı yıl (ör. doğum tarihi için bugünden uzak bir yıl). */
  acilisYili?: number
  id?: string
  className?: string
}

export function DateField({
  value,
  onChange,
  disabled,
  min,
  max,
  acilisYili,
  id,
  className,
}: Props) {
  const secili = isoToDate(value)
  const [metin, setMetin] = useState(secili ? format(secili, GOSTERIM) : '')
  const [hata, setHata] = useState<string | null>(null)
  const [acik, setAcik] = useState(false)

  // Dışarıdan değer değişirse (reset, prefill) metni senkronla.
  useEffect(() => {
    const d = isoToDate(value)
    setMetin(d ? format(d, GOSTERIM) : '')
    setHata(null)
  }, [value])

  const minD = isoToDate(min)
  const maxD = isoToDate(max)

  const bugun = useMemo(() => new Date(), [])
  const minYil = minD ? minD.getFullYear() : bugun.getFullYear() - 100
  const maxYil = maxD ? maxD.getFullYear() : bugun.getFullYear() + 10

  // Takvimin açılacağı ay: seçili değer → acilisYili → sınırlara sıkıştırılmış bugün.
  const varsayilanGoruntu = useMemo(() => {
    if (secili) return startOfMonth(secili)
    if (acilisYili) return new Date(acilisYili, 0, 1)
    if (maxD && maxD < bugun) return startOfMonth(maxD)
    if (minD && minD > bugun) return startOfMonth(minD)
    return startOfMonth(bugun)
  }, [secili, acilisYili, minD, maxD, bugun])

  const [goruntu, setGoruntu] = useState<Date>(varsayilanGoruntu)
  useEffect(() => {
    if (acik) setGoruntu(varsayilanGoruntu)
  }, [acik, varsayilanGoruntu])

  const yillar = useMemo(() => {
    const arr: number[] = []
    for (let y = maxYil; y >= minYil; y--) arr.push(y)
    return arr
  }, [minYil, maxYil])

  const aylar = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ no: i, ad: format(new Date(2000, i, 1), 'LLLL', { locale: tr }) })),
    []
  )

  const sinirDisi = (d: Date): boolean => !!(minD && d < minD) || !!(maxD && d > maxD)

  function metinDegisti(raw: string) {
    const m = maskele(raw)
    setMetin(m)
    if (!m) {
      setHata(null)
      onChange('')
      return
    }
    if (m.replace(/\D/g, '').length < 8) {
      // Yazmaya devam ediyor — SESSİZ, ama değer de üretme.
      setHata(null)
      return
    }
    const iso = metinToIso(m)
    if (!iso) {
      setHata('Geçersiz tarih. Biçim: GG.AA.YYYY')
      return
    }
    const d = isoToDate(iso)!
    if (sinirDisi(d)) {
      setHata('Tarih izin verilen aralığın dışında.')
      return
    }
    setHata(null)
    onChange(iso)
  }

  function metinBitti() {
    if (!metin) return
    if (metin.replace(/\D/g, '').length < 8) {
      setHata('Tarihi tam giriniz (GG.AA.YYYY).')
    }
  }

  function gunSec(d: Date) {
    if (sinirDisi(d)) return
    const iso = format(d, ISO)
    onChange(iso)
    setMetin(format(d, GOSTERIM))
    setHata(null)
    setAcik(false)
  }

  // Ay ızgarası — pazartesi başlangıçlı 6 hafta.
  const haftalar = useMemo(() => {
    const ilk = startOfWeek(startOfMonth(goruntu), { weekStartsOn: 1 })
    return Array.from({ length: 6 }, (_, h) => Array.from({ length: 7 }, (_, g) => addDays(ilk, h * 7 + g)))
  }, [goruntu])

  const gunBasliklari = useMemo(() => {
    const ilk = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => format(addDays(ilk, i), 'EEEEEE', { locale: tr }))
  }, [])

  return (
    <div className={className}>
      <div className="flex items-stretch gap-2">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="GG.AA.YYYY"
          value={metin}
          disabled={disabled}
          onChange={(e) => metinDegisti(e.target.value)}
          onBlur={metinBitti}
          className={cn(
            'w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:ring-0 disabled:bg-slate-100',
            hata ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-[#1B4F72]'
          )}
        />
        <Popover open={acik} onOpenChange={setAcik}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Takvimi aç"
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-slate-600 transition-colors hover:bg-slate-50 disabled:bg-slate-100"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3">
            {/* Yıl + ay AÇILIR LİSTE — tek tek ileri/geri tıklama yok. */}
            <div className="mb-2 flex gap-2">
              <select
                aria-label="Yıl"
                value={goruntu.getFullYear()}
                onChange={(e) => setGoruntu(new Date(Number(e.target.value), goruntu.getMonth(), 1))}
                className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              >
                {yillar.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                aria-label="Ay"
                value={goruntu.getMonth()}
                onChange={(e) => setGoruntu(new Date(goruntu.getFullYear(), Number(e.target.value), 1))}
                className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              >
                {aylar.map((a) => (
                  <option key={a.no} value={a.no}>{a.ad}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-slate-400">
              {gunBasliklari.map((g, i) => (
                <div key={i} className="py-1">{g}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {haftalar.flat().map((d, i) => {
                const buAy = d.getMonth() === goruntu.getMonth()
                const kapali = sinirDisi(d)
                const seciliMi = !!secili && format(d, ISO) === format(secili, ISO)
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={kapali}
                    onClick={() => gunSec(d)}
                    className={cn(
                      'h-8 w-8 rounded-md text-sm transition-colors',
                      !buAy && 'text-slate-300',
                      buAy && !seciliMi && !kapali && 'text-slate-700 hover:bg-slate-100',
                      seciliMi && 'bg-[#1B4F72] text-white',
                      kapali && 'cursor-not-allowed text-slate-200'
                    )}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {hata && <p className="mt-1 text-xs text-red-500">{hata}</p>}
    </div>
  )
}
