/**
 * PİLOT ATAMA DÖNÜŞTÜRÜCÜ (dosyadan dosyaya — DB'ye YAZMAZ, DB'ye BAĞLANMAZ).
 *
 * Canlı Personel Excel export'unun yalnız SİCİL NO / SERVİS / DURAK ADI sütunlarını okur,
 * Excel toplu atama şablonu biçiminde dosya(lar) + eşleşmeyenler listesi üretir.
 *
 *   npx tsx scripts/servis-pilot-atama-donustur.ts \
 *     --girdi=~/pilot-veri/personel.xlsx --cikti=~/pilot-veri/cikti \
 *     [--dilim=SABAH_GIDIS,AKSAM_DONUS] [--baslangic=2026-10-12]
 *
 * Çıktılar (--cikti öneki): <önek>-atama-1.xlsx … (her biri en fazla 300 satır, toplu atama
 * ekranının sınırı) ve <önek>-eslesmeyenler.xlsx (Özet / Eşleşmeyen / Atama üretilmeyen).
 * 🔴 KİŞİSEL VERİ: dosyalar ~/pilot-veri/ altında tutulur, repoya girmez, iş bitince silinir.
 * Sefer dilimi varsayılanı SABAH_GIDIS,AKSAM_DONUS (Elif kararı 2026-10-07, plan KARARLAR); --dilim ile değişir.
 */
import * as XLSX from 'xlsx'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { donustur, normalizeTR, PILOT_SABLON_BASLIKLARI as SABLON_BASLIKLARI, type PilotGirdiSatiri } from '../src/lib/servis-yonetimi/pilot-atama-donusturucu'
import { EXCEL_LIMITLERI } from '../src/lib/servis-yonetimi/excel-atama-limitleri'

const arg = (ad: string) => process.argv.find((a) => a.startsWith(`--${ad}=`))?.slice(ad.length + 3)
const yol = (p: string) => path.resolve(p.replace(/^~(?=$|\/)/, os.homedir()))
const bugunTR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())

function dur(mesaj: string): never {
  console.error(`HATA: ${mesaj}`)
  process.exit(1)
}

function girdiOku(dosya: string): PilotGirdiSatiri[] {
  const wb = XLSX.read(fs.readFileSync(dosya), { type: 'buffer' })
  const ad = wb.SheetNames.includes('Personel') ? 'Personel' : wb.SheetNames[0]
  const tablo = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[ad], { header: 1, raw: true, defval: null })
  const basliklar = (tablo[0] ?? []).map((h) => normalizeTR(String(h ?? '')))
  const bul = (uygun: (n: string) => boolean) => basliklar.findIndex(uygun)
  const iSicil = bul((n) => n.startsWith('SICIL'))
  const iServis = bul((n) => n === 'SERVIS')
  const iDurak = bul((n) => n.startsWith('DURAK'))
  const eksik = [['Sicil', iSicil], ['Servis', iServis], ['Durak', iDurak]].filter(([, i]) => i === -1).map(([a]) => a)
  if (eksik.length) dur(`Girdide sütun bulunamadı: ${eksik.join(', ')}`)
  const metin = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())
  // YALNIZ üç sütun okunur; diğer (kişisel) sütunlar hiç belleğe alınmaz.
  return tablo.slice(1).map((r, i) => ({ satirNo: i + 2, sicil: metin(r[iSicil]), servis: metin(r[iServis]), durak: metin(r[iDurak]) }))
}

function yaz(dosya: string, sayfalar: Record<string, unknown[][]>) {
  const wb = XLSX.utils.book_new()
  for (const [ad, aoa] of Object.entries(sayfalar)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), ad)
  XLSX.writeFile(wb, dosya)
}

function main() {
  const girdi = arg('girdi'), cikti = arg('cikti'), dilim = arg('dilim') ?? 'SABAH_GIDIS,AKSAM_DONUS'
  if (!girdi || !cikti) dur('--girdi ve --cikti zorunlu')
  const baslangic = arg('baslangic') ?? bugunTR()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baslangic)) dur('--baslangic YYYY-AA-GG olmalı')
  const dilimler = dilim.split(',').map((d) => d.trim()).filter(Boolean).join(', ')

  const sonuc = donustur(girdiOku(yol(girdi)))
  const onek = yol(cikti)
  fs.mkdirSync(path.dirname(onek), { recursive: true })

  const satirlar = sonuc.atamalar.map((a) => [a.sicil, a.guzergahKod, a.durakKod, dilimler, baslangic])
  const parca = EXCEL_LIMITLERI.maksSatir
  const parcaSayisi = Math.max(1, Math.ceil(satirlar.length / parca))
  for (let p = 0; p < parcaSayisi; p++) {
    yaz(`${onek}-atama-${p + 1}.xlsx`, { Atama: [[...SABLON_BASLIKLARI], ...satirlar.slice(p * parca, (p + 1) * parca)] })
  }

  const neden = new Map<string, number>()
  for (const e of sonuc.eslesmeyenler) neden.set(e.neden.replace(/:.*$|\(.*$/, '').trim(), (neden.get(e.neden.replace(/:.*$|\(.*$/, '').trim()) ?? 0) + 1)
  const uretilmeyen = new Map<string, number>()
  for (const u of sonuc.atamaUretilmeyenler) uretilmeyen.set(u.sebep, (uretilmeyen.get(u.sebep) ?? 0) + 1)
  yaz(`${onek}-eslesmeyenler.xlsx`, {
    Özet: [
      ['Girdi satırı', sonuc.atamalar.length + sonuc.eslesmeyenler.length + sonuc.atamaUretilmeyenler.length],
      ['Atama üretilen', sonuc.atamalar.length],
      ['Eşleşmeyen', sonuc.eslesmeyenler.length],
      ['Atama üretilmeyen', sonuc.atamaUretilmeyenler.length],
      ['Atama dosyası sayısı', parcaSayisi],
      [''],
      ['Eşleşmeyen nedenleri', ''],
      ...[...neden].sort((a, b) => b[1] - a[1]),
      [''],
      ['Atama üretilmeyen sebepleri', ''],
      ...[...uretilmeyen],
    ],
    Eşleşmeyen: [['Satır No', 'Sicil No', 'Servis', 'Durak', 'Neden'], ...sonuc.eslesmeyenler.map((e) => [e.satirNo, e.sicil, e.servis, e.durak, e.neden])],
    'Atama üretilmeyen': [['Satır No', 'Sicil No', 'Servis', 'Durak', 'Sebep'], ...sonuc.atamaUretilmeyenler.map((u) => [u.satirNo, u.sicil, u.servis, u.durak, u.sebep])],
  })
  // Konsola yalnız SAYILAR (log'a kişisel veri yok)
  console.log(`atama=${sonuc.atamalar.length} eslesmeyen=${sonuc.eslesmeyenler.length} atamaUretilmeyen=${sonuc.atamaUretilmeyenler.length} dosya=${parcaSayisi}`)
}

main()
