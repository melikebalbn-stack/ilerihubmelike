/**
 * IFS → ILERIHub tezgah hizalama.
 *
 * YÖN: IFS güncel ve doğru kaynak, MAS eski. (Önceki "ILERIHub→IFS" kararı
 * iptal edildi — 19.07.2026.)
 *
 * AŞAMALI. Bu turda YAZDIKLARI:
 *   b) IFS'te olup bizde olmayan makine → ILERIHub'a EKLE. Kod, IFS
 *      açıklamasındaki MAS kodundan ("MM04 - MATKAP1" → MM04); kod deseni
 *      yoksa ResourceId kod olarak kullanılır. ifsResourceId + ifsWorkCenterNo
 *      dolu gelir.
 *   c) Sıfır-dolgu şüphelisi (PH011 ↔ PH11) → MEVCUT kayda IFS alanları
 *      yazılır, mükerrer yeni kayıt AÇILMAZ.
 *   d) Eşleşen kayıtlara ifsResourceId/ifsWorkCenterNo BACKFILL — yalnız BOŞ
 *      olanlara. Prod'da bu alanların tamamı boştu (backfill hiç koşmamış).
 *
 * BU TURDA YAPMADIĞI:
 *   a) IFS'te olmayan tezgahların pasifleştirilmesi ERTELENDİ. Aday listesi
 *      /home/rokunet/projects/tezgah-pasifleme-adaylari.md dosyasına yazılır.
 *      Gerekçe: 111 adayın 110'unun operatör eşlemesi, 33'ünün PLC pini var —
 *      "ölü kayıt" profili değil. IFS kapsam sorusu netleşmeden pasiflenmez.
 *
 * Planlama WC'leri (WMM01, WYD, FSN…) ve fason kayıtları (9000x) makine
 * değildir — hizalamaya HİÇ girmez.
 *
 * VARSAYILAN KURU KOŞU. Yazmak için --uygula (+ dev dışı hedefte --prod-onay).
 *
 *   npx tsx --env-file=/home/rokunet/projects/ilerihub-terminal/.env --env-file=.env \
 *     scripts/ipro/ifs-tezgah-hizala.ts [--uygula]
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../../src/generated/prisma'
import { hedefDbGuard } from './_guard'
import {
  startsWithKod, kodCikar, sifirsiz, makineDegil, adCikar,
  type IfsResource,
} from '../../src/lib/ipro/tezgah-esleme'

const UYGULA = process.argv.includes('--uygula')

async function ifsResources(): Promise<IfsResource[]> {
  for (const k of ['IFS_INT_BASE_URL', 'IFS_TOKEN_URL', 'IFS_CLIENT_ID', 'IFS_CLIENT_SECRET']) {
    if (!process.env[k]) throw new Error(`DUR: ${k} env yok`)
  }
  const MAIN = process.env.IFS_INT_BASE_URL!.replace(/[A-Za-z]+\.svc\/?$/, '').replace('/int/', '/main/')
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.IFS_CLIENT_ID!,
    client_secret: process.env.IFS_CLIENT_SECRET!,
  })
  if (process.env.IFS_SCOPE) body.set('scope', process.env.IFS_SCOPE)
  const tr = await fetch(process.env.IFS_TOKEN_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!tr.ok) throw new Error(`DUR: IFS token alınamadı (HTTP ${tr.status})`)
  const token = ((await tr.json()) as { access_token?: string }).access_token
  const r = await fetch(
    `${MAIN}WorkCenterHandling.svc/Reference_WorkCenterResource?$filter=Contract eq 'ILER2'&$top=1000`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (r.status !== 200) throw new Error(`DUR: Reference_WorkCenterResource HTTP ${r.status}`)
  const v = ((await r.json()) as { value?: Record<string, unknown>[] }).value ?? []
  return v
    .map((x) => ({
      rid: String(x.ResourceId ?? '').trim(),
      wc: String(x.WorkCenterNo ?? '').trim(),
      desc: String(x.Description ?? '').trim(),
    }))
    .filter((x) => x.rid)
}

async function main() {
  const url = hedefDbGuard()
  console.log(`DB: ${url.replace(/:\/\/[^@]*@/, '://***@')}   MOD: ${UYGULA ? 'UYGULA (YAZAR)' : 'KURU KOŞU'}\n`)

  const pool = new Pool({ connectionString: url })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    const tezgahlar = await prisma.iproTezgah.findMany({
      select: {
        id: true, kod: true, ad: true, aktif: true, masGrupAdi: true,
        ifsResourceId: true, ifsWorkCenterNo: true,
        _count: { select: { operatorler: true, kiosklar: true, uretimKayit: true, plcPinler: true } },
      },
      orderBy: { kod: 'asc' },
    })
    const kods = tezgahlar.map((t) => t.kod)
    const kodSet = new Set(kods)
    const ifsHepsi = await ifsResources()
    const makineler = ifsHepsi.filter((r) => !makineDegil(r))
    const hariç = ifsHepsi.filter(makineDegil)

    console.log(`ILERIHub tezgah : ${tezgahlar.length}`)
    console.log(`IFS kaynağı     : ${ifsHepsi.length}  (makine ${makineler.length}, hariç ${hariç.length})\n`)

    // ── Eşleştirme ──
    const byKod = new Map<string, IfsResource[]>()
    const eslesmeyenIfs: IfsResource[] = []
    for (const r of makineler) {
      const adaylar = kods.filter((k) => startsWithKod(r.desc, k))
      if (!adaylar.length) { eslesmeyenIfs.push(r); continue }
      const kod = adaylar.reduce((a, b) => (b.length > a.length ? b : a))
      if (!byKod.has(kod)) byKod.set(kod, [])
      byKod.get(kod)!.push(r)
    }

    // ── (c) sıfır-dolgu şüphelileri: mevcut kayda bağlanacak ──
    const baglanacak: { tezgah: (typeof tezgahlar)[0]; r: IfsResource; ifsKod: string }[] = []
    const eklenecekAdaylar: IfsResource[] = []
    for (const r of eslesmeyenIfs) {
      const k = kodCikar(r.desc)
      const sade = k ? sifirsiz(k) : null
      if (sade && kodSet.has(sade)) {
        baglanacak.push({ tezgah: tezgahlar.find((t) => t.kod === sade)!, r, ifsKod: k! })
      } else {
        eklenecekAdaylar.push(r)
      }
    }

    // ── (b) eklenecekler: kod türet ──
    const eklenecek = eklenecekAdaylar.map((r) => {
      const k = kodCikar(r.desc)
      const kod = k && !kodSet.has(k) ? k : r.rid
      const ad = adCikar(r.desc)
      return { kod, ad, r, kodKaynagi: k && !kodSet.has(k) ? 'açıklama' : 'ResourceId' }
    })

    // ── (a) pasiflenecekler ──
    const baglananKodlar = new Set(baglanacak.map((b) => b.tezgah.kod))
    const pasiflenecek = tezgahlar.filter((t) => t.aktif && !byKod.has(t.kod) && !baglananKodlar.has(t.kod))

    // ── RAPOR ──
    // (d) eşleşen ve alanı BOŞ olanlar → backfill hedefi
    const backfillHedefi: { tezgah: (typeof tezgahlar)[0]; r: IfsResource }[] = []
    for (const [kod, kaynaklar] of byKod) {
      const t = tezgahlar.find((x) => x.kod === kod)!
      const r = kaynaklar[0]
      if (!t.ifsResourceId || !t.ifsWorkCenterNo) backfillHedefi.push({ tezgah: t, r })
    }

    console.log('═══ ÖZET ═══')
    console.log(`  (b) EKLENECEK makine         : ${eklenecek.length}`)
    console.log(`  (c) BAĞLANACAK şüpheli       : ${baglanacak.length}`)
    console.log(`  (d) BACKFILL (eşleşen, alanı boş) : ${backfillHedefi.length} / ${byKod.size}`)
    console.log(`  (a) pasifleme ERTELENDİ — aday   : ${pasiflenecek.length} (dosyaya yazılır)`)
    console.log(`      hizalamaya girmeyen IFS  : ${hariç.length} (planlama WC + fason)`)

    const kioskEtkilenen = pasiflenecek.filter((t) => t._count.kiosklar > 0)
    const uretimGecmisli = pasiflenecek.filter((t) => t._count.uretimKayit > 0)
    console.log(`\n  ⚠ pasiflenecekler içinde KİOSK'a bağlı : ${kioskEtkilenen.length}`)
    console.log(`  ℹ pasiflenecekler içinde üretim kaydı olan : ${uretimGecmisli.length}`)
    console.log(`  ℹ pasiflenecek tezgahlardaki operatör eşlemesi: ${pasiflenecek.reduce((a, t) => a + t._count.operatorler, 0)} (KORUNUR)`)

    if (kioskEtkilenen.length) {
      console.log('\n═══ ⚠ KİOSK BAĞLARI ELDEN GEÇİRİLMELİ ═══')
      for (const t of kioskEtkilenen) console.log(`  ${t.kod.padEnd(10)} ${t.ad.slice(0, 40).padEnd(42)} kiosk=${t._count.kiosklar}`)
    }

    console.log(`\n═══ (b) EKLENECEK MAKİNELER (${eklenecek.length}) ═══`)
    for (const e of eklenecek) {
      console.log(`  ${e.kod.padEnd(10)} rid=${e.r.rid.padEnd(8)} wc=${(e.r.wc || '—').padEnd(6)} [kod: ${e.kodKaynagi}]  ${e.ad.slice(0, 40)}`)
    }

    console.log(`\n═══ (c) BAĞLANACAK ŞÜPHELİLER (${baglanacak.length}) ═══`)
    for (const b of baglanacak) {
      console.log(`  ${b.tezgah.kod.padEnd(8)} ← IFS ${b.ifsKod.padEnd(8)} rid=${b.r.rid} wc=${b.r.wc}`)
      console.log(`     bizdeki ad: ${b.tezgah.ad.slice(0, 46)}`)
      console.log(`     IFS  açıkl: ${b.r.desc.slice(0, 46)}`)
    }

    console.log(`\n═══ (d) BACKFILL EDİLECEKLER (${backfillHedefi.length}) ═══`)
    for (const b of backfillHedefi.slice(0, 20)) {
      console.log(`  ${b.tezgah.kod.padEnd(10)} → rid=${b.r.rid} wc=${b.r.wc || '—'}`)
    }
    if (backfillHedefi.length > 20) console.log(`  … +${backfillHedefi.length - 20}`)

    // ── (a) pasifleme adayları: DOSYAYA (uygulanmaz) ──
    const md: string[] = []
    md.push('# Tezgah Pasifleme Adayları — BEKLEMEDE')
    md.push('')
    md.push('**Tarih:** 19.07.2026 · **Üretici:** `scripts/ipro/ifs-tezgah-hizala.ts` (kuru koşu)')
    md.push('')
    md.push('> **Bu liste UYGULANMADI.** IFS kaynak listesinde karşılığı olmayan tezgahlar.')
    md.push('> Pasifleme, IFS kapsam sorusu netleşene kadar ertelendi.')
    md.push('>')
    md.push('> **Neden ertelendi:** adayların çoğunun operatör eşlemesi ve bir kısmının PLC')
    md.push('> pini var — "ölü kayıt" profili değil. PLC pini bağlı bir makinenin sahada')
    md.push('> çalışmadığını varsaymak yanlış olur. Önce IFS kaynak listesinin neden eksik')
    md.push('> olduğu anlaşılmalı.')
    md.push('')
    md.push(`Aday: **${pasiflenecek.length}** · operatörü olan: **${pasiflenecek.filter((t) => t._count.operatorler > 0).length}** · sinyalli: **${pasiflenecek.filter((t) => t._count.plcPinler > 0).length}** · kiosk'a bağlı: **${pasiflenecek.filter((t) => t._count.kiosklar > 0).length}**`)
    md.push('')
    md.push('Pasiflense bile operatör eşlemeleri ve üretim geçmişi **korunur** (silme yok).')
    md.push('')
    md.push('| Kod | Ad | MAS Grubu | Operatör | Sinyal | Kiosk | Üretim kaydı | Pasiflensin mi? |')
    md.push('| --- | --- | --- | ---: | --- | ---: | ---: | --- |')
    for (const t of pasiflenecek) {
      md.push(
        `| ${t.kod} | ${t.ad.replace(/\|/g, '/')} | ${t.masGrupAdi ?? '—'} | ${t._count.operatorler} | ` +
          `${t._count.plcPinler > 0 ? 'sinyalli' : '—'} | ${t._count.kiosklar} | ${t._count.uretimKayit} |  |`,
      )
    }
    const fs = await import('fs')
    const dosya = '/home/rokunet/projects/tezgah-pasifleme-adaylari.md'
    fs.writeFileSync(dosya, md.join('\n'), 'utf-8')
    console.log(`\n═══ (a) PASİFLEME ERTELENDİ — aday listesi dosyaya yazıldı ═══`)
    console.log(`  ${dosya}  (${pasiflenecek.length} aday)`)

    if (!UYGULA) {
      console.log('\n--- KURU KOŞU: hiçbir şey yazılmadı. Uygulamak için --uygula ---')
      return
    }

    // ── UYGULAMA ──
    console.log('\n═══ UYGULANIYOR ═══')
    const sonuc = await prisma.$transaction(async (tx) => {
      // (a) PASİFLEME BİLİNÇLİ OLARAK YOK — ertelendi, aday listesi dosyada.
      let backfilled = 0
      for (const b of backfillHedefi) {
        await tx.iproTezgah.update({
          where: { id: b.tezgah.id },
          data: {
            ...(b.tezgah.ifsResourceId ? {} : { ifsResourceId: b.r.rid }),
            ...(b.tezgah.ifsWorkCenterNo ? {} : { ifsWorkCenterNo: b.r.wc || null }),
          },
        })
        backfilled++
      }
      let baglandi = 0
      for (const b of baglanacak) {
        await tx.iproTezgah.update({
          where: { id: b.tezgah.id },
          data: { ifsResourceId: b.r.rid, ifsWorkCenterNo: b.r.wc || null },
        })
        baglandi++
      }
      let eklendi = 0
      for (const e of eklenecek) {
        await tx.iproTezgah.create({
          data: {
            kod: e.kod,
            ad: e.ad,
            ifsResourceId: e.r.rid,
            ifsWorkCenterNo: e.r.wc || null,
            aktif: true,
          },
        })
        eklendi++
      }
      return { backfilled, baglandi, eklendi }
    })
    console.log(`  backfill   : ${sonuc.backfilled}`)
    console.log(`  bağlandı   : ${sonuc.baglandi}`)
    console.log(`  eklendi    : ${sonuc.eklendi}`)
    console.log(`  pasiflendi : 0  (ERTELENDİ — aday listesi dosyada)`)
    console.log(`\n  toplam tezgah: ${await prisma.iproTezgah.count()} (aktif ${await prisma.iproTezgah.count({ where: { aktif: true } })})`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(String(e).slice(0, 300))
  process.exit(1)
})
