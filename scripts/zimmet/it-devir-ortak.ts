/**
 * it-devir-* script'lerinin ortak yardımcıları.
 */
import fs from 'fs'
import { normalizeTr } from '../../src/lib/normalize-tr'

// TASI'da eski kayda yazılan durum geçmişi notunun öneki — geri alma bu önekle
// hangi silmelerin import'tan geldiğini doğrular.
export const TASI_SEBEP_ONEKI = 'IT listesi 09.2026 – yeni sahibine taşındı: '
// --yenile: aynı sahipteki eski kayıt listeden yeniden oluşturulduğunda.
export const YENILE_SEBEP_ONEKI = 'IT listesi 09.2026 – listeden yeniden oluşturuldu: '
// İmzalı kayıt başka sahipteyken liste sahibine taşındığında.
export const TASI_IMZALI_SEBEP_ONEKI = 'IT listesi 09.2026 – liste sahibi farklı, yeni sahibine taşındı: '

// Eski kaydı soft-delete edip itdevir-<ref> açan import kararları → eski kayda yazılan not öneki.
export const ESKI_SILEN_KARARLAR: Record<string, string> = {
  TASI: TASI_SEBEP_ONEKI,
  TASI_IMZALI: TASI_IMZALI_SEBEP_ONEKI,
  YENILE: YENILE_SEBEP_ONEKI,
}
// it-devir-temizle.ts: listede olmayan kayıtlar.
export const TEMIZLIK_NOTU = 'IT listesi 09.2026 – liste dışı kayıt temizlendi'
// it-devir-geri-al.ts --sadece ile "IT elle girecek" diye çıkarılan kayıtların silme notu.
export const SORUNLU_NOTU = 'IT listesi 09.2026 – sorunlu kayıt, IT elle girecek'
// it-devir-import.ts YENIDEN_AC: yalnız son silme notu SORUNLU_NOTU olan itdevir- kaydı geri açılır.
export const YENIDEN_AC_NOTU = 'IT listesi 09.2026 – IT bilgisiyle yeniden açıldı'

const GECERSIZ_ANAHTAR = new Set(['', 'NAT', 'YOK'])

// Eşleştirme anahtarı: büyük harf, boşluk/tire/iki nokta temizlenir; boş, NAT ve YOK anahtar sayılmaz.
export function anahtarNormalize(deger: string | null | undefined): string | null {
  const s = (deger ?? '').toUpperCase().replace(/[\s\-:]/g, '')
  return GECERSIZ_ANAHTAR.has(s) ? null : s
}

export function argDeger(ad: string): string | null {
  const i = process.argv.indexOf(ad)
  const v = i >= 0 ? process.argv[i + 1] : undefined
  return v && !v.startsWith('--') ? v : null
}

// RFC 4180 CSV (tırnaklı alan, "" kaçışı, alan içi satır sonu). İlk satır başlık.
export function csvOku(yol: string): Record<string, string>[] {
  const metin = fs.readFileSync(yol, 'utf-8').replace(/^﻿/, '')
  const satirlar: string[][] = []
  let alan = ''
  let satir: string[] = []
  let tirnakta = false
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i]
    if (tirnakta) {
      if (c === '"' && metin[i + 1] === '"') {
        alan += '"'
        i++
      } else if (c === '"') {
        tirnakta = false
      } else {
        alan += c
      }
    } else if (c === '"') {
      tirnakta = true
    } else if (c === ',') {
      satir.push(alan)
      alan = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && metin[i + 1] === '\n') i++
      satir.push(alan)
      satirlar.push(satir)
      alan = ''
      satir = []
    } else {
      alan += c
    }
  }
  if (tirnakta) throw new Error(`${yol}: kapanmamış tırnak`)
  if (alan !== '' || satir.length) {
    satir.push(alan)
    satirlar.push(satir)
  }
  const [baslik, ...veri] = satirlar
  return veri
    .filter((s) => s.some((x) => x !== ''))
    .map((s, n) => {
      if (s.length !== baslik.length) {
        throw new Error(`${yol}: ${n + 2}. satırda ${s.length} alan var, başlıkta ${baslik.length}`)
      }
      return Object.fromEntries(baslik.map((b, i) => [b, s[i]]))
    })
}

