import 'server-only'
import { prisma } from '@/lib/prisma'
import {
  IfsPersonelError,
  pencereHatasiMi,
  listOrganizations,
  listPositions,
  listShopFloorEmployeeSites,
  getCompanyPerson,
  createCompanyPerson,
  getShopFloorEmployee,
  createShopFloorEmployee,
  getShopFloorEmployeeSite,
  createShopFloorEmployeeSite,
  blockShopFloorEmployeeSite,
} from '@/lib/ifs/personel'

/**
 * ILERIHub Personnel → IFS employee senkronu (gecelik).
 *
 * KAYNAK KÜME: aktif Personnel + sicilNo dolu + en az bir AKTİF IproOperatorTezgah
 * eşlemesi. Yani "kiosk'ta iş bildirebilecek" kişiler; tüm personel değil.
 *
 * Her katman idempotent: önce GET, yoksa POST. Var olan kayıt GÜNCELLENMEZ
 * (IFS tarafındaki elle düzeltmeler korunur).
 *
 * Eşleşmeyen bölüm/görev = ATLANIR (uydurma kod yazılmaz), rapora düşer.
 */

/** IFS'te labor class sabiti — üretim operatörleri (WMM = mekanik montaj havuzu). */
const PRIMARY_LABOR_CLASS = 'WMM'

export type SenkronSonuc = {
  dryRun: boolean
  taranan: number
  /** dryRun=true iken "yaratılacak" sayısı — hiçbir POST atılmamıştır. */
  yaratilan: number
  atlanan: number
  /** dryRun=true iken "pasiflenecek" sayısı. */
  pasiflenen: number
  /** Eksik katmanı olan her kayıt — kuru koşu raporunun gövdesi. */
  yaratilacaklar: Array<{
    sicilNo: string
    adSoyad: string
    orgCode: string
    posCode: string
    eksikKatmanlar: string[]
  }>
  pasiflenecekler: string[]
  eslesmeyenler: Array<{ sicilNo: string; adSoyad: string; alan: 'bolum' | 'gorev'; deger: string }>
  pencereHatalilar: Array<{ sicilNo: string; adSoyad: string; detay: string }>
  hatalilar: Array<{ sicilNo: string; adSoyad: string; detay: string }>
}

