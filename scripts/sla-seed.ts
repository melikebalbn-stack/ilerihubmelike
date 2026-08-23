/**
 * IT Ticket SLA — Faz 1b seed.
 *
 * Üç şeyi yazar:
 *   A) SystemSetting['sla_calisma_takvimi']  → çalışma takvimi ayarı (07:00-17:00,
 *      öğle 12:00-13:00, Cumartesi tatil, yarım gün 12:00'a kadar → 540 iş dk/gün)
 *   B) IproTatil                             → 2026'nın kalan resmî tatilleri
 *   C) TicketCategory.slaResponseMinutes /   → kategori bazlı SLA dakikaları
 *      slaResolutionMinutes                    (İŞ dakikası)
 *
 * VARSAYILAN DRY-RUN: `--apply` verilmedikçe HİÇBİR yazma yapmaz, yalnız ne
 * yazacağını basar. Tüm yazmalar upsert → tekrar çalıştırmak güvenli.
 *
 * Kategoriler NAME ile eşleştirilir. Bir kategori adı DB'de bulunamazsa script
 * DURUR (exit 1) — sessizce atlamak, SLA'sı hiç kurulmamış bir kategoriyi
 * fark edilmeden bırakırdı.
 *
 * Usage:
 *   npx tsx scripts/sla-seed.ts            # dry-run (varsayılan)
 *   npx tsx scripts/sla-seed.ts --apply    # gerçekten yaz
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { SLA_AYAR_KEY } from '../src/lib/sla'
import {
  VARSAYILAN_AYAR,
  gunSegmentleri,
  type SlaCalismaAyari,
} from '../src/lib/sla/calisma-takvimi'
import type { IproTatilTip } from '../src/lib/ipro/takvim-util'

const APPLY = process.argv.includes('--apply')

// ── A) Çalışma takvimi ayarı ────────────────────────────────────────────────

const AYAR: SlaCalismaAyari = {
  baslangicSaat: '07:00',
  bitisSaat: '17:00',
  ogleAraBaslangic: '12:00',
  ogleAraBitis: '13:00',
  cumartesiDurumu: 'TATIL',
  yarimGunBitisSaat: '12:00',
}

const BEKLENEN_GUNLUK_DK = 540

// ── B) 2026 kalan tatiller ──────────────────────────────────────────────────

const TATILLER: { tarih: string; tip: IproTatilTip; aciklama: string }[] = [
  { tarih: '2026-08-30', tip: 'TATIL', aciklama: 'Zafer Bayramı' },
  { tarih: '2026-10-28', tip: 'YARIM', aciklama: 'Cumhuriyet Bayramı Arifesi' },
  { tarih: '2026-10-29', tip: 'TATIL', aciklama: 'Cumhuriyet Bayramı' },
]

// ── C) Kategori SLA dakikaları (yanıt / çözüm, İŞ dakikası) ─────────────────

const KATEGORI_SLA: { name: string; response: number; resolution: number }[] = [
  { name: 'Ağ ve Bağlantı', response: 30, resolution: 270 },
  { name: 'IFS Problemleri', response: 60, resolution: 540 },
  { name: 'MAS Problemleri', response: 60, resolution: 540 },
  { name: 'IPro Problemleri', response: 60, resolution: 540 },
  { name: 'Syteline Problemleri', response: 120, resolution: 1080 },
  { name: 'ILERIHub Problemleri', response: 120, resolution: 1080 },
  { name: 'Yazılım Sorunları', response: 120, resolution: 1080 },
  { name: 'Donanım Sorunları', response: 120, resolution: 1080 },
  { name: 'Erişim Talepleri', response: 240, resolution: 1620 },
  { name: 'Diğer', response: 240, resolution: 1620 },
  { name: 'IFS Eğitim Talebi', response: 540, resolution: 4320 },
  { name: 'Grafik Tasarım İstekleri', response: 540, resolution: 4320 },
]

// ── Yardımcılar ─────────────────────────────────────────────────────────────

function gunlukIsDakikasi(ayar: SlaCalismaAyari): number {
  // 2026-08-24 Pazartesi — istisnasız normal bir çalışma günü
  const segmentler = gunSegmentleri(2026, 8, 24, new Map(), ayar)
  return segmentler.reduce((t, s) => t + (s.bit - s.bas), 0)
}

/** '2026-08-30' → o günün UTC gece yarısı (@db.Date ile tutarlı). */
function tarihDegeri(iso: string): Date {
  const [y, a, g] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, a - 1, g))
}

function baslik(s: string) {
  console.log(`\n${'─'.repeat(70)}\n${s}\n${'─'.repeat(70)}`)
}

// ── Ana akış ────────────────────────────────────────────────────────────────

