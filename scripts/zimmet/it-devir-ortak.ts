/**
 * it-devir-import.ts ve it-devir-geri-al.ts ortak yardımcıları.
 */
import fs from 'fs'

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

// /tmp/<ad>-<mod>-YYYYMMDD-HHMM.csv
export function raporYolu(ad: string, mod: string): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const damga = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
  return `/tmp/${ad}-${mod}-${damga}.csv`
}
