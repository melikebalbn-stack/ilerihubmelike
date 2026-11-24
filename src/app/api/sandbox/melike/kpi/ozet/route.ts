import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const UST_BIRIM_ID = 'cmrzg1kqr00027jpe7y4egyt9'

interface OlcumBenzeri {
  year: number
  month: number
  target: number | null
  actual: number | null
  hedefNA: boolean
  gerceklesenNA: boolean
  manuelOran: number | null
}

interface KpiBenzeri {
  direction: string
  frequency: string
  oranYonu: string
  oranPayKaynagi: string
  oranBirimi: string
  measurements: OlcumBenzeri[]
  ozelAlanlar: { key: string; degerler: { year: number; month: number; value: number | null; naMi: boolean }[] }[]
}

function donemSayisi(frequency: string): number {
  return frequency === 'quarterly' ? 4 : 12
}

// KPI Özet'teki oran artık KPI Takip'in kendi "G/H Oran" (ya da oranYonu H_G ise H/G) satırıyla
// BİREBİR AYNI — aynı ay, aynı oranPayKaynagi/oranYonu/manuelOran kuralları, tek fark burada
// YILLIK tek bir sayıya indirgemek için o satırın bütün aylık değerlerinin ortalaması alınıyor.
// (Daha önce burada direction + yıllık ortalama bazlı, Takip'ten bağımsız ayrı bir hesap vardı —
// Melike bunun "Takip'teki ile Özet'teki sayı neden aynı değil" diye kafa karıştırdığını, iki
// farklı kuralın karmaşık olduğunu söyledi: tek kaynak, Takip'in kendi oranı kullanılsın istedi.
// Risk: oranYonu bir KPI'da yanlış ayarlıysa (ör. "Fazla Mesai" vakası) Özet de yanıltıcı
// görünür — bu artık bilinçli kabul edilen bir risk, ayrı bir güvenlik kontrolü yok.)
function kpiAylikOran(kpi: KpiBenzeri, year: number, month: number): number | null {
  const m = kpi.measurements.find(x => x.year === year && x.month === month)
  const ozelAlan = kpi.oranPayKaynagi === 'actual' ? null : kpi.ozelAlanlar.find(a => a.key === kpi.oranPayKaynagi)
  const ozelDeger = ozelAlan?.degerler.find(x => x.year === year && x.month === month)
  const gEsdeger = kpi.oranPayKaynagi === 'actual' ? m?.actual ?? null : ozelDeger?.value ?? null
  const gEsdegerNA = kpi.oranPayKaynagi === 'actual' ? m?.gerceklesenNA ?? false : ozelDeger?.naMi ?? false
  const target = m?.target ?? null
  const hedefNA = m?.hedefNA ?? false
  const payda = kpi.oranYonu === 'H_G' ? gEsdeger : target

  if (m?.manuelOran != null) return Math.round(m.manuelOran)
  if (hedefNA || gEsdegerNA) return 0
  if (target == null || gEsdeger == null || payda == null) return null
  if (payda === 0) return 0
  return Math.round((kpi.oranYonu === 'H_G' ? (target as number) / payda : (gEsdeger as number) / payda) * 100)
}

// KPI-OZET-UYARI: "Oran yönü" (G/H ya da H/G), KPI'nın "Yön"üyle (Yüksek iyi/Düşük iyi) TUTARLI
// olmalı — biri diğeriyle çelişirse (ör. "Düşük iyi" bir KPI'da G/H seçiliyse) hedefin üstüne
// çıkmak aslında kötüyken yüzde yapay olarak yükselip yeşil görünür (bkz. "Faturaların Ciroya
// Oranı" vakası). Melike bunu tek tek, KPI'yı düzenleyip bakmadan FARK EDEMEDİĞİNİ söyledi —
// bu yüzden her KPI için bu tutarsızlık burada hesaplanıp Özet listesinde işaretleniyor.
function oranYonuUyumsuzMu(kpi: { direction: string; oranYonu: string }): boolean {
  return (kpi.direction === 'higher_is_better' && kpi.oranYonu === 'H_G')
    || (kpi.direction === 'lower_is_better' && kpi.oranYonu === 'G_H')
}

