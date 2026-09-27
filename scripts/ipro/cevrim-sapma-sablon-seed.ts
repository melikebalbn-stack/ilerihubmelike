/**
 * cevrim-sapma-sablon-seed.ts — Rapor motoru "IPRO Çevrim Sapma" veri seti + etkileşimli şablon (idempotent).
 * Veri seti (Postgres): IproProductionLog ⋈ IproOeeKaydi ⋈ IproTezgah; COKLU_IS hariç, uretimAdet>0.
 * Satır = bölüm × tezgah × parça × operasyon. Sıralama SQL'de |sapma|×toplam adet azalan.
 * Parametreler: başlangıç/bitiş tarihi (zorunlu). min iş sayısı SQL'de HAVING>=3 (motorda param-varsayılan yok);
 * bölüm süzgeci etkileşimli görünümde (filtreler). Excel export etkileşimli raporlarda açık (/raporlar/[id]/excel).
 *
 *   npx tsx scripts/ipro/cevrim-sapma-sablon-seed.ts                        # dev
 *   DATABASE_URL=<prod> npx tsx scripts/ipro/cevrim-sapma-sablon-seed.ts --prod-onay
 */
import { createPrisma } from './_lib'
import type { EtkilesimliIcerik, VeriSetiTanim } from '../../src/lib/rapor/tipler'
import type { Prisma } from '../../src/generated/prisma'

const VERI_SETI_AD = 'ipro_cevrim_sapma'
const SABLON_KOD = 'IPRO-001'

const tanim: VeriSetiTanim = {
  kaynaklar: [
    {
      ad: 'cs',
      tip: 'postgres',
      // COKLU_IS hariç, uretilenAdet>0, ideal (planlı çevrim) dolu. Satır: bölüm×tezgah×parça×operasyon.
      // planlı = medyan idealSaniyeAdet; ölçülen = medyan((planlı−duruş)/uretilen); sapma% = (planlı−ölçülen)/planlı.
      sorgu: `WITH g AS (
  SELECT t."masGrupAdi" AS bolum, t.kod AS tezgah, p."ifsPartNo" AS parca, p."ifsOperationNo" AS operasyon,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY k."idealSaniyeAdet") AS planli,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY (k."planliSaniye" - k."durusSaniye")::numeric / NULLIF(k."uretilenAdet",0)) AS olculen,
         count(*) AS is_sayisi, sum(k."uretilenAdet")::int AS toplam_adet, max(k."hesaplananAt")::date AS son_is
  FROM ipro_oee_kaydi k
  JOIN ipro_production_log p ON p.id = k."productionLogId"
  JOIN ipro_tezgah t ON t.id = p."tezgahId"
  WHERE k."hesapKaynagi" <> 'COKLU_IS' AND k."uretilenAdet" > 0 AND k."idealSaniyeAdet" IS NOT NULL
    AND k."hesaplananAt" >= $1 AND k."hesaplananAt" < $2
  GROUP BY 1,2,3,4
  HAVING count(*) >= 3
)
SELECT bolum, tezgah, parca, operasyon,
       round(planli::numeric,1) AS planli_cevrim_sn,
       round(olculen::numeric,1) AS olculen_cevrim_sn,
       CASE WHEN planli <= 1 THEN 'TANIMSIZ' WHEN olculen > planli THEN 'YAVAŞ' ELSE 'HIZLI' END AS durum,
       round((olculen / NULLIF(planli,0))::numeric,2) AS oran,
       is_sayisi, toplam_adet, son_is
FROM g
ORDER BY (CASE WHEN planli <= 1 THEN 0 ELSE 1 END),
         CASE WHEN planli <= 1 THEN toplam_adet
              ELSE abs(ln(NULLIF(abs(olculen / NULLIF(planli,0)),0))) * toplam_adet END DESC NULLS LAST`,
      parametreler: ['baslangic', 'bitis'],
    },
  ],
  birlestir: [],
  alanlar: {
    bolum: 'cs.bolum', tezgah: 'cs.tezgah', parca: 'cs.parca', operasyon: 'cs.operasyon',
    planliCevrim: 'cs.planli_cevrim_sn', olculenCevrim: 'cs.olculen_cevrim_sn',
    durum: 'cs.durum', oran: 'cs.oran',
    isSayisi: 'cs.is_sayisi', toplamAdet: 'cs.toplam_adet', sonIs: 'cs.son_is',
  },
}

