import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'
import { getWorkCenterDepartments, getWorkCenters } from '@/lib/ifs/work-center-departments'
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
  searchParams: Promise<{ dept?: string }>
}) {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  const { dept } = await searchParams
  const seciliDept = typeof dept === 'string' && dept.trim() ? dept.trim() : null

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

  // IFS WorkCenterSet — WC → departman CANLI eşleme (sabit tablo YOK; kodlar yeniden
  // numaralanıyor). Tek çağrı, tezgah başına sorgu yok. AYRI hata yolu: alınamazsa
  // wcMap boş kalır → tezgah sayıları 0, sayfa çökmez; departman/iş emri etkilenmez.
  const wcMap = new Map<string, string>() // workCenterNo → departmentNo
  let wcMapAlindi = false
  try {
    for (const w of await getWorkCenters()) {
      if (w.departmentNo) wcMap.set(w.workCenterNo, w.departmentNo)
    }
    wcMapAlindi = true
  } catch {
    // IFS WC listesi alınamadı → tezgah sayıları 0, bayat-kod göstergesi de gizli.
  }

  // Tezgah sayısı — ipro_tezgah.ifsWorkCenterNo → IFS Map'inden departman.
  const tezgahSayi = new Map<string, number>()
  const deptEsleTezgahKodlari = new Set<string>() // departmana eşlenen tezgah kodları
  let bayatKod = 0 // ifsWorkCenterNo dolu AMA IFS WC listesinde YOK (senkron göstergesi)
  const tezgahlar = await prisma.iproTezgah.findMany({
    select: { kod: true, ifsWorkCenterNo: true },
  })
  for (const t of tezgahlar) {
    const wc = t.ifsWorkCenterNo?.trim()
    if (!wc) continue
    const d = wcMap.get(wc)
    if (d && gecerliKodlar.has(d)) {
      tezgahSayi.set(d, (tezgahSayi.get(d) ?? 0) + 1)
      deptEsleTezgahKodlari.add(t.kod)
    } else if (wcMapAlindi && !wcMap.has(wc)) {
      // WC dolu ama güncel IFS listesinde yok → bayat kod. (Yalnız liste ALINDIYSA sayılır.)
      bayatKod++
    }
  }

  // Canlı çalışan tezgah — son 180 sn'de ipro_sayac_okuma'da delta üreten DISTINCT
  // tezgah. BAĞIMSIZ sorgu (oee-pano-service kopyası; import DEĞİL). Poller yalnız
  // delta>0 yazar → 180 sn içinde satırı olan tezgah çalışıyor. Departmana eşlenmiş
  // olanları sayarız (M ≤ T). Hata → 0, sayfa çökmez.
  let calisanTezgah = 0
  try {
    const hareketli = await prisma.$queryRaw<{ tezgahKod: string }[]>`
      SELECT DISTINCT "tezgahKod" FROM ipro_sayac_okuma WHERE ts > now() - interval '180 seconds'
    `
    for (const r of hareketli) {
      if (deptEsleTezgahKodlari.has(r.tezgahKod)) calisanTezgah++
    }
  } catch {
    // canlı sinyal alınamazsa doluluk 0 gösterilir; sayfa etkilenmez.
  }

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
      bayatKod={bayatKod}
      vardiyalar={vardiyalar}
      seciliDept={seciliDept}
      seciliDeptAd={seciliDeptAd}
      ifsError={ifsError}
    />
  )
}