function csvAlan(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function csvYaz(yol: string, baslik: string[], satirlar: string[][]): void {
  const govde = [baslik, ...satirlar].map((s) => s.map(csvAlan).join(',')).join('\n')
  fs.writeFileSync(yol, govde + '\n', 'utf-8')
}

// ── Sahip eşleştirme (import ve yeniden atama aynı kuralı kullanır) ──

export type Kullanici = { id: string; name: string | null; firstName: string | null; lastName: string | null; email: string; isActive: boolean }
export const KULLANICI_SELECT = { id: true, name: true, firstName: true, lastName: true, email: true, isActive: true } as const
const BLUECOLLAR_DOMAIN = '@bluecollar.ilerigroup.com'

// Ad karşılaştırması: normalizeTr + fazla boşluk + " | ILERI" gibi ekler temizlenir.
export function adNormalize(ad: string | null | undefined): string {
  return normalizeTr((ad ?? '').split('|')[0]).replace(/\s+/g, ' ').trim()
}

// Kişi eşleştirme override'ı ({"Excel adı": "User.id"}). Açıkça verilen yol yoksa durur;
// verilmezse varsayılan dosya varsa yüklenir.
export function overrideYukle(acikYol: string | null, varsayilanYol: string): Record<string, string> {
  if (acikYol && !fs.existsSync(acikYol)) throw new Error(`--override dosyası bulunamadı: ${acikYol}`)
  const yol = acikYol ?? varsayilanYol
  if (!fs.existsSync(yol)) {
    console.log(`Kişi eşleştirme override: YOK (varsayılan ${yol} bulunamadı)`)
    return {}
  }
  const override = JSON.parse(fs.readFileSync(yol, 'utf-8')) as Record<string, string>
  console.log(`Kişi eşleştirme override: ${yol} — ${Object.keys(override).length} anahtar yüklendi`)
  return override
}

// Excel adı → User. Sıra: override → TAM ad (normalizeTr) → tek eşleşme aktifse o, birden fazlaysa
// tek aktif AD hesabı. Eşleşme yok / yalnız kısmi / yalnız pasif → user null + sebep.
export function sahipEslestirici(kullanicilar: Kullanici[], override: Record<string, string>) {
  const overrideNorm = new Map(Object.entries(override).map(([ad, id]) => [adNormalize(ad), id]))
  const kullaniciById = new Map(kullanicilar.map((u) => [u.id, u]))
  const kullaniciByAd = new Map<string, Kullanici[]>()
  for (const u of kullanicilar) {
    const adlar = new Set([adNormalize(u.name), adNormalize(`${u.firstName ?? ''} ${u.lastName ?? ''}`)])
    for (const ad of adlar) {
      if (!ad) continue
      kullaniciByAd.set(ad, [...(kullaniciByAd.get(ad) ?? []), u])
    }
  }

  return function sahipBul(ad: string): { user: Kullanici | null; sebep: string } {
    const n = adNormalize(ad)
    const ovId = overrideNorm.get(n)
    if (ovId) {
      const u = kullaniciById.get(ovId)
      return u ? { user: u, sebep: 'override' } : { user: null, sebep: `override User.id bulunamadı: ${ovId}` }
    }
    const adaylar = kullaniciByAd.get(n) ?? []
    if (adaylar.length === 0) {
      const tokenlar = new Set(n.split(' '))
      const kismi = kullanicilar.filter((u) => {
        const t = new Set(adNormalize(u.name).split(' ').filter(Boolean))
        const ortak = [...tokenlar].filter((x) => t.has(x)).length
        return ortak >= 2 && ([...tokenlar].every((x) => t.has(x)) || [...t].every((x) => tokenlar.has(x)))
      })
      return {
        user: null,
        sebep: kismi.length
          ? `yalnız kısmi eşleşme: ${kismi.map((u) => `${u.name} (${u.id})`).join('; ')}`
          : 'User tablosunda eşleşme yok',
      }
    }
    if (adaylar.length === 1) {
      const u = adaylar[0]
      return u.isActive ? { user: u, sebep: 'tam' } : { user: null, sebep: `tek eşleşme PASİF hesap: ${u.name} (${u.id})` }
    }
    const aktifAd = adaylar.filter((u) => u.isActive && !u.email.toLowerCase().endsWith(BLUECOLLAR_DOMAIN))
    if (aktifAd.length === 1) return { user: aktifAd[0], sebep: `${adaylar.length} hesaptan aktif AD hesabı seçildi` }
    return {
      user: null,
      sebep: `birden fazla hesap, tek aktif AD hesabı yok: ${adaylar.map((u) => `${u.id}${u.isActive ? '' : ' (pasif)'}`).join('; ')}`,
    }
  }
}

// /tmp/<ad>-<mod>-YYYYMMDD-HHMM.csv
export function raporYolu(ad: string, mod: string): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const damga = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
  return `/tmp/${ad}-${mod}-${damga}.csv`
}
