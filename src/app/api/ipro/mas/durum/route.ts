import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'
import { acikUretimler, acikOperatorler } from '@/lib/mas/uretim'
import { isEmirineGrupla, employeeNoToSicilNo, type MasUretimGirdi } from '@/lib/entegrasyon/mas/uretim-mapper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ipro/mas/durum — MAS→IPRO ayna DOĞRULAMA (SALT OKUMA, IPRO'ya YAZMA YOK).
// Açık MAS üretimlerini eşleme kurallarından geçirir; tezgah/personel eşleşmesini raporlar.
// Guard: ipro.admin.
export async function GET() {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  try {
    const [satirlar, operatorler, tezgahlar, personeller] = await Promise.all([
      acikUretimler(),
      acikOperatorler(),
      prisma.iproTezgah.findMany({ where: { aktif: true }, select: { kod: true } }),
      prisma.personnel.findMany({ select: { sicilNo: true } }),
    ])

    // Açık üretimin operatörü (ilk aktif ProductionUser) — masId → employeeNo.
    const opByMas = new Map<number, string>()
    for (const o of operatorler) if (o.employeeNo && !opByMas.has(o.masId)) opByMas.set(o.masId, o.employeeNo)

    const girdiler: MasUretimGirdi[] = satirlar.map((s) => ({
      masId: s.masId,
      tezgahKod: s.tezgahKod,
      employeeNo: opByMas.get(s.masId) ?? null,
      workOrderNo: s.workOrderNo,
      operasyonNo: s.operasyonNo,
      amount: s.amount,
      reportedAmount: s.reportedAmount,
      counterMultiplier: s.counterMultiplier,
      counterDivider: s.counterDivider,
      startDateTime: s.startDateTime ? s.startDateTime.toISOString() : null,
    }))
    const gruplar = isEmirineGrupla(girdiler)

    const tezgahSet = new Set(tezgahlar.map((t) => t.kod))
    const sicilSet = new Set(personeller.map((p) => p.sicilNo))

    // Eşleşmeyen tezgahlar: MAS WorkCenter.Code ipro_tezgah'ta yok.
    const eslesmeyenTezgahlar = [
      ...new Set(gruplar.map((g) => g.tezgahKod).filter((k): k is string => !!k && !tezgahSet.has(k))),
    ].sort()

    // Eşleşmeyen personeller: employeeNo → ILR-##### Personnel.sicilNo'da yok.
    const eslesmeyenPersoneller = [
      ...new Set(
        gruplar
          .map((g) => g.employeeNo)
          .filter((e): e is string => !!e)
          .filter((e) => {
            const sicil = employeeNoToSicilNo(e)
            return !sicil || !sicilSet.has(sicil)
          }),
      ),
    ].sort()

    const ornekler = gruplar.slice(0, 10).map((g) => {
      const sicil = employeeNoToSicilNo(g.employeeNo)
      return {
        workOrderNo: g.workOrderNo,
        tezgahKod: g.tezgahKod,
        tezgahEslesti: !!g.tezgahKod && tezgahSet.has(g.tezgahKod),
        employeeNo: g.employeeNo,
        sicilNo: sicil,
        personelEslesti: !!sicil && sicilSet.has(sicil),
        adet: g.adet,
        satirSayisi: g.satirSayisi,
      }
    })

    return NextResponse.json({
      ok: true,
      okunanSatir: satirlar.length,
      acikUretimSayisi: gruplar.length, // iş emri (WorkOrderNo) bazında benzersiz
      eslesmeyenTezgahlar,
      eslesmeyenPersoneller,
      ornekler,
    })
  } catch (e) {
    console.error('[mas-durum] hata', e)
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? 'MAS durum alınamadı' }, { status: 502 })
  }
}
