/**
 * report-duplicates.ts — SALT OKUNUR. DB'ye DOKUNMAZ (yalnız Excel okur).
 *
 * MAS export'undaki @unique-olması-gereken alanlarda TÜM mükerrer kodları bulur.
 * Her çakışma için:
 *   - kod
 *   - çakışan kayıtların TAM bilgisi (tüm kolonlar)
 *   - HER BİR kaydın kaç DISTINCT tezgaha bağlı olduğu (ada göre ayrılmış):
 *       duruş  → DowntimeWorkCenterMatch (Duruş Kodu + Duruş adı)
 *       hurda  → hurda_is_merkezi (Kod + Hurda adı)
 *
 * Amaç: Melih MAS'ta hangi kayda yeni kod vereceğine karar versin
 *       (AZ tezgaha bağlı olan yeniden kodlanmalı — geçmiş en az etkilensin).
 *
 * Çalıştırma: npx tsx --env-file=.env scripts/ipro/report-duplicates.ts
 *   (env gerekmez ama zararsız; DB bağlantısı açılmaz.)
 */
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const MAS_DIR = '/home/rokunet/ipro-mas-export'

function findFile(pattern: RegExp): string {
  const m = fs.readdirSync(MAS_DIR).filter((f) => f.toLowerCase().endsWith('.xlsx') && pattern.test(f))
  if (m.length !== 1) throw new Error(`DUR: ${pattern} → ${m.length} eşleşme: ${m.join(', ')}`)
  return path.join(MAS_DIR, m[0])
}
function readRows(file: string): Record<string, any>[] {
  const ws = XLSX.readFile(file).Sheets[XLSX.readFile(file).SheetNames[0]]
  return XLSX.utils
    .sheet_to_json<Record<string, any>>(ws, { defval: null })
    .filter((r) => Object.values(r).some((v) => v !== null && String(v).trim() !== ''))
}
const clean = (v: any) => (v == null ? '' : String(v).trim())

// ── Tezgah-bağlama haritaları (kod + ad → distinct tezgah) ──
function bindingMap(file: string, kodCol: string, adCol: string, tezgahCol: string): Map<string, Map<string, Set<string>>> {
  const m = new Map<string, Map<string, Set<string>>>()
  for (const r of readRows(file)) {
    const kod = clean(r[kodCol])
    if (!kod) continue
    const ad = clean(r[adCol])
    if (!m.has(kod)) m.set(kod, new Map())
    const byAd = m.get(kod)!
    if (!byAd.has(ad)) byAd.set(ad, new Set())
    const set = byAd.get(ad)!
    // tezgah kolonu: tek kod (duruş) VEYA virgüllü liste (hurda)
    for (const t of clean(r[tezgahCol]).split(',').map((s) => s.trim()).filter(Boolean)) set.add(t)
  }
  return m
}

function tezgahCount(m: Map<string, Map<string, Set<string>>>, kod: string, ad: string): { byAd: number; total: number } {
  const byAd = m.get(kod)
  if (!byAd) return { byAd: 0, total: 0 }
  const total = new Set<string>()
  for (const s of byAd.values()) for (const t of s) total.add(t)
  return { byAd: byAd.get(ad)?.size ?? 0, total: total.size }
}

function main() {
  console.log('════════════════════════════════════════════════════════════════')
  console.log('  MAS EXPORT — MÜKERRER KOD RAPORU (salt okunur)')
  console.log('════════════════════════════════════════════════════════════════')

  // Downtime: Duruş Kodu + Duruş adı → tezgah (İş Merkezi Kodu)
  const durusBind = bindingMap(findFile(/Downtime.*MatchList/i), 'Duruş Kodu', 'Duruş', 'İş Merkezi Kodu')
  // hurda_is_merkezi: Kod + Hurda adı → İş Merkezleri (virgüllü)
  const hurdaBind = bindingMap(findFile(/hurda[_ ]is[_ ]merkezi/i), 'Kod', 'Hurda', 'İş Merkezleri')

  const specs: {
    label: string
    file: RegExp
    kodCol: string
    adCol: string
    bind?: Map<string, Map<string, Set<string>>>
  }[] = [
    { label: 'PLC Listesi (IproPlc.kod)', file: /^PLC[ _]Listesi\.xlsx$/i, kodCol: 'Kod', adCol: 'Adı' },
    { label: 'PLC Ayar Listesi (IproPlcPin.kod)', file: /^PLC[ _]Ayar[ _]Listesi\.xlsx$/i, kodCol: 'Kod', adCol: 'Açıklama' },
    { label: 'DURUŞ TİPLERİ (IproDurusTipi.kod)', file: /T[İI]PLER/i, kodCol: 'Kod', adCol: 'Adı' },
    { label: 'DURUŞLAR (IproDurusSebebi.kod)', file: /^DURU\S*LAR\s*\.xlsx$/i, kodCol: 'Kod', adCol: 'Ad', bind: durusBind },
    { label: 'HURDALAR (IproHurdaSebebi.kod)', file: /^HURDALAR\.xlsx$/i, kodCol: 'Kod', adCol: 'Ad', bind: hurdaBind },
  ]

  let totalDup = 0
  for (const s of specs) {
    const rows = readRows(findFile(s.file)).filter((r) => clean(r[s.kodCol]) !== '')
    const byKod = new Map<string, Record<string, any>[]>()
    for (const r of rows) {
      const k = clean(r[s.kodCol])
      if (!byKod.has(k)) byKod.set(k, [])
      byKod.get(k)!.push(r)
    }
    const dups = [...byKod.entries()].filter(([, v]) => v.length > 1)
    console.log(`\n──── ${s.label} ────`)
    console.log(`     satır: ${rows.length} | distinct kod: ${byKod.size} | MÜKERRER: ${dups.length}`)
    for (const [kod, recs] of dups) {
      totalDup++
      console.log(`\n   ⚠️  kod "${kod}" — ${recs.length} çakışan kayıt:`)
      for (const r of recs) {
        const ad = clean(r[s.adCol])
        let tezgahInfo = ''
        if (s.bind) {
          const { byAd, total } = tezgahCount(s.bind, kod, ad)
          tezgahInfo = `  → bu ada bağlı DISTINCT tezgah: ${byAd}  (kod toplamı: ${total})`
        }
        console.log(`      • "${ad}"${tezgahInfo}`)
        // tam kayıt (boş/null olmayan kolonlar)
        const full = Object.fromEntries(Object.entries(r).filter(([k, v]) => v !== null && String(v).trim() !== '' && !/^__EMPTY/.test(k)))
        console.log(`        ${JSON.stringify(full)}`)
      }
      if (s.bind) {
        console.log(`      ↳ ÖNERİ: DAHA AZ tezgaha bağlı kayda yeni kod ver (geçmiş en az etkilensin).`)
      }
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════')
  console.log(`  TOPLAM ${totalDup} mükerrer kod bulundu.`)
  console.log('════════════════════════════════════════════════════════════════')
  if (totalDup > 0) process.exitCode = 2 // bilgi amaçlı: 0-dışı = çakışma var
}

main()
