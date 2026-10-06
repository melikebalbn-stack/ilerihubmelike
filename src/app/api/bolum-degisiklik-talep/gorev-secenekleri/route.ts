// GET /api/bolum-degisiklik-talep/gorev-secenekleri?bolum=<ad>
//
// Talep formundaki "Yeni görev" açılır listesi: HEDEF BÖLÜMÜN org ağacındaki
// BOŞ kutuların unvanları. Serbest metin DEĞİL — koltuk eşleşmesi {bolum,gorev}
// çiftine baktığı için, şemada karşılığı olmayan bir unvan seçilirse koltuk yine
// taşınamazdı (06.10 ILR-00925 vakası).
//
// Kurul/komite kutuları (ORG-KR-*) listelenmez: onlar ek görev, ana koltuk değil.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { bolumTalepYetkisiCore } from '@/lib/bolum-talep/bolum-talep-yetki'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const yetki = await bolumTalepYetkisiCore(user.id, user.role, user.department)
    if (!yetki.erisebilir) {
      return NextResponse.json({ error: 'Bu forma erişim yetkiniz yok' }, { status: 403 })
    }

    const bolum = (request.nextUrl.searchParams.get('bolum') ?? '').trim()
    if (!bolum) return NextResponse.json({ secenekler: [] })

    const dept = await prisma.departmentDefinition.findFirst({
      where: { name: bolum, isActive: true },
      select: { orgUnitId: true },
    })
    if (!dept?.orgUnitId) {
      // Bölümün şema bağı yok (bilinen açık: bazı bölümlerde orgUnitId NULL).
      return NextResponse.json({
        secenekler: [],
        uyari: 'Bölümün organizasyon şeması bağı yok — görev listesi üretilemedi',
      })
    }

    // Alt ağacı tek sorguda çek, bellekte yürü (OrgUnit tablosu küçük).
    const tumu = await prisma.orgUnit.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, parentId: true },
    })
    const cocuklar = new Map<string, string[]>()
    for (const u of tumu) {
      if (!u.parentId) continue
      if (!cocuklar.has(u.parentId)) cocuklar.set(u.parentId, [])
      cocuklar.get(u.parentId)!.push(u.id)
    }
    const idler = new Set<string>()
    const yigin = [dept.orgUnitId]
    while (yigin.length) {
      const id = yigin.pop()!
      if (idler.has(id)) continue // döngü guard
      idler.add(id)
      for (const c of cocuklar.get(id) ?? []) yigin.push(c)
    }

    const altAgac = tumu.filter((u) => idler.has(u.id) && !u.code.startsWith('ORG-KR-'))
    if (altAgac.length === 0) return NextResponse.json({ secenekler: [] })

    const dolular = await prisma.orgEmployee.groupBy({
      by: ['orgUnitId'],
      where: { orgUnitId: { in: altAgac.map((u) => u.id) }, isActive: true },
      _count: { _all: true },
    })
    const doluSayisi = new Map(dolular.map((d) => [d.orgUnitId, d._count._all]))

    // Unvan başına BOŞ kutu sayısı. Aynı unvanda birden çok kutu olması normal
    // (kadro sayısı kadar kutu açılmış) — kullanıcıya kaç boş kadro var gösterilir.
    const sayac = new Map<string, number>()
    for (const u of altAgac) {
      if ((doluSayisi.get(u.id) ?? 0) > 0) continue
      sayac.set(u.name, (sayac.get(u.name) ?? 0) + 1)
    }

    const secenekler = [...sayac.entries()]
      .map(([ad, bosKutu]) => ({ ad, bosKutu }))
      .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'))

    return NextResponse.json({ secenekler })
  } catch (err) {
    console.error('Görev seçenekleri hatası:', err)
    return NextResponse.json({ error: 'Görev listesi alınamadı' }, { status: 500 })
  }
}