const icerik: EtkilesimliIcerik = {
  tur: 'etkilesimli',
  baslik: 'IPRO Çevrim Sapma',
  kategori: 'IPRO',
  altBaslik: 'Planlı vs ölçülen çevrim (bölüm × tezgah × parça × operasyon)',
  parametreler: [
    { ad: 'baslangic', tip: 'tarih', etiket: 'Başlangıç', zorunlu: true },
    { ad: 'bitis', tip: 'tarih', etiket: 'Bitiş', zorunlu: true },
  ],
  gorunum: {
    kolonlar: [
      { alan: 'bolum', baslik: 'Bölüm', gorunur: true },
      { alan: 'tezgah', baslik: 'Tezgah', gorunur: true },
      { alan: 'parca', baslik: 'Parça', gorunur: true },
      { alan: 'operasyon', baslik: 'Op', gorunur: true },
      { alan: 'durum', baslik: 'Durum', gorunur: true },
      { alan: 'planliCevrim', baslik: 'Planlı çevrim (sn)', gorunur: true, bicim: '#.##0,00' },
      { alan: 'olculenCevrim', baslik: 'Ölçülen çevrim (sn)', gorunur: true, bicim: '#.##0,00' },
      { alan: 'oran', baslik: 'Ölçülen/Planlı', gorunur: true, bicim: '#.##0,00' },
      { alan: 'isSayisi', baslik: 'İş sayısı', gorunur: true, toplam: 'topla', bicim: '#.##0' },
      { alan: 'toplamAdet', baslik: 'Toplam adet', gorunur: true, toplam: 'topla', bicim: '#.##0' },
      { alan: 'sonIs', baslik: 'Son iş', gorunur: true, bicim: 'gg.aa.yyyy' },
    ],
    gruplar: [],
    siralama: null, // SQL sırası korunur (|sapma| × toplam adet azalan)
    filtreler: {}, // Durum/bölüm süzgeci görünümde kolon bazında (durum kolonu görünür → süzgeç aktif)
    grafik: { grupla: 'durum', deger: 'toplamAdet', fn: 'topla' },
  },
}

const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue

async function main() {
  const { prisma, disconnect } = createPrisma()
  try {
    const veriSeti = await prisma.raporVeriSeti.upsert({
      where: { ad: VERI_SETI_AD },
      create: { ad: VERI_SETI_AD, aciklama: 'IPRO çevrim sapma: planlı vs ölçülen çevrim (OEE kaydı)', tanim: json(tanim), onbellekSn: 300, aktif: true },
      update: { aciklama: 'IPRO çevrim sapma: planlı vs ölçülen çevrim (OEE kaydı)', tanim: json(tanim), aktif: true },
    })
    const sablon = await prisma.raporSablon.upsert({
      where: { kod: SABLON_KOD },
      create: { kod: SABLON_KOD, ad: 'IPRO Çevrim Sapma', aciklama: 'Etkileşimli: bölüm×tezgah×parça×operasyon planlı-ölçülen çevrim sapması', veriSetiId: veriSeti.id, icerik: json(icerik), durum: 'YAYINDA', izinAnahtari: null },
      update: { ad: 'IPRO Çevrim Sapma', aciklama: 'Etkileşimli: bölüm×tezgah×parça×operasyon planlı-ölçülen çevrim sapması', veriSetiId: veriSeti.id, icerik: json(icerik), durum: 'YAYINDA', izinAnahtari: null },
    })
    console.log(`Veri seti: ${veriSeti.ad} id=${veriSeti.id}`)
    console.log(`Şablon:    ${sablon.kod} id=${sablon.id} durum=${sablon.durum}`)
    console.log(`URL: /raporlar/${sablon.id}`)
    await disconnect()
  } catch (e) {
    await disconnect()
    throw e
  }
}

main().catch((e) => { console.error('\n⛔ DUR:', e instanceof Error ? e.message : e); process.exitCode = 1 })
