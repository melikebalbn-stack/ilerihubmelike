/**
 * Rapor formülleri — küçük ifade dili: tokenizer + recursive descent parser + yorumlayıcı.
 * eval / new Function / vm KULLANILMAZ.
 *
 * Dil:  {alan}  {p.parametre}  'metin' ('' → ')  123  12.5  dogru yanlis bos
 * Öncelik (düşük→yüksek):  ||   &&   == != <> < <= > >=   + -   * / %   tekli - !   ( )
 * Null yayılımı: aritmetik/sıralama karşılaştırmasında taraf null ise sonuç null;
 * == / != null ile karşılaştırabilir. Bölme: payda 0/null → null.
 *
 * ifadeDerle: sözdizimi hatasında IfadeHatasi (konum + neden).
 * ifadeCalistir: çalışma zamanı hatası → null, istisna fırlatmaz.
 */

// ── Hata ────────────────────────────────────────────────────────────────

export class IfadeHatasi extends Error {
  constructor(public readonly konum: number, public readonly neden: string) {
    super(`Sözdizimi hatası (konum ${konum}): ${neden}`)
    this.name = 'IfadeHatasi'
  }
}

// ── Tokenizer ───────────────────────────────────────────────────────────

type TokenTip = 'sayi' | 'metin' | 'kimlik' | 'alan' | 'param' | 'op' | 'son'
interface Token { tip: TokenTip; deger: string; konum: number }

const OPLER = ['||', '&&', '==', '!=', '<>', '<=', '>=', '<', '>', '+', '-', '*', '/', '%', '!', '(', ')', ','] // uzun olan önce
const KIMLIK_BAS = /[A-Za-zÇĞİÖŞÜçğıöşü_]/
const KIMLIK_GOVDE = /[A-Za-z0-9ÇĞİÖŞÜçğıöşü_]/

function tokenle(kaynak: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < kaynak.length) {
    const c = kaynak[i]
    if (/\s/.test(c)) { i++; continue }

    if (c === '{') {
      const kapanis = kaynak.indexOf('}', i)
      if (kapanis < 0) throw new IfadeHatasi(i, "'}' bekleniyor")
      const ad = kaynak.slice(i + 1, kapanis).trim()
      if (!ad) throw new IfadeHatasi(i, 'boş alan referansı {}')
      if (ad.startsWith('p.')) {
        const pad = ad.slice(2)
        if (!pad) throw new IfadeHatasi(i, 'parametre adı eksik: {p.}')
        out.push({ tip: 'param', deger: pad, konum: i })
      } else out.push({ tip: 'alan', deger: ad, konum: i })
      i = kapanis + 1
      continue
    }

    if (c === "'") {
      let j = i + 1
      let s = ''
      for (;;) {
        if (j >= kaynak.length) throw new IfadeHatasi(i, 'metin sabiti kapanmamış')
        if (kaynak[j] === "'") {
          if (kaynak[j + 1] === "'") { s += "'"; j += 2; continue }
          break
        }
        s += kaynak[j++]
      }
      out.push({ tip: 'metin', deger: s, konum: i })
      i = j + 1
      continue
    }

    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(kaynak[i + 1] ?? ''))) {
      const m = /^[0-9]*\.?[0-9]+|^[0-9]+\.?/.exec(kaynak.slice(i))!
      out.push({ tip: 'sayi', deger: m[0], konum: i })
      i += m[0].length
      continue
    }

    if (KIMLIK_BAS.test(c)) {
      let j = i + 1
      while (j < kaynak.length && KIMLIK_GOVDE.test(kaynak[j])) j++
      out.push({ tip: 'kimlik', deger: kaynak.slice(i, j), konum: i })
      i = j
      continue
    }

    const op = OPLER.find((o) => kaynak.startsWith(o, i))
    if (op) { out.push({ tip: 'op', deger: op, konum: i }); i += op.length; continue }

    throw new IfadeHatasi(i, `beklenmeyen karakter '${c}'`)
  }
  out.push({ tip: 'son', deger: '', konum: kaynak.length })
  return out
}

// ── AST ─────────────────────────────────────────────────────────────────

type Dugum =
  | { t: 'sabit'; v: unknown }
  | { t: 'alan'; ad: string }
  | { t: 'param'; ad: string }
  | { t: 'tekli'; op: '-' | '!'; a: Dugum }
  | { t: 'ikili'; op: string; a: Dugum; b: Dugum }
  | { t: 'cagri'; fn: string; args: Dugum[] }

