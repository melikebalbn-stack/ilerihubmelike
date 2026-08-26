import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'
import {
  getWorkCenterDepartments,
  getWorkCenters,
  getWorkCenterResources,
} from '@/lib/ifs/work-center-departments'
import { getShopOrderOperations } from '@/lib/ifs/shop-order-operations'
import { listVardiyalar } from '@/lib/ipro/takvim'
import { isEmriWcDepartmanKoku } from '@/lib/ipro/departman-eslesme'
import { TerminalMenuClient } from './_client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'IPRO' }

// Üretim Terminali — ana menü (T1). Guard geçici: /uretim/bildirim ile aynı
// admin.system.manage kontrolü (ayrı iş). İlk ekran bölüm (departman) seçimi;
// her karta açık iş emri + tezgah sayısı iliştirilir. Alt akış (tezgah → iş emri)
// ayrı iş — ?dept yalnız yer tutucuya gider.
export default async function UretimTerminalPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; tezgah?: string }>
}) {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  const { dept, tezgah } = await searchParams
  const seciliDept = typeof dept === 'string' && dept.trim() ? dept.trim() : null
  const seciliTezgah = typeof tezgah === 'string' && tezgah.trim() ? tezgah.trim() : null

  // IFS "Bakım Atölyesi Bölümleri" — site (ILER2) için tüm bölümler (10 kayıt).
  let departmanlar: { kod: string; ad: string }[] = []
  let ifsError: string | null = null
  try {
    departmanlar = await getWorkCenterDepartments()
  } catch (e) {
    ifsError = e instanceof Error ? e.message : 'IFS verisi alınamadı'
  }
  const gecerliKodlar = new Set(departmanlar.map((d) => d.kod))

  // Açık iş emri sayısı — departman bazında. WC W-prefixliyse harf köküyle
  // (WPH01→WPH). Departmana bağlanamayan WC'ler (WYD, 502, 505, 90001) sayılmaz.
  // İş emri IFS'i ayrı hata yolunda: alınamazsa sayı 0 kalır, ekran yine açılır.
  const isEmriSayi = new Map<string, number>()
  try {
    const ops = await getShopOrderOperations({})
    for (const o of ops) {
      const kok = isEmriWcDepartmanKoku(o.isMerkezi)
      if (kok && gecerliKodlar.has(kok)) {
        isEmriSayi.set(kok, (isEmriSayi.get(kok) ?? 0) + 1)
      }
    }
  } catch {
    // iş emri sayısı yoksa rozet gösterilmez; bölüm listesi etkilenmez.
  }

  // IFS zinciri: departman (WorkCenterSet.DepartmentNo) → iş merkezi (WorkCenterNo)
  //   → kaynak (Reference_WorkCenterResource.ResourceId) → ipro_tezgah.kod (DOĞRU anahtar).
  // İki AYRI çağrı, AYRI hata yolu: kaynak alınamazsa tezgah sayıları 0, departman
  // listesi ve iş emri sayıları etkilenmez. Numerik ifsWorkCenterNo/ifsResourceId BAYAT,
  // kullanılmaz. Tezgah başına sorgu YOK.
  const wcMap = new Map<string, string>() // workCenterNo → departmentNo
  try {
    for (const w of await getWorkCenters()) {
      if (w.departmentNo) wcMap.set(w.workCenterNo, w.departmentNo)
    }
  } catch {
    // WC→departman alınamadı → kaynaklar departmana bağlanamaz, tezgah sayıları 0.
  }

  let kaynaklar: Awaited<ReturnType<typeof getWorkCenterResources>> = []
  try {
    kaynaklar = await getWorkCenterResources()
  } catch {
    // Kaynak listesi alınamadı → tezgah sayıları 0; ekran yine açılır.
  }

  // ipro_tezgah — kod (tr-TR küçük harf anahtar) → {kod, id, plcPinler}. TEK sorgu.
  // plcPinler: sinyalli bayrağı (PLC pini tanımlı mı — statik yapı). id: durum sorguları için.
  const iproByLower = new Map<string, { kod: string; id: string; plcPinler: number }>()
  const tezgahlar = await prisma.iproTezgah.findMany({
    select: { id: true, kod: true, _count: { select: { plcPinler: true } } },
  })
  for (const t of tezgahlar) {
    iproByLower.set(t.kod.toLocaleLowerCase('tr-TR'), {
      kod: t.kod,
      id: t.id,
      plcPinler: t._count.plcPinler,
    })
  }

  // Tezgah sayısı = departmandaki AKTİF kaynak sayısı (Objstate=Active).
  // IPRO eşleşmesi: ResourceId == ipro_tezgah.kod. IPRO'da olmayan aktif kaynak → teşhis.
  const tezgahSayi = new Map<string, number>()
  const deptEsleTezgahKodlari = new Set<string>() // canlı doluluk (M) için IPRO kodları
  let iproEksikKaynak = 0 // IFS'te aktif tanımlı ama IPRO karşılığı olmayan kaynak
  for (const r of kaynaklar) {
    if (r.objstate !== 'Active') continue
    const d = wcMap.get(r.workCenterNo)
    if (!d || !gecerliKodlar.has(d)) continue
    tezgahSayi.set(d, (tezgahSayi.get(d) ?? 0) + 1)
    const ipro = iproByLower.get(r.resourceId.toLocaleLowerCase('tr-TR'))
    if (ipro) deptEsleTezgahKodlari.add(ipro.kod)
    else iproEksikKaynak++
  }

  // Faz2 hareket — son 180 sn'de delta üreten DISTINCT tezgahKod. BAĞIMSIZ sorgu
  // (oee-pano-service KOPYASI; import DEĞİL). Poller yalnız delta>0 yazar. Hem canlı
  // doluluk (M) hem tezgah durum göstergesinde kullanılır. Hata → boş set, sayfa çökmez.
  const faz2Set = new Set<string>()
  try {
    const hareketli = await prisma.$queryRaw<{ tezgahKod: string }[]>`
      SELECT DISTINCT "tezgahKod" FROM ipro_sayac_okuma WHERE ts > now() - interval '180 seconds'
    `
    for (const r of hareketli) faz2Set.add(r.tezgahKod)
  } catch {
    // canlı sinyal alınamazsa doluluk 0 + durum 'bosta'; sayfa etkilenmez.
  }
  let calisanTezgah = 0
  for (const kod of deptEsleTezgahKodlari) if (faz2Set.has(kod)) calisanTezgah++

  // Zengin departman listesi — SIRALAMA getWorkCenterDepartments'tan (İSİM bazlı) korunur.
  const zenginDepartmanlar = departmanlar.map((d) => ({
    kod: d.kod,
    ad: d.ad,
    isEmri: isEmriSayi.get(d.kod) ?? 0,
    tezgah: tezgahSayi.get(d.kod) ?? 0,
  }))

  const seciliDeptAd = seciliDept
    ? (departmanlar.find((d) => d.kod === seciliDept)?.ad ?? '')
    : ''

  // Seçili departmanın tezgahları için DURUM göstergesi — TOPLU sorgular (tezgah başına YOK).
  // izleme/oee panosu kuralının KOPYASI (import değil): öncelik durusta > calisiyor > bosta.
  // Yalnız departman seçiliyken sorulur; her biri ayrı try/catch → düşerse o gösterge nötr.
  const acikDurusTezgahId = new Set<string>() // IproMachineDowntime bitis=null
  const acikIsTezgahId = new Set<string>() // IproProductionLog durum=ACIK + baslatildiAt
  if (seciliDept) {
    try {
      const rows = await prisma.iproMachineDowntime.findMany({
        where: { bitis: null },
        select: { tezgahId: true },
      })
      for (const r of rows) acikDurusTezgahId.add(r.tezgahId)
    } catch {
      // duruş alınamazsa 'durusta' işaretlenmez (kademe düşer).
    }
    try {
      const rows = await prisma.iproProductionLog.findMany({
        where: { durum: 'ACIK', baslatildiAt: { not: null } },
        select: { tezgahId: true },
      })
      for (const r of rows) acikIsTezgahId.add(r.tezgahId)
    } catch {
      // açık iş alınamazsa o kaynaktan 'calisiyor' gelmez (faz2 hâlâ geçerli).
    }
  }

  // Seçili departmanın tezgahları = o departmanın WC'lerine bağlı AKTİF kaynaklar.
  // IPRO eşleşmesi ResourceId==ipro_tezgah.kod (tr-TR). ResourceId'ye göre alfabetik.
  const seciliDeptTezgahlar = seciliDept
    ? kaynaklar
        .filter((r) => r.objstate === 'Active' && wcMap.get(r.workCenterNo) === seciliDept)
        .map((r) => {
          const ipro = iproByLower.get(r.resourceId.toLocaleLowerCase('tr-TR'))
          // IPRO tanımsızsa durum bilinmez (null). Değilse: durusta > calisiyor > bosta.
          const durum: 'calisiyor' | 'durusta' | 'bosta' | null = !ipro
            ? null
            : acikDurusTezgahId.has(ipro.id)
              ? 'durusta'
              : acikIsTezgahId.has(ipro.id) || faz2Set.has(ipro.kod)
                ? 'calisiyor'
                : 'bosta'
          return {
            resourceId: r.resourceId,
            description: r.description,
            workCenterNo: r.workCenterNo,
            iproTanimli: !!ipro,
            durum,
            sinyalli: ipro ? ipro.plcPinler > 0 : false,
          }
        })
        .sort((a, b) => a.resourceId.localeCompare(b.resourceId, 'tr'))
    : []
  const seciliDeptIsEmri = seciliDept ? (isEmriSayi.get(seciliDept) ?? 0) : 0

  // Vardiya tanımları (aktif) — client, canlı saatten şu ana denk geleni seçer.
  const vardiyalar = (await listVardiyalar())
    .filter((v) => v.aktif)
    .map((v) => ({
      kod: v.kod,
      ad: v.ad,
      baslangicSaat: v.baslangicSaat,
      bitisSaat: v.bitisSaat,
      ertesiGuneTasar: v.ertesiGuneTasar,
    }))

  return (
    <TerminalMenuClient
      operatorName={session.user.name ?? 'Operatör'}
      departmanlar={zenginDepartmanlar}
      calisanTezgah={calisanTezgah}
      iproEksikKaynak={iproEksikKaynak}
      vardiyalar={vardiyalar}
      seciliDept={seciliDept}
      seciliDeptAd={seciliDeptAd}
      seciliTezgah={seciliTezgah}
      tezgahlar={seciliDeptTezgahlar}
      seciliDeptIsEmri={seciliDeptIsEmri}
      ifsError={ifsError}
    />
  )
}
