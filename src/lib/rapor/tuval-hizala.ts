/**
 * Tuval — çoklu seçim işlemleri (hizala / dağıt / aynı boyut / yön ölçekleme). SAF fonksiyonlar:
 * tasarımcı ekranı bunları çağırır, test bunları doğrular (DOM gerekmez).
 */
import { tuvalGenislik, type TuvalOge, type TuvalSayfa } from './tipler'

export type HizaIsi = 'sol' | 'yatayOrta' | 'sag' | 'ust' | 'dikeyOrta' | 'alt' | 'yatayDagit' | 'dikeyDagit' | 'ayniGenislik' | 'ayniYukseklik'

const izgara = (v: number) => Math.round(v / 2) * 2

/**
 * Seçili öğeleri sınır kutusuna göre hizalar/dağıtır. Referans (aynı genişlik/yükseklik) seçimin
 * İLK öğesidir. Sıra korunur; seçili olmayanlar dokunulmaz.
 */
export function hizala(ogeler: TuvalOge[], secimler: string[], is: HizaIsi, genislik: number): TuvalOge[] {
  const secili = secimler.map((id) => ogeler.find((e) => e.id === id)).filter(Boolean) as TuvalOge[]
  if (secili.length < 2) return ogeler
  const sol = Math.min(...secili.map((e) => e.x))
  const sag = Math.max(...secili.map((e) => e.x + e.w))
  const ust = Math.min(...secili.map((e) => e.y))
  const alt = Math.max(...secili.map((e) => e.y + e.h))
  const referans = secili[0]

  if (is === 'yatayDagit' || is === 'dikeyDagit') {
    if (secili.length < 3) return ogeler
    const yatay = is === 'yatayDagit'
    const sirali = [...secili].sort((a, b) => (yatay ? a.x - b.x : a.y - b.y))
    const toplamBoy = sirali.reduce((t, e) => t + (yatay ? e.w : e.h), 0)
    const aralik = ((yatay ? sag - sol : alt - ust) - toplamBoy) / (sirali.length - 1)
    let imlec = yatay ? sol : ust
    const konum = new Map<string, number>()
    for (const e of sirali) { konum.set(e.id, izgara(imlec)); imlec += (yatay ? e.w : e.h) + aralik }
    return ogeler.map((e) => (konum.has(e.id) ? ({ ...e, [yatay ? 'x' : 'y']: konum.get(e.id)! } as TuvalOge) : e))
  }

  return ogeler.map((e) => {
    if (!secimler.includes(e.id)) return e
    const d: Partial<TuvalOge> =
      is === 'sol' ? { x: sol }
        : is === 'yatayOrta' ? { x: izgara((sol + sag) / 2 - e.w / 2) }
          : is === 'sag' ? { x: sag - e.w }
            : is === 'ust' ? { y: ust }
              : is === 'dikeyOrta' ? { y: izgara((ust + alt) / 2 - e.h / 2) }
                : is === 'alt' ? { y: alt - e.h }
                  : is === 'ayniGenislik' ? { w: referans.w }
                    : { h: referans.h }
    const yeni = { ...e, ...d } as TuvalOge
    return { ...yeni, x: Math.max(0, Math.min(genislik - yeni.w, yeni.x)), y: Math.max(0, yeni.y) }
  })
}

/**
 * Sayfa yönü değişince tuval genişliği değişir (dikey ≈640px, yatay ≈950px). Öğelerin x/w'si
 * yeni genişliğe ORANTILI ölçeklenir — sağdakiler sayfa dışına taşmaz, yerleşim korunur.
 */
export function yonDegistir(tasarim: { sayfa: TuvalSayfa; ogeler: TuvalOge[] }, yeniYon: 'dikey' | 'yatay'): { sayfa: TuvalSayfa; ogeler: TuvalOge[]; eski: number; yeni: number } {
  const eski = tuvalGenislik(tasarim.sayfa)
  const sayfa: TuvalSayfa = { ...tasarim.sayfa, yon: yeniYon }
  const yeni = tuvalGenislik(sayfa)
  const k = yeni / eski
  return { sayfa, eski, yeni, ogeler: tasarim.ogeler.map((e) => ({ ...e, x: izgara(e.x * k), w: Math.max(8, izgara(e.w * k)) })) }
}
