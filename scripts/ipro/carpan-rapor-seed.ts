/**
 * carpan-rapor-seed.ts — Rapor motorunda "IPRO Sayım Karşılaştırma" (IPRO-002) şablonunu kurar.
 * RaporVeriSeti (postgres kaynak; carpanBul çözümü SQL'de COALESCE ile tezgahlı>tezgahsız>1) + RaporSablon.
 * MAS kaynaklı KAPALI loglar: plcAdet, carpanBul, plcAdet×çarpan, MAS Amount, masCarpan, oran, çarpan tutuyor.
 * İdempotent (ad/kod ile upsert). Tarih parametreli (baslangic/bitis), etkileşimli görünüm → Excel açık.
 *
 * VARSAYILAN DRY-RUN. Yazma: --apply (+ dev dışı --prod-onay).
 *   npx tsx scripts/ipro/carpan-rapor-seed.ts
 *   DATABASE_URL=<prod> npx tsx scripts/ipro/carpan-rapor-seed.ts --apply --prod-onay
 */
import { createPrisma, banner, summary, isEntry } from './_lib'

const APPLY = process.argv.includes('--apply')
const VERI_SETI_AD = 'ipro_sayim_karsilastirma'
const SABLON_KOD = 'IPRO-002'

// carpanBul SQL karşılığı: tezgahlı satır > tezgahsız (NULL) satır > 1.
const SORGU = `SELECT l."bitirildiAt"::date AS tarih, t.kod AS tezgah, l."ifsPartNo" AS parca, l."ifsOperationNo" AS op,
  l."plcAdet" AS plc_adet,
  COALESCE(cz.carpan, cg.carpan, 1) AS carpan_bul,
  l."plcAdet" * COALESCE(cz.carpan, cg.carpan, 1) AS hesap_adet,
  l."uretimAdet" AS mas_amount,
  l."masCarpan" AS mas_carpan,
  CASE WHEN l."uretimAdet" > 0 THEN round((l."plcAdet" * COALESCE(cz.carpan, cg.carpan, 1))::numeric / NULLIF(l."uretimAdet",0), 3) END AS oran,
  CASE WHEN COALESCE(cz.carpan, cg.carpan, 1) = l."masCarpan" THEN 'EVET' ELSE 'HAYIR' END AS carpan_tutuyor
FROM ipro_production_log l
JOIN ipro_tezgah t ON t.id = l."tezgahId"
LEFT JOIN ipro_sayac_carpani cz ON cz."parcaNo" = l."ifsPartNo" AND cz."operasyonNo" = l."ifsOperationNo"::text AND cz."tezgahKod" = t.kod
LEFT JOIN ipro_sayac_carpani cg ON cg."parcaNo" = l."ifsPartNo" AND cg."operasyonNo" = l."ifsOperationNo"::text AND cg."tezgahKod" IS NULL
WHERE l.kaynak = 'MAS' AND l.durum = 'KAPALI' AND l."bitirildiAt" >= $1 AND l."bitirildiAt" < $2
  AND l."plcAdet" IS NOT NULL AND l."ifsPartNo" IS NOT NULL AND l."ifsOperationNo" IS NOT NULL
ORDER BY l."bitirildiAt" DESC`

const TANIM = {
  alanlar: {
    tarih: 'sk.tarih', tezgah: 'sk.tezgah', parca: 'sk.parca', op: 'sk.op',
    plcAdet: 'sk.plc_adet', carpanBul: 'sk.carpan_bul', hesapAdet: 'sk.hesap_adet',
    masAmount: 'sk.mas_amount', masCarpan: 'sk.mas_carpan', oran: 'sk.oran', carpanTutuyor: 'sk.carpan_tutuyor',
  },
  birlestir: [] as unknown[],
  kaynaklar: [{ ad: 'sk', tip: 'postgres', sorgu: SORGU, parametreler: ['baslangic', 'bitis'] }],
}