/** Türkçe-duyarlı katlama: eşleme karşılaştırması aksan/büyük-küçük farkına takılmasın. */
function normalize(s: string): string {
  return s
    .replace(/[ıİi]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** "AHMET YILMAZ KAYA" → { fname: 'AHMET YILMAZ', lname: 'KAYA' } (son token soyad). */
function adSoyadBol(adSoyad: string): { fname: string; lname: string } {
  const p = adSoyad.trim().split(/\s+/)
  if (p.length === 1) return { fname: p[0], lname: p[0] }
  return { fname: p.slice(0, -1).join(' '), lname: p[p.length - 1] }
}

function tarihYaz(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Eşleme çözücü: önce ILERIHub eşleme tablosu, sonra IFS'teki isim birebir eşleşmesi. */
function cozucuKur(dbEsleme: Map<string, string>, ifsIsimler: Map<string, string>) {
  return (deger: string): string | null => {
    const n = normalize(deger)
    return dbEsleme.get(n) ?? ifsIsimler.get(n) ?? null
  }
}

/**
 * @param dryRun IFS'e HİÇBİR yazma yapmaz (create/SetBlocked atlanır); yalnız
 *   okur ve ne yapılacağını hesaplar. NOT: geçerlilik penceresi hataları POST
 *   sırasında ortaya çıktığı için kuru koşuda GÖRÜNMEZ — pencereHatalilar boş kalır.
 */
export async function ifsPersonelSenkronu({ dryRun = false } = {}): Promise<SenkronSonuc> {
  const sonuc: SenkronSonuc = {
    dryRun,
    taranan: 0,
    yaratilan: 0,
    atlanan: 0,
    pasiflenen: 0,
    yaratilacaklar: [],
    pasiflenecekler: [],
    eslesmeyenler: [],
    pencereHatalilar: [],
    hatalilar: [],
  }

  // ── Eşleme tabloları ───────────────────────────────────────────────────
  const [eslemeler, orgListe, pozListe] = await Promise.all([
    prisma.iproIfsEslesme.findMany({ where: { aktif: true } }),
    listOrganizations(),
    listPositions(),
  ])

  const dbOrg = new Map<string, string>()
  const dbPoz = new Map<string, string>()
  for (const e of eslemeler) {
    ;(e.tip === 'ORG' ? dbOrg : dbPoz).set(normalize(e.ilerihubDeger), e.ifsKod)
  }
  const ifsOrg = new Map(orgListe.filter((o) => o.orgName).map((o) => [normalize(o.orgName), o.orgCode]))
  const ifsPoz = new Map(pozListe.filter((p) => p.positionTitle).map((p) => [normalize(p.positionTitle), p.posCode]))

  const cozOrg = cozucuKur(dbOrg, ifsOrg)
  const cozPoz = cozucuKur(dbPoz, ifsPoz)

  // ── Kaynak küme ────────────────────────────────────────────────────────
  // IproOperatorTezgah.personnelId FK'sız çıplak String (IPRO bloğu deseni) —
  // ilişki üzerinden filtrelenemez, iki adımda çözülür.
  const operatorEslemeleri = await prisma.iproOperatorTezgah.findMany({
    where: { aktif: true },
    select: { personnelId: true },
    distinct: ['personnelId'],
  })
  const operatorIds = operatorEslemeleri.map((o) => o.personnelId)

  const adaylar = await prisma.personnel.findMany({
    where: { aktif: true, sicilNo: { not: null }, id: { in: operatorIds } },
    select: { sicilNo: true, adSoyad: true, iseGirisTarihi: true, bolum: true, gorev: true },
    orderBy: { sicilNo: 'asc' },
  })
  sonuc.taranan = adaylar.length

  // ── Katmanları kur (sırayla — IFS yazma hızına saygı) ──────────────────
  for (const p of adaylar) {
    const sicilNo = p.sicilNo as string
    const { adSoyad } = p

    const orgCode = cozOrg(p.bolum)
    if (!orgCode) {
      sonuc.eslesmeyenler.push({ sicilNo, adSoyad, alan: 'bolum', deger: p.bolum })
      continue
    }
    const posCode = cozPoz(p.gorev)
    if (!posCode) {
      sonuc.eslesmeyenler.push({ sicilNo, adSoyad, alan: 'gorev', deger: p.gorev })
      continue
    }

    try {
      const eksikKatmanlar: string[] = []

      if (!(await getCompanyPerson(sicilNo))) {
        eksikKatmanlar.push('CompanyPerson')
        if (!dryRun) {
          const { fname, lname } = adSoyadBol(adSoyad)
          await createCompanyPerson({
            empNo: sicilNo,
            fname,
            lname,
            displayName: adSoyad,
            employmentDate: tarihYaz(p.iseGirisTarihi),
            orgCode,
            posCode,
          })
        }
      }

      // NOT (dryRun): katman 1 yaratılmadığı için 2/3 de "eksik" görünür — kuru
      // koşuda beklenen davranış, gerçek koşuda zincir sırayla dolar.
      if (!(await getShopFloorEmployee(sicilNo))) {
        eksikKatmanlar.push('ShopFloorEmployee')
        if (!dryRun) await createShopFloorEmployee(sicilNo)
      }

      if (!(await getShopFloorEmployeeSite(sicilNo))) {
        eksikKatmanlar.push('ShopFloorEmployeeSite')
        if (!dryRun) await createShopFloorEmployeeSite(sicilNo, PRIMARY_LABOR_CLASS)
      }

      if (eksikKatmanlar.length) {
        sonuc.yaratilan++
        sonuc.yaratilacaklar.push({ sicilNo, adSoyad, orgCode, posCode, eksikKatmanlar })
      } else {
        sonuc.atlanan++
      }
    } catch (err) {
      const detay = err instanceof IfsPersonelError ? err.detay : String(err)
      // Geçerlilik penceresi hataları ayrı sayılır: kod hatası değil, IFS'te
      // org/pozisyon ValidFrom'u personelin işe giriş tarihinden sonra başlıyor.
      if (pencereHatasiMi(detay)) sonuc.pencereHatalilar.push({ sicilNo, adSoyad, detay })
      else sonuc.hatalilar.push({ sicilNo, adSoyad, detay })
    }
  }

  // ── Pasifleştirme ──────────────────────────────────────────────────────
  // YALNIZ ILERIHub'ın bildiği sicil numaraları. IFS'te elle açılmış kayıtlara
  // (ör. IG002 referans çalışanı) ASLA dokunulmaz.
  const adaySicils = new Set(adaylar.map((a) => a.sicilNo as string))
  const tumPersonel = await prisma.personnel.findMany({
    where: { sicilNo: { not: null } },
    select: { sicilNo: true },
  })
  const bilinenSicils = new Set(tumPersonel.map((t) => t.sicilNo as string))

  const siteler = await listShopFloorEmployeeSites()
  for (const s of siteler) {
    if (!bilinenSicils.has(s.employeeId)) continue // ILERIHub dışı — dokunma
    if (adaySicils.has(s.employeeId)) continue // hâlâ yetkili
    if (s.objstate !== 'Active') continue // zaten pasif

    try {
      if (!dryRun) await blockShopFloorEmployeeSite(s.employeeId)
      sonuc.pasiflenen++
      sonuc.pasiflenecekler.push(s.employeeId)
    } catch (err) {
      const detay = err instanceof IfsPersonelError ? err.detay : String(err)
      sonuc.hatalilar.push({ sicilNo: s.employeeId, adSoyad: '(pasifleştirme)', detay })
    }
  }

  return sonuc
}
