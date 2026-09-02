/**
 * IT Ticket — kategori SLA hedeflerini günceller (FAZ: SLA gevşetme).
 *
 * NEDEN: 01.09.2026 ölçümünde son 14 günün ihlalli 7 talebinin 7'si de YANIT
 * ihlaliydi ve hesap doğru çalışıyordu (tanınan iş dakikası = tanımlı bütçe).
 * Sorun motorda değil, bütçelerin kısalığındaydı (ör. "Ağ ve Bağlantı" yanıt
 * 30 dk). Bu script bütçeleri gerçekçi seviyeye çeker.
 *
 * KAPSAM: yalnız TicketCategory.slaResponseMinutes / slaResolutionMinutes.
 * MEVCUT açık taleplerin responseDueAt/resolutionDueAt alanlarına DOKUNULMAZ —
 * yeni hedefler yalnız yeni taleplere uygulanır (denetim izi bozulmasın).
 *
 * Ek adım: SystemSetting 'ticket_triage_email' seed'i (bildirim yönlendirme
 * zincirinin son halkası; kategori takım/atanan tanımlamamışsa buraya düşer).
 *
 * Kullanım:
 *   npx tsx scripts/update-ticket-sla-hedefleri.ts            # DRY-RUN (varsayılan)
 *   npx tsx scripts/update-ticket-sla-hedefleri.ts --apply    # gerçek yazım
 */
import { prisma } from '../src/lib/prisma'

const APPLY = process.argv.includes('--apply')

/** name → [yanıt dk, çözüm dk] */
const HEDEFLER: Record<string, [number, number]> = {
  'Ağ ve Bağlantı': [120, 540],
  'IFS Problemleri': [120, 1080],
  'MAS Problemleri': [120, 1080],
  'IPro Problemleri': [120, 1080],
  'Donanım Sorunları': [240, 1080],
  'Yazılım Sorunları': [240, 1620],
  'Syteline Problemleri': [240, 1620],
  'ILERIHub Problemleri': [240, 1620],
  'Erişim Talepleri': [240, 1080],
  'Diğer': [480, 2160],
  // Değişmiyor — yalnız teyit edilir.
  'IFS Eğitim Talebi': [540, 4320],
  'Grafik Tasarım İstekleri': [540, 4320],
}

const TRIAGE_KEY = 'ticket_triage_email'
const TRIAGE_VARSAYILAN = 'melih.dilben@ilerigroup.com'

async function main() {
  console.log(`mod: ${APPLY ? 'GERCEK YAZIM (--apply)' : 'DRY-RUN (yazma yok)'}\n`)

  const kategoriler = await prisma.ticketCategory.findMany({
    select: { id: true, name: true, slaResponseMinutes: true, slaResolutionMinutes: true },
    orderBy: { sortOrder: 'asc' },
  })

  const bilinmeyen = kategoriler.filter((k) => !(k.name in HEDEFLER)).map((k) => k.name)
  const eksik = Object.keys(HEDEFLER).filter((n) => !kategoriler.some((k) => k.name === n))
  if (bilinmeyen.length) console.warn(`⚠ tabloda olup listede olmayan kategori: ${bilinmeyen.join(', ')}`)
  if (eksik.length) console.warn(`⚠ listede olup tabloda olmayan kategori: ${eksik.join(', ')}`)

  console.log('kategori                       yanit(once->sonra)   cozum(once->sonra)   durum')
  let degisecek = 0
  for (const k of kategoriler) {
    const hedef = HEDEFLER[k.name]
    if (!hedef) continue
    const [yy, yc] = hedef
    const ay = k.slaResponseMinutes
    const ac = k.slaResolutionMinutes
    const fark = ay !== yy || ac !== yc
    if (fark) degisecek++
    console.log(
      `${k.name.padEnd(30)} ${String(ay).padStart(4)} -> ${String(yy).padEnd(6)}  ` +
      `${String(ac).padStart(5)} -> ${String(yc).padEnd(6)}  ${fark ? 'DEGISECEK' : 'ayni'}`,
    )
    if (APPLY && fark) {
      await prisma.ticketCategory.update({
        where: { id: k.id },
        data: { slaResponseMinutes: yy, slaResolutionMinutes: yc },
      })
    }
  }
  console.log(`\ndegisecek kategori: ${degisecek}/${kategoriler.length}`)

  // ── triage ayarı (idempotent) ────────────────────────────────────────────
  const mevcut = await prisma.systemSetting.findUnique({ where: { key: TRIAGE_KEY }, select: { value: true } })
  if (mevcut) {
    console.log(`triage ayari zaten var: ${TRIAGE_KEY} = ${mevcut.value}`)
  } else if (APPLY) {
    await prisma.systemSetting.create({
      data: { key: TRIAGE_KEY, value: TRIAGE_VARSAYILAN, category: 'ticket' },
    })
    console.log(`triage ayari OLUSTURULDU: ${TRIAGE_KEY} = ${TRIAGE_VARSAYILAN}`)
  } else {
    console.log(`triage ayari YOK -> --apply ile olusturulacak: ${TRIAGE_KEY} = ${TRIAGE_VARSAYILAN}`)
  }

  if (!APPLY) console.log('\nDRY-RUN — hicbir sey yazilmadi. Gercek kosu: --apply')
  await prisma.$disconnect()
}
main()
