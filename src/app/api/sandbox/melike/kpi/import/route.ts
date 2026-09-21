import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { YON_TERS, PERIYOT_TERS, ORAN_TERS } from '../excel-sablon'
import { ORG_UNIT_TO_PERSONNEL_BOLUM } from '../personel-map'

function tarihAyristir(v: unknown): Date | null {
  if (v instanceof Date) return v
  if (typeof v === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    return new Date(epoch.getTime() + v * 86400000)
  }
  if (typeof v === 'string' && v.trim()) {
    const m = v.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
    if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])))
  }
  return null
}

function metin(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

function sayi(v: unknown): number | null {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get('file') as File | null
  const orgUnitId = metin(form.get('orgUnitId'))
  if (!file || !orgUnitId) {
    return NextResponse.json({ error: 'Dosya ve departman zorunludur' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  const tanimSayfasi = wb.Sheets['KPI Tanımları']
  const olcumSayfasi = wb.Sheets['Ölçümler']
  const aksiyonSayfasi = wb.Sheets['Aksiyonlar']
  if (!tanimSayfasi) {
    return NextResponse.json({ error: '"KPI Tanımları" sayfası bulunamadı — şablonu kullandığından emin ol' }, { status: 400 })
  }

  const tanimSatirlari = XLSX.utils.sheet_to_json<Record<string, unknown>>(tanimSayfasi)
  const kpiIdByName = new Map<string, string>()
  let kpiSayisi = 0

  for (const row of tanimSatirlari) {
    const name = metin(row['KPI Adı'])
    if (!name) continue
    const kpi = await prisma.kPIDefinition.upsert({
      where: { orgUnitId_name: { orgUnitId, name } },
      update: {
        unit: metin(row['Birim']) || null,
        direction: YON_TERS[metin(row['Yön'])] ?? 'higher_is_better',
        frequency: PERIYOT_TERS[metin(row['Periyot'])] ?? 'monthly',
        gerceklesenEtiketi: metin(row['Gerçekleşen Etiketi']) || 'Gerçekleşen',
        hedefEtiketi: metin(row['Hedef Etiketi']) || 'Hedef',
        oranYonu: ORAN_TERS[metin(row['Oran Yönü'])] ?? 'G_H',
      },
      create: {
        orgUnitId,
        name,
        unit: metin(row['Birim']) || null,
        direction: YON_TERS[metin(row['Yön'])] ?? 'higher_is_better',
        frequency: PERIYOT_TERS[metin(row['Periyot'])] ?? 'monthly',
        gerceklesenEtiketi: metin(row['Gerçekleşen Etiketi']) || 'Gerçekleşen',
        hedefEtiketi: metin(row['Hedef Etiketi']) || 'Hedef',
        oranYonu: ORAN_TERS[metin(row['Oran Yönü'])] ?? 'G_H',
      },
    })
    kpiIdByName.set(name, kpi.id)
    kpiSayisi++
  }

  let olcumSayisi = 0
  if (olcumSayfasi) {
    const olcumSatirlari = XLSX.utils.sheet_to_json<Record<string, unknown>>(olcumSayfasi)
    for (const row of olcumSatirlari) {
      const kpiId = kpiIdByName.get(metin(row['KPI Adı']))
      const yil = sayi(row['Yıl'])
      const donem = sayi(row['Dönem'])
      if (!kpiId || !yil || !donem) continue
      await prisma.kPIMeasurement.upsert({
        where: { kpiId_year_month: { kpiId, year: yil, month: donem } },
        update: { target: sayi(row['Hedef']), actual: sayi(row['Gerçekleşen']) },
        create: { kpiId, year: yil, month: donem, target: sayi(row['Hedef']), actual: sayi(row['Gerçekleşen']) },
      })
      olcumSayisi++
    }
  }

  let aksiyonSayisi = 0
  let sorumluEslesen = 0
  const eslesmeyenSorumlular = new Set<string>()
  if (aksiyonSayfasi) {
    const bolum = ORG_UNIT_TO_PERSONNEL_BOLUM[orgUnitId]
    const personeller = bolum
      ? await prisma.personnel.findMany({ where: { bolum, aktif: true }, select: { id: true, adSoyad: true } })
      : []
    const personelIndex = new Map(personeller.map(p => [p.adSoyad.toLocaleUpperCase('tr').trim(), p.id]))

    const aksiyonSatirlari = XLSX.utils.sheet_to_json<Record<string, unknown>>(aksiyonSayfasi)
    for (const row of aksiyonSatirlari) {
      const kpiId = kpiIdByName.get(metin(row['KPI Adı']))
      const action = metin(row['Aksiyon'])
      if (!kpiId || !action) continue

      const sorumluAdi = metin(row['Sorumlu'])
      const sorumluPersonelId = sorumluAdi ? personelIndex.get(sorumluAdi.toLocaleUpperCase('tr')) ?? null : null
      if (sorumluAdi && sorumluPersonelId) sorumluEslesen++
      else if (sorumluAdi) eslesmeyenSorumlular.add(sorumluAdi)

      await prisma.kPIAction.create({
        data: {
          kpiId,
          reason: metin(row['Neden']) || null,
          action,
          sorumluPersonelId,
          startDate: tarihAyristir(row['Başlangıç Tarihi']),
          endDate: tarihAyristir(row['Bitiş Tarihi']),
          completionPercent: sayi(row['Tamamlanma %']) ?? 0,
          status: 'open',
        },
      })
      aksiyonSayisi++
    }
  }

  return NextResponse.json({
    kpiSayisi,
    olcumSayisi,
    aksiyonSayisi,
    sorumluEslesen,
    eslesmeyenSorumlular: Array.from(eslesmeyenSorumlular),
  })
}
