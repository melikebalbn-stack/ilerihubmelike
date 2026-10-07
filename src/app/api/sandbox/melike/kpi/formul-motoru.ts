// KPI-FORMUL: Gerçekleşen/Hedef/özel alan değerleri elle girmek yerine başka KPI'ların (farklı
// departmanlar dahil) değerlerinden otomatik hesaplanabilir. Bu dosya o hesaplamanın motoru —
// GÜVENLİ bir aritmetik ifade çözümleyici (eval/Function KULLANMAZ, sadece +,-,*,/,() ve
// önceden çözülmüş sayısal değişkenler) ve formülün referans verdiği KPI'ları toplayan yardımcı.

export interface FormulReferans {
  token: string
  kpiId: string
  // "actual" (Gerçekleşen) | "target" (Hedef) | bir KPIOzelAlan.key
  kaynak: string
}

export interface FormulTanimi {
  ifade: string
  referanslar: FormulReferans[]
}

export function formulGecerliMi(deger: unknown): deger is FormulTanimi {
  if (!deger || typeof deger !== 'object') return false
  const f = deger as Record<string, unknown>
  return typeof f.ifade === 'string' && Array.isArray(f.referanslar)
}

// Güvenli, küçük bir recursive-descent aritmetik çözümleyici: sayılar, önceden çözülmüş
// değişken token'ları (ör. "t1"), parantez, + - * /. eval/Function KULLANILMAZ.
export function formulDegerlendir(ifade: string, degerler: Record<string, number>): number | null {
  const s = ifade.replace(/\s+/g, '')
  if (!s) return null
  let pos = 0

  function sayiMi(c: string | undefined): c is string {
    return c != null && c >= '0' && c <= '9'
  }
  function tanimlayiciKarakteriMi(c: string | undefined): c is string {
    return c != null && /[a-zA-Z0-9_]/.test(c)
  }

  function parseExpr(): number {
    let deger = parseTerm()
    while (s[pos] === '+' || s[pos] === '-') {
      const op = s[pos]
      pos++
      const sag = parseTerm()
      deger = op === '+' ? deger + sag : deger - sag
    }
    return deger
  }
  function parseTerm(): number {
    let deger = parseFactor()
    while (s[pos] === '*' || s[pos] === '/') {
      const op = s[pos]
      pos++
      const sag = parseFactor()
      deger = op === '*' ? deger * sag : deger / sag
    }
    return deger
  }
  function parseFactor(): number {
    if (s[pos] === '-') { pos++; return -parseFactor() }
    if (s[pos] === '+') { pos++; return parseFactor() }
    if (s[pos] === '(') {
      pos++
      const deger = parseExpr()
      if (s[pos] !== ')') throw new Error('Kapanmamış parantez')
      pos++
      return deger
    }
    if (sayiMi(s[pos]) || (s[pos] === '.' && sayiMi(s[pos + 1]))) {
      const basla = pos
      while (sayiMi(s[pos]) || s[pos] === '.') pos++
      return Number(s.slice(basla, pos))
    }
    const basla = pos
    while (tanimlayiciKarakteriMi(s[pos])) pos++
    if (pos === basla) throw new Error(`Beklenmeyen karakter: ${s[pos] ?? '(son)'}`)
    const ad = s.slice(basla, pos)
    if (!(ad in degerler)) throw new Error(`Bilinmeyen değişken: ${ad}`)
    return degerler[ad]
  }

  try {
    const sonuc = parseExpr()
    if (pos !== s.length) return null
    return Number.isFinite(sonuc) ? sonuc : null
  } catch {
    return null
  }
}

interface KpiVeriKaynagi {
  id: string
  measurements: { year: number; month: number; target: number | null; actual: number | null }[]
  ozelAlanlar: { key: string; degerler: { year: number; month: number; value: number | null }[] }[]
}

// Bir formülün tek bir ay için değerini hesaplar — referans verilen KPI'lardan o ay/yıla ait
// değerleri toplayıp formulDegerlendir'e verir. Herhangi bir referans değeri eksikse null döner
// (hesaplanamaz, ortalamalara da katılmaz — tıpkı normal boş hücre gibi).
export function formulAyDegeriHesapla(
  formul: FormulTanimi,
  kpiHaritasi: Map<string, KpiVeriKaynagi>,
  year: number,
  month: number,
): number | null {
  const degerler: Record<string, number> = {}
  for (const ref of formul.referanslar) {
    const kpi = kpiHaritasi.get(ref.kpiId)
    if (!kpi) return null
    let deger: number | null = null
    if (ref.kaynak === 'actual') {
      deger = kpi.measurements.find(m => m.year === year && m.month === month)?.actual ?? null
    } else if (ref.kaynak === 'target') {
      deger = kpi.measurements.find(m => m.year === year && m.month === month)?.target ?? null
    } else {
      const alan = kpi.ozelAlanlar.find(a => a.key === ref.kaynak)
      deger = alan?.degerler.find(d => d.year === year && d.month === month)?.value ?? null
    }
    if (deger == null) return null
    degerler[ref.token] = deger
  }
  return formulDegerlendir(formul.ifade, degerler)
}

// Formülün referans verdiği KPI'ların (kendi departmanı dahil, HERHANGİ bir departmandan)
// ölçüm + özel alan verisini tek seferde çeker — N+1 sorgu yerine tek toplu sorgu.
// prisma parametresi gerçek PrismaClient'ın tipiyle (çok sayıda model/overload) birebir
// eşleşmesi gerekmeyen gevşek bir tip alıyor — çağıranlar hep gerçek `prisma` örneğini verir.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function formulReferansVerisiGetir(
  prisma: any,
  formuller: FormulTanimi[],
): Promise<Map<string, KpiVeriKaynagi>> {
  const kpiIdler = Array.from(new Set(formuller.flatMap(f => f.referanslar.map(r => r.kpiId))))
  if (kpiIdler.length === 0) return new Map()
  const kpilar = await prisma.kPIDefinition.findMany({
    where: { id: { in: kpiIdler } },
    select: {
      id: true,
      measurements: { select: { year: true, month: true, target: true, actual: true } },
      ozelAlanlar: { select: { key: true, degerler: { select: { year: true, month: true, value: true } } } },
    },
  })
  return new Map((kpilar as KpiVeriKaynagi[]).map(k => [k.id, k]))
}

// Hangi (yıl, ay) çiftleri için hesaplama yapılacağını belirler — formülün referans verdiği
// KPI'ların kendi ölçümlerinde/özel alan değerlerinde veri olan tüm yıl/ay'lar.
export function formulHesaplanacakDonemler(kpiHaritasi: Map<string, KpiVeriKaynagi>, formul: FormulTanimi): { year: number; month: number }[] {
  const donemler = new Set<string>()
  for (const ref of formul.referanslar) {
    const kpi = kpiHaritasi.get(ref.kpiId)
    if (!kpi) continue
    for (const m of kpi.measurements) donemler.add(`${m.year}-${m.month}`)
    for (const a of kpi.ozelAlanlar) for (const d of a.degerler) donemler.add(`${d.year}-${d.month}`)
  }
  return Array.from(donemler).map(s => {
    const [year, month] = s.split('-').map(Number)
    return { year, month }
  })
}