export interface DerlenmisIfade {
  readonly kaynak: string
  readonly kok: Dugum
  /** İfadede geçen alan adları (tekil). */
  readonly alanlar: string[]
  /** İfadede geçen parametre adları (tekil). */
  readonly parametreler: string[]
}

// ── Parser (recursive descent) ──────────────────────────────────────────

/** fn adı → [min arg, max arg (Infinity: değişken)]. */
const FONKSIYONLAR: Record<string, [number, number]> = {
  iif: [3, 3], yuvarla: [1, 2], mutlak: [1, 1], metin: [1, 1], sayi: [1, 1], uzunluk: [1, 1], kirp: [1, 1],
  buyuk: [1, 1], kucuk: [1, 1], birlestir: [1, Infinity], tarih: [1, 1], yil: [1, 1], ay: [1, 1], gun: [1, 1],
  tarihFark: [2, 2], bosMu: [1, 1],
}

class Parser {
  private i = 0
  readonly alanlar = new Set<string>()
  readonly parametreler = new Set<string>()
  constructor(private readonly t: Token[]) {}

  private bak(): Token { return this.t[this.i] }
  private al(): Token { return this.t[this.i++] }
  private opMu(...ops: string[]): boolean { const k = this.bak(); return k.tip === 'op' && ops.includes(k.deger) }
  private bekle(op: string): void {
    const k = this.bak()
    if (k.tip !== 'op' || k.deger !== op) throw new IfadeHatasi(k.konum, `'${op}' bekleniyor${k.tip === 'son' ? ', ifade bitti' : `, '${k.deger}' bulundu`}`)
    this.i++
  }

  ifade(): Dugum {
    const d = this.veya()
    const k = this.bak()
    if (k.tip !== 'son') throw new IfadeHatasi(k.konum, `beklenmeyen '${k.deger}'`)
    return d
  }

  private ikiliSeviye(alt: () => Dugum, ...ops: string[]): Dugum {
    let a = alt()
    while (this.opMu(...ops)) { const op = this.al().deger; a = { t: 'ikili', op, a, b: alt() } }
    return a
  }
  private veya = (): Dugum => this.ikiliSeviye(this.ve, '||')
  private ve = (): Dugum => this.ikiliSeviye(this.karsilastir, '&&')
  private karsilastir = (): Dugum => this.ikiliSeviye(this.topla, '==', '!=', '<>', '<', '<=', '>', '>=')
  private topla = (): Dugum => this.ikiliSeviye(this.carp, '+', '-')
  private carp = (): Dugum => this.ikiliSeviye(this.tekli, '*', '/', '%')

  private tekli = (): Dugum => {
    if (this.opMu('-', '!')) { const op = this.al().deger as '-' | '!'; return { t: 'tekli', op, a: this.tekli() } }
    return this.birincil()
  }

  private birincil(): Dugum {
    const k = this.al()
    switch (k.tip) {
      case 'sayi': return { t: 'sabit', v: Number(k.deger) }
      case 'metin': return { t: 'sabit', v: k.deger }
      case 'alan': this.alanlar.add(k.deger); return { t: 'alan', ad: k.deger }
      case 'param': this.parametreler.add(k.deger); return { t: 'param', ad: k.deger }
      case 'kimlik': {
        if (k.deger === 'dogru') return { t: 'sabit', v: true }
        if (k.deger === 'yanlis') return { t: 'sabit', v: false }
        if (k.deger === 'bos') return { t: 'sabit', v: null }
        if (!this.opMu('(')) throw new IfadeHatasi(k.konum, `bilinmeyen kimlik '${k.deger}' (alan için {${k.deger}} yazın)`)
        const imza = FONKSIYONLAR[k.deger]
        if (!imza) throw new IfadeHatasi(k.konum, `bilinmeyen fonksiyon '${k.deger}'`)
        this.bekle('(')
        const args: Dugum[] = []
        if (!this.opMu(')')) {
          args.push(this.veya())
          while (this.opMu(',')) { this.al(); args.push(this.veya()) }
        }
        this.bekle(')')
        if (args.length < imza[0] || args.length > imza[1]) {
          const beklenen = imza[1] === Infinity ? `en az ${imza[0]}` : imza[0] === imza[1] ? `${imza[0]}` : `${imza[0]}-${imza[1]}`
          throw new IfadeHatasi(k.konum, `${k.deger}: ${beklenen} argüman bekleniyor, ${args.length} verildi`)
        }
        return { t: 'cagri', fn: k.deger, args }
      }
      case 'op':
        if (k.deger === '(') { const d = this.veya(); this.bekle(')'); return d }
        throw new IfadeHatasi(k.konum, `beklenmeyen '${k.deger}'`)
      case 'son':
        throw new IfadeHatasi(k.konum, 'ifade eksik bitti')
    }
  }
}

