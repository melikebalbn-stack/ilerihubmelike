/**
 * PERSONNEL-PUT-BEYAZ-LISTE doğrulama: gerçek kayıt, GET → form → PUT(dryRun) → karşılaştır.
 * YAZMAZ. Düzenleme ekranının (personnel/[id]/page.tsx) gövde kurma mantığı birebir taklit edilir.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { personelPutGovdesiniHazirla, IZINLI_ALANLAR } from '../src/lib/personnel/put-govde'

const GET_SELECT = {
  id: true, sicilNo: true, sinif: true, cinsiyet: true, adSoyad: true, yakaRengi: true, yakaDetayi: true,
  direktEndirekt: true, asansorMekanik: true, iseGirisTarihi: true, gorev: true, bolumDetay: true, bolum: true,
  birimSorumlusu: true, sorumlu2: true, sorumlu3: true, bolumMuduru: true, sorumlu1Id: true, sorumlu2Id: true, sorumlu3Id: true,
  masrafMerkezi: true, interKepMail: true, mailAdresi: true, ikametAdresi: true, denemeDegerlendirme: true, altiAyDegerlendirme: true,
  telefon: true, kanGrubu: true, serviceRoute: true, serviceStop: true, egitimYeri: true, egitimTipi: true, egitimAlani: true,
  mezuniyetYili: true, ilkYardimciBelgesi: true, kalfalikBelgesi: true, ustalikBelgesi: true, forkliftEhliyeti: true, vincEhliyeti: true,
  mykBelgesiTarihi: true, yanginSertifikasi: true, eTrans: true, ustaOgreticiBelgesi: true, emekli: true, engelli: true, aktif: true,
  azureAdId: true, azureAdEmail: true, createdAt: true, updatedAt: true, createdBy: true, jobApplicationId: true,
  jobApplication: { select: { id: true, applicationNumber: true, createdAt: true } },
  bedenProfili: { select: { ustBeden: true, altBeden: true, ayakkabiNo: true, eldivenNo: true, olcuTarihi: true, not: true } },
  employmentPeriods: { select: { id: true, girisTarihi: true, cikisTarihi: true }, orderBy: { girisTarihi: 'asc' as const } },
  // FK kolonları GET'te YOK ama karşılaştırma için okunur
  departmentId: true,
} as const

const norm = (v: unknown) => {
  if (v === undefined || v === '') return null
  if (v instanceof Date) return v.toISOString()
  return v
}

async function main() {
  const sicil = process.argv[2]
  // Aday: aktif, tarih/FK/beden alanları dolu bir kayıt (en çok dolu alanı olan)
  const aday = sicil
    ? await prisma.personnel.findFirst({ where: { sicilNo: sicil } })
    : (await prisma.$queryRawUnsafe<{ id: string }[]>(`
        select p.id from "Personnel" p
        left join "envanter_personel_beden_profili" b on b."personnelId" = p.id
        where p.aktif and p."sorumlu1Id" is not null and p."departmentId" is not null
          and p."mykBelgesiTarihi" is not null and b."personnelId" is not null
        order by (p."ilkYardimciBelgesi" is not null)::int + (p."kalfalikBelgesi" is not null)::int
               + (p."mezuniyetYili" is not null)::int + (p."telefon" is not null)::int desc
        limit 1`))[0]
  if (!aday) throw new Error('aday kayıt yok')

  // 1) GET (route'un select'i) + türetilmiş salt-okuma alanlar
  const g = await prisma.personnel.findUnique({ where: { id: aday.id }, select: GET_SELECT })
  if (!g) throw new Error('kayıt yok')
  const { departmentId: dbDepartmentId, ...getPayload } = g
  const json: Record<string, any> = { ...JSON.parse(JSON.stringify(getPayload)), employmentSummary: { years: 1 }, lastClosedPeriod: null, anaKoltuklar: [{ id: 'x' }] }

  // 2) Form state — page.tsx fetchData + applyBedenToForm birebir
  const formData: Record<string, any> = {}
  Object.entries(json).forEach(([k, v]) => {
    formData[k] = k === 'iseGirisTarihi' && v ? new Date(v as string).toISOString().slice(0, 10) : (v ?? '')
  })
  const bp = json.bedenProfili
  formData.ustBeden = bp?.ustBeden ?? ''; formData.altBeden = bp?.altBeden ?? ''; formData.ayakkabiNo = bp?.ayakkabiNo ?? ''
  formData.eldivenNo = bp?.eldivenNo ?? ''; formData.olcuTarihi = bp?.olcuTarihi ? String(bp.olcuTarihi).slice(0, 10) : ''; formData.bedenNot = bp?.not ?? ''

  // 3) handleSave gövdesi
  const { ustBeden, altBeden, ayakkabiNo, eldivenNo, olcuTarihi, bedenNot, bedenProfili, ...rest } = formData
  const putBody = { ...rest, beden: { ustBeden, altBeden, ayakkabiNo, eldivenNo, olcuTarihi, not: bedenNot } }
  console.log('PUT gövdesi anahtar sayısı:', Object.keys(putBody).length)

  // 4) dryRun boru hattı
  const { data, atilanAlanlar } = await personelPutGovdesiniHazirla(prisma, putBody, aday.id)
  console.log('yazılacak alan sayısı:', Object.keys(data).length, '| atılan:', atilanAlanlar.join(' '))

  // 5) alan bazında karşılaştırma: DB mevcut ↔ yazılacak
  const mevcut = await prisma.personnel.findUnique({ where: { id: aday.id } }) as Record<string, any>
  const alanlar = [...IZINLI_ALANLAR, 'departmentId', 'sorumlu1Id', 'sorumlu2Id', 'sorumlu3Id']
  let fark = 0, dolu = 0, bos = 0
  for (const k of alanlar) {
    const yazilacak = k in data ? norm(data[k]) : '<gönderilmedi>'
    const eski = norm(mevcut[k])
    if (yazilacak === '<gönderilmedi>') { console.log(`  ⚠ ${k}: gövdede yok (dokunulmaz)`); continue }
    eski === null ? bos++ : dolu++
    if (JSON.stringify(yazilacak) !== JSON.stringify(eski)) {
      fark++
      console.log(`  ✗ ${k}: ${JSON.stringify(eski)} → ${JSON.stringify(yazilacak)}`)
    }
  }
  const tarihler = ['iseGirisTarihi','denemeDegerlendirme','altiAyDegerlendirme','ilkYardimciBelgesi','kalfalikBelgesi','ustalikBelgesi','yanginSertifikasi','mykBelgesiTarihi']
  console.log('tarih alanları (mevcut → yazılacak, gün):')
  for (const k of tarihler) console.log(`   ${k.padEnd(20)} ${String(norm(mevcut[k])).slice(0,10).padEnd(12)} → ${String(norm(data[k])).slice(0,10)}`)
  console.log(`\nSONUÇ sicil=${mevcut.sicilNo}: karşılaştırılan ${alanlar.length} alan (dolu ${dolu}, null ${bos}) — FARK ${fark}`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