async function main() {
  console.log(APPLY ? '⚠  APPLY MODU — DB YAZILACAK' : '🧪 DRY-RUN — hiçbir şey yazılmayacak (--apply ile yaz)')

  let yazilacak = 0

  // ── A ──
  baslik('A) SystemSetting — çalışma takvimi ayarı')

  const gunluk = gunlukIsDakikasi(AYAR)
  console.log(`  günlük iş süresi: ${gunluk} dk  (beklenen ${BEKLENEN_GUNLUK_DK})`)
  if (gunluk !== BEKLENEN_GUNLUK_DK) {
    console.error(`❌ Günlük iş süresi ${gunluk} dk, beklenen ${BEKLENEN_GUNLUK_DK}. Ayar hatalı — DURULDU.`)
    process.exit(1)
  }
  console.log(`  ✅ 07:00-17:00 (600) − öğle 12:00-13:00 (60) = 540`)

  const mevcutAyar = await prisma.systemSetting.findUnique({
    where: { key: SLA_AYAR_KEY },
    select: { value: true },
  })
  const yeniDeger = JSON.stringify(AYAR)
  console.log(`  key      : ${SLA_AYAR_KEY}`)
  console.log(`  mevcut   : ${mevcutAyar ? mevcutAyar.value : '(kayıt YOK — getSlaAyar varsayılana düşüyor)'}`)
  console.log(`  yazılacak: ${yeniDeger}`)
  if (!mevcutAyar || mevcutAyar.value !== yeniDeger) yazilacak++
  else console.log('  (değişiklik yok)')

  if (APPLY) {
    await prisma.systemSetting.upsert({
      where: { key: SLA_AYAR_KEY },
      update: { value: yeniDeger, category: 'sla' },
      create: { key: SLA_AYAR_KEY, value: yeniDeger, category: 'sla' },
    })
    console.log('  ✅ yazıldı')
  }

  // ── B ──
  baslik('B) IproTatil — 2026 kalan resmî tatiller')

  for (const t of TATILLER) {
    const tarih = tarihDegeri(t.tarih)
    const mevcut = await prisma.iproTatil.findUnique({
      where: { tarih },
      select: { tip: true, aciklama: true },
    })
    const durum = !mevcut
      ? 'YENİ'
      : mevcut.tip === t.tip && mevcut.aciklama === t.aciklama
        ? 'değişiklik yok'
        : `GÜNCELLENECEK (mevcut: ${mevcut.tip} "${mevcut.aciklama}")`
    console.log(`  ${t.tarih}  ${t.tip.padEnd(6)} ${t.aciklama.padEnd(30)} → ${durum}`)
    if (durum !== 'değişiklik yok') yazilacak++

    if (APPLY) {
      await prisma.iproTatil.upsert({
        where: { tarih },
        update: { tip: t.tip, aciklama: t.aciklama, yil: tarih.getUTCFullYear() },
        create: { tarih, tip: t.tip, aciklama: t.aciklama, yil: tarih.getUTCFullYear() },
      })
    }
  }
  if (APPLY) console.log('  ✅ yazıldı')

  // ── C ──
  baslik('C) TicketCategory — SLA dakikaları (İŞ dakikası)')

  const kategoriler = await prisma.ticketCategory.findMany({
    select: { id: true, name: true, slaResponseMinutes: true, slaResolutionMinutes: true },
  })
  const adaGore = new Map(kategoriler.map((k) => [k.name, k]))

  const eksik = KATEGORI_SLA.filter((k) => !adaGore.has(k.name)).map((k) => k.name)
  if (eksik.length > 0) {
    console.error('\n❌ Şu kategori adları DB\'de bulunamadı — DURULDU (sessiz atlama yok):')
    eksik.forEach((n) => console.error(`   - ${n}`))
    console.error('\n   DB\'deki kategoriler:')
    kategoriler.forEach((k) => console.error(`   - ${k.name}`))
    process.exit(1)
  }

  const kapsanmayan = kategoriler.filter((k) => !KATEGORI_SLA.some((s) => s.name === k.name))
  if (kapsanmayan.length > 0) {
    console.log('  ℹ  Listede OLMAYAN kategoriler (öncelik tabanına düşecekler):')
    kapsanmayan.forEach((k) => console.log(`     - ${k.name}`))
  }

  console.log(`  ${'kategori'.padEnd(26)} ${'yanıt'.padStart(6)} ${'çözüm'.padStart(7)}   durum`)
  for (const s of KATEGORI_SLA) {
    const k = adaGore.get(s.name)!
    const ayni = k.slaResponseMinutes === s.response && k.slaResolutionMinutes === s.resolution
    const durum = ayni
      ? 'değişiklik yok'
      : k.slaResponseMinutes === null && k.slaResolutionMinutes === null
        ? 'YENİ (şu an NULL)'
        : `GÜNCELLENECEK (mevcut ${k.slaResponseMinutes}/${k.slaResolutionMinutes})`
    console.log(`  ${s.name.padEnd(26)} ${String(s.response).padStart(6)} ${String(s.resolution).padStart(7)}   ${durum}`)
    if (!ayni) yazilacak++

    if (APPLY) {
      await prisma.ticketCategory.update({
        where: { id: k.id },
        data: { slaResponseMinutes: s.response, slaResolutionMinutes: s.resolution },
      })
    }
  }
  if (APPLY) console.log('  ✅ yazıldı')

  // ── Özet ──
  baslik('ÖZET')
  console.log(`  değişecek kayıt sayısı: ${yazilacak}`)
  console.log(`  kategori kapsamı      : ${KATEGORI_SLA.length}/${kategoriler.length}`)
  console.log(APPLY ? '  ✅ APPLY tamamlandı' : '  🧪 DRY-RUN — hiçbir şey yazılmadı. Yazmak için: --apply')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