// KPI-OZET-UYARI-YUZDE: birim "%" ve yuzdeOlcek "oran" (0-1 arası fraksiyon bekleniyor) ise,
// gerçekleşen değerler ×100 yapılıp gösteriliyor. Ama bazı KPI'larda değerler aslında DOĞRUDAN
// yüzde olarak girilmiş (ör. "67,25" = %67,25 niyetiyle) — bu durumda ×100 ile %6725 gibi saçma
// bir sayı çıkıyor (bkz. "Teklifin İşe Dönüş Oranı" vakası: 6.725%, 7.000%, 8.900% gibi aslında
// 1000'in üzerine çıkan "yüzdeler"). Kesin teşhis değil ama güçlü bir işaret: 0-1 oran bekleniyorsa
// gerçekleşen değerlerin 1'i (bazen biraz üstünü, aşırı başarı durumunda) geçmemesi beklenir —
// pek çok ayda belirgin şekilde 1'in üstündeyse muhtemelen aslında doğrudan yüzde girilmiş demektir.
function yuzdeOlcekSupheliMi(kpi: { unit: string | null; yuzdeOlcek: string; measurements: { actual: number | null }[] }): boolean {
  if ((kpi.unit ?? '').trim() !== '%' || kpi.yuzdeOlcek !== 'oran') return false
  const degerler = kpi.measurements.map(m => m.actual).filter((v): v is number => v != null)
  if (degerler.length === 0) return false
  const supheliSayisi = degerler.filter(v => Math.abs(v) > 1.5).length
  return supheliSayisi / degerler.length >= 0.5
}

function kpiYillikOran(kpi: KpiBenzeri, year: number): number | null {
  const degerler: number[] = []
  for (let ay = 1; ay <= donemSayisi(kpi.frequency); ay++) {
    const o = kpiAylikOran(kpi, year, ay)
    if (o != null) degerler.push(o)
  }
  return degerler.length > 0 ? degerler.reduce((t, o) => t + o, 0) / degerler.length : null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const istenenYil = searchParams.get('yil') ? Number(searchParams.get('yil')) : null

  const departmanlar = await prisma.orgUnit.findMany({
    where: { parentId: UST_BIRIM_ID, unitType: 'DEPARTMENT', isActive: true },
    select: { id: true, name: true },
    orderBy: { sortOrder: 'asc' },
  })

  const kpiler = await prisma.kPIDefinition.findMany({
    where: { orgUnitId: { in: departmanlar.map(d => d.id) } },
    include: { measurements: true, ozelAlanlar: { include: { degerler: true } } },
  })

  // Genel olarak veri olan tüm yıllar (yıl seçici için) — en yeniden en eskiye.
  const mevcutYillar = Array.from(new Set(kpiler.flatMap(k => k.measurements.map(m => m.year)))).sort((a, b) => b - a)
  // Yıl belirtilmediyse en güncel yıl neyse onu kullan — 2025+2026'yı karışık
  // ortalamak yerine, "genel başarı" hep TEK bir yılı yansıtsın.
  const aktifYil = istenenYil ?? mevcutYillar[0] ?? null

  const ozet = departmanlar.map(dept => {
    const deptKpiler = kpiler.filter(k => k.orgUnitId === dept.id)

    const kpiOranlari = deptKpiler
      .map(k => {
        if (aktifYil == null) return null
        const oran = kpiYillikOran(k, aktifYil)
        if (oran == null) return null
        const uyarilar: string[] = []
        if (oranYonuUyumsuzMu(k)) {
          uyarilar.push('"Oran yönü", KPI\'nın "Yön"üyle çelişiyor — görünen % yanıltıcı olabilir.')
        }
        if (yuzdeOlcekSupheliMi(k)) {
          uyarilar.push('"Yüzde değerleri nasıl giriliyor" muhtemelen yanlış — değerler çok büyük görünüyor, muhtemelen doğrudan yüzde girilmiş ama "0-1 arası oran" seçili.')
        }
        return {
          id: k.id,
          name: k.name,
          oran: Math.round(oran),
          oranBirimi: k.oranBirimi,
          uyarilar,
        }
      })
      .filter((x): x is { id: string; name: string; oran: number; oranBirimi: string; uyarilar: string[] } => x !== null)

    const genelOran = kpiOranlari.length > 0
      ? Math.round(kpiOranlari.reduce((t, k) => t + k.oran, 0) / kpiOranlari.length)
      : null

    const siraliAzalan = [...kpiOranlari].sort((a, b) => b.oran - a.oran)

    return {
      orgUnitId: dept.id,
      name: dept.name,
      kpiSayisi: deptKpiler.length,
      genelOran,
      // Tüm KPI'lar, en başarılıdan en başarısıza sıralı — arayüz top3'e de,
      // tam listeye de bu diziden bakabilir.
      kpiler: siraliAzalan,
    }
  })

  // Şirket geneli tek rakam — tüm departmanların tüm KPI oranları eşit ağırlıkla havuzlanır
  // (departman ortalamalarının ortalaması değil; büyük/küçük departman ayrımı yapmadan tüm KPI'lar eşit sayılır).
  const tumKpiOranlari = ozet.flatMap(d => d.kpiler.map(k => k.oran))
  const genelToplam = tumKpiOranlari.length > 0
    ? Math.round(tumKpiOranlari.reduce((t, o) => t + o, 0) / tumKpiOranlari.length)
    : null

  return NextResponse.json({ ozet, mevcutYillar, aktifYil, genelToplam })
}