export function ifadeDerle(kaynak: string): DerlenmisIfade {
  if (!kaynak.trim()) throw new IfadeHatasi(0, 'ifade boş')
  const p = new Parser(tokenle(kaynak))
  const kok = p.ifade()
  return { kaynak, kok, alanlar: [...p.alanlar], parametreler: [...p.parametreler] }
}

// ── Değer yardımcıları ──────────────────────────────────────────────────

const bosMu = (v: unknown): boolean => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

/** Sayıya çevirir; olmazsa null. Boş metin → null. Date → zaman damgası değil, null (kasıtlı). */
function sayiya(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') { const n = Number(v.trim()); return v.trim() !== '' && Number.isFinite(n) ? n : null }
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'object' && v !== null && 'toNumber' in v && typeof (v as { toNumber: unknown }).toNumber === 'function') {
    const n = (v as { toNumber: () => number }).toNumber(); return Number.isFinite(n) ? n : null // Prisma Decimal
  }
  return null
}

function metne(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

function tarihe(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (typeof v === 'string' && v.trim()) { const d = new Date(v.trim()); return Number.isNaN(d.getTime()) ? null : d }
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v)
  return null
}

function dogruMu(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v)
  if (typeof v === 'string') return v !== ''
  return true
}

/** -1/0/1 ya da null (karşılaştırılamaz). Sayı-sayı, tarih-tarih, aksi hâlde metin. */
function kiyasla(a: unknown, b: unknown): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null
  if (a instanceof Date || b instanceof Date) {
    const da = tarihe(a), db = tarihe(b)
    if (!da || !db) return null
    return Math.sign(da.getTime() - db.getTime())
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') return Math.sign(Number(a) - Number(b))
  const na = sayiya(a), nb = sayiya(b)
  if (na !== null && nb !== null && typeof a !== 'boolean' && typeof b !== 'boolean') return Math.sign(na - nb)
  const sa = metne(a), sb = metne(b)
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

function esitMi(a: unknown, b: unknown): boolean {
  const an = a === null || a === undefined, bn = b === null || b === undefined
  if (an || bn) return an && bn
  return kiyasla(a, b) === 0
}

// ── Yorumlayıcı ─────────────────────────────────────────────────────────

interface Baglam { satir: Record<string, unknown>; parametreler?: Record<string, unknown> }

function aritmetik(op: string, a: unknown, b: unknown): unknown {
  if (op === '+') {
    const na = sayiya(a), nb = sayiya(b)
    if (na !== null && nb !== null && typeof a !== 'string' && typeof b !== 'string') return na + nb
    if (typeof a === 'string' || typeof b === 'string') {
      // '5' + 3 → sayı; 'a' + 'b' → metin birleştirme
      if (na !== null && nb !== null) return na + nb
      if (bosMu(a) || bosMu(b)) return null
      return metne(a) + metne(b)
    }
    return null
  }
  const na = sayiya(a), nb = sayiya(b)
  if (na === null || nb === null) return null
  switch (op) {
    case '-': return na - nb
    case '*': return na * nb
    case '/': return nb === 0 ? null : na / nb
    case '%': return nb === 0 ? null : na % nb
  }
  return null
}

function cagir(fn: string, a: unknown[]): unknown {
  switch (fn) {
    case 'iif': return dogruMu(a[0]) ? a[1] : a[2]
    case 'yuvarla': {
      const n = sayiya(a[0]); if (n === null) return null
      const b = Math.max(0, Math.trunc(sayiya(a[1]) ?? 0))
      const k = 10 ** b
      return Math.round((n + Number.EPSILON) * k) / k
    }
    case 'mutlak': { const n = sayiya(a[0]); return n === null ? null : Math.abs(n) }
    case 'metin': return a[0] === null || a[0] === undefined ? null : metne(a[0])
    case 'sayi': return sayiya(a[0])
    case 'uzunluk': return a[0] === null || a[0] === undefined ? null : metne(a[0]).length
    case 'kirp': return a[0] === null || a[0] === undefined ? null : metne(a[0]).trim()
    case 'buyuk': return a[0] === null || a[0] === undefined ? null : metne(a[0]).toLocaleUpperCase('tr-TR')
    case 'kucuk': return a[0] === null || a[0] === undefined ? null : metne(a[0]).toLocaleLowerCase('tr-TR')
    case 'birlestir': return a.map(metne).join('')
    case 'tarih': return tarihe(a[0])
    case 'yil': { const d = tarihe(a[0]); return d ? d.getFullYear() : null }
    case 'ay': { const d = tarihe(a[0]); return d ? d.getMonth() + 1 : null }
    case 'gun': { const d = tarihe(a[0]); return d ? d.getDate() : null }
    case 'tarihFark': {
      const d1 = tarihe(a[0]), d2 = tarihe(a[1])
      if (!d1 || !d2) return null
      return Math.round((d2.getTime() - d1.getTime()) / 86_400_000)
    }
    case 'bosMu': return bosMu(a[0])
  }
  return null
}

function degerlendir(d: Dugum, b: Baglam): unknown {
  switch (d.t) {
    case 'sabit': return d.v
    case 'alan': { const v = b.satir[d.ad]; return v === undefined ? null : v }
    case 'param': { const v = b.parametreler?.[d.ad]; return v === undefined ? null : v }
    case 'tekli': {
      const v = degerlendir(d.a, b)
      if (d.op === '!') return !dogruMu(v)
      const n = sayiya(v); return n === null ? null : -n
    }
    case 'ikili': {
      // Kısa devre
      if (d.op === '||') return dogruMu(degerlendir(d.a, b)) || dogruMu(degerlendir(d.b, b))
      if (d.op === '&&') return dogruMu(degerlendir(d.a, b)) && dogruMu(degerlendir(d.b, b))
      const x = degerlendir(d.a, b), y = degerlendir(d.b, b)
      switch (d.op) {
        case '==': return esitMi(x, y)
        case '!=': case '<>': return !esitMi(x, y)
        case '<': { const k = kiyasla(x, y); return k === null ? null : k < 0 }
        case '<=': { const k = kiyasla(x, y); return k === null ? null : k <= 0 }
        case '>': { const k = kiyasla(x, y); return k === null ? null : k > 0 }
        case '>=': { const k = kiyasla(x, y); return k === null ? null : k >= 0 }
        default: return aritmetik(d.op, x, y)
      }
    }
    case 'cagri': return cagir(d.fn, d.args.map((a) => degerlendir(a, b)))
  }
}

/** Çalışma zamanı hatası → null (istisna fırlatmaz). */
export function ifadeCalistir(derlenmis: DerlenmisIfade, baglam: Baglam): unknown {
  try {
    const v = degerlendir(derlenmis.kok, baglam)
    if (typeof v === 'number' && !Number.isFinite(v)) return null
    return v === undefined ? null : v
  } catch {
    return null
  }
}

// ── Doğrulama (tasarım ekranı) ──────────────────────────────────────────

export function ifadeDogrula(kaynak: string, gecerliAlanlar: string[]): { gecerli: boolean; hata?: string; kullanilanAlanlar: string[] } {
  let d: DerlenmisIfade
  try {
    d = ifadeDerle(kaynak)
  } catch (e) {
    return { gecerli: false, hata: e instanceof Error ? e.message : String(e), kullanilanAlanlar: [] }
  }
  const gecerli = new Set(gecerliAlanlar)
  const bilinmeyen = d.alanlar.filter((a) => !gecerli.has(a))
  return {
    gecerli: true,
    hata: bilinmeyen.length ? `Uyarı: tanımsız alan(lar) — ${bilinmeyen.map((a) => `{${a}}`).join(', ')}; bu hücreler boş kalır` : undefined,
    kullanilanAlanlar: d.alanlar,
  }
}

// ── Toplamlar (grup / genel) ────────────────────────────────────────────

export type ToplamFn = 'topla' | 'ortalama' | 'say' | 'enbuyuk' | 'enkucuk'

/** say: null/boş olmayan satır sayısı. Diğerleri sayısal değerler üzerinde; sayısal değer yoksa null (topla → 0). */
export function toplamHesapla(fn: ToplamFn, alan: string, satirlar: Record<string, unknown>[]): number | null {
  if (fn === 'say') return satirlar.reduce((n, s) => n + (bosMu(s[alan]) ? 0 : 1), 0)
  const sayilar: number[] = []
  for (const s of satirlar) { const n = sayiya(s[alan]); if (n !== null) sayilar.push(n) }
  switch (fn) {
    case 'topla': return sayilar.reduce((a, b) => a + b, 0)
    case 'ortalama': return sayilar.length ? sayilar.reduce((a, b) => a + b, 0) / sayilar.length : null
    case 'enbuyuk': return sayilar.length ? Math.max(...sayilar) : null
    case 'enkucuk': return sayilar.length ? Math.min(...sayilar) : null
  }
}