const ICERIK = {
  tur: 'etkilesimli',
  baslik: 'IPRO Sayım Karşılaştırma',
  altBaslik: 'MAS kaynaklı kapalı işler: PLC×çarpan vs MAS Amount (çarpan doğrulama)',
  kategori: 'IPRO',
  gorunum: {
    grafik: { fn: 'topla', deger: 'hesapAdet', grupla: 'carpanTutuyor' },
    gruplar: [] as unknown[],
    kolonlar: [
      { alan: 'tarih', baslik: 'Tarih', bicim: 'gg.aa.yyyy', gorunur: true },
      { alan: 'tezgah', baslik: 'Tezgah', gorunur: true },
      { alan: 'parca', baslik: 'Parça', gorunur: true },
      { alan: 'op', baslik: 'Op', gorunur: true },
      { alan: 'plcAdet', baslik: 'PLC adet', bicim: '#.##0', toplam: 'topla', gorunur: true },
      { alan: 'carpanBul', baslik: 'carpanBul', bicim: '#.##0', gorunur: true },
      { alan: 'hesapAdet', baslik: 'PLC×çarpan', bicim: '#.##0', toplam: 'topla', gorunur: true },
      { alan: 'masAmount', baslik: 'MAS Amount', bicim: '#.##0', toplam: 'topla', gorunur: true },
      { alan: 'masCarpan', baslik: 'MAS çarpan', bicim: '#.##0', gorunur: true },
      { alan: 'oran', baslik: 'Oran (PLC×çrp / MAS)', bicim: '#.##0,00', gorunur: true },
      { alan: 'carpanTutuyor', baslik: 'Çarpan tutuyor mu', gorunur: true },
    ],
    siralama: null,
    filtreler: {},
  },
  parametreler: [
    { ad: 'baslangic', tip: 'tarih', etiket: 'Başlangıç', zorunlu: true },
    { ad: 'bitis', tip: 'tarih', etiket: 'Bitiş', zorunlu: true },
  ],
}

async function main() {
  banner('IPRO-002 Sayım Karşılaştırma rapor şablonu', !APPLY)
  const { prisma, disconnect } = createPrisma()
  try {
    const mevcutVs = await prisma.raporVeriSeti.findUnique({ where: { ad: VERI_SETI_AD }, select: { id: true } })
    const mevcutSab = await prisma.raporSablon.findUnique({ where: { kod: SABLON_KOD }, select: { id: true } })
    console.log(`veri seti '${VERI_SETI_AD}': ${mevcutVs ? 'VAR (güncellenecek)' : 'YOK (oluşturulacak)'}`)
    console.log(`şablon '${SABLON_KOD}': ${mevcutSab ? 'VAR (güncellenecek)' : 'YOK (oluşturulacak)'}`)
    if (APPLY) {
      const vs = await prisma.raporVeriSeti.upsert({
        where: { ad: VERI_SETI_AD },
        create: { ad: VERI_SETI_AD, aciklama: 'IPRO PLC×çarpan vs MAS Amount karşılaştırma', tanim: TANIM as object },
        update: { tanim: TANIM as object },
        select: { id: true },
      })
      await prisma.raporSablon.upsert({
        where: { kod: SABLON_KOD },
        create: { kod: SABLON_KOD, ad: 'IPRO Sayım Karşılaştırma', aciklama: 'PLC×çarpan vs MAS Amount', veriSetiId: vs.id, icerik: ICERIK as object, durum: 'YAYINDA' },
        update: { veriSetiId: vs.id, icerik: ICERIK as object, durum: 'YAYINDA' },
      })
      console.log('✅ IPRO-002 kuruldu (YAYINDA)')
    }
    summary([['veri seti', VERI_SETI_AD], ['şablon', SABLON_KOD], ['kolon', ICERIK.gorunum.kolonlar.length], ['parametre', ICERIK.parametreler.length]])
    if (!APPLY) console.log('\nℹ️ DRY-RUN — yazma yok. Kurmak için: --apply (prod: --apply --prod-onay)')
    await disconnect()
  } catch (e) {
    await disconnect(); throw e
  }
}

if (isEntry('carpan-rapor-seed')) {
  main().catch((e) => { console.error('\n⛔ DUR:', e instanceof Error ? e.message : e); process.exitCode = 1 })
}
