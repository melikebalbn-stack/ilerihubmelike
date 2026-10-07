// GET /api/tutanak/export — Excel. Kapsam liste ucuyla AYNI where (tutanakListeWhere):
// kimse export ile görmediği kaydı indiremez. Açıklama metni SÜTUN OLARAK VAR
// ama yalnız İV'de (gizli disiplin verisi; diğer roller özet sütunları alır).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import * as XLSX from 'xlsx'
import { logAuditEvent } from '@/lib/audit-log'
import { TUTANAK_ERISIM_YOK, tutanakListeWhere, tutanakYetkisiCore } from '@/lib/tutanak/tutanak-yetki'
import { DURUM_ETIKETLERI, SEBEP_ETIKETLERI, SAHIT_DURUM_ETIKETLERI } from '@/lib/tutanak/tutanak-durum'

export const dynamic = 'force-dynamic'

function tarih(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString('tr-TR') : ''
}

export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const yetki = await tutanakYetkisiCore(user.id, user.role, user.department)
    if (!yetki.erisebilir && !yetki.platformBypass) {
      return NextResponse.json({ error: TUTANAK_ERISIM_YOK }, { status: 403 })
    }

    const kayitlar = await prisma.tutanak.findMany({
      where: tutanakListeWhere(yetki),
      orderBy: { createdAt: 'desc' },
      include: {
        yonetici: { select: { adSoyad: true } },
        bilgilendirilenSonYonetici: { select: { adSoyad: true } },
        acan: { select: { name: true, email: true } },
        sahitler: { include: { personnel: { select: { adSoyad: true } } } },
      },
    })

    const satirlar = kayitlar.map((t) => ({
      'Tutanak No': t.tutanakNo,
      'Tutanak Tarihi': tarih(t.tutanakTarihi),
      'Adı Soyadı': t.adSoyadSnapshot,
      'Sicil No': t.sicilSnapshot ?? '',
      Bölüm: t.bolumSnapshot,
      Görev: t.gorevSnapshot ?? '',
      Sebep: SEBEP_ETIKETLERI[t.sebep],
      Durum: DURUM_ETIKETLERI[t.durum],
      Şahitler: t.sahitler
        .map((s) => `${s.personnel.adSoyad} (${SAHIT_DURUM_ETIKETLERI[s.durum]})`)
        .join(', '),
      Yönetici: t.yonetici.adSoyad,
      'Yönetici Kademe': t.yoneticiKademe,
      'Yönetici Kararı': t.yoneticiKarar ?? '',
      'Son Yönetici (bilgi)': t.bilgilendirilenSonYonetici?.adSoyad ?? '',
      'Tutanağı Tutan': t.acan?.name ?? t.acan?.email ?? '',
      'İV Kapanış': tarih(t.ivKapanisAt),
      'Ret Gerekçesi': t.redSebebi ?? '',
      ...(yetki.iv ? { Açıklama: t.aciklama } : {}),
    }))

    const ws = XLSX.utils.json_to_sheet(satirlar)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tutanaklar')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    await logAuditEvent({
      action: 'TUTANAK_EXPORT',
      actorId: user.id,
      targetType: 'TUTANAK',
      // Özet satırı: tek bir tutanağa bağlı değil (kadro/izin export deseni).
      targetId: undefined,
      details: { satir: satirlar.length, aciklamaDahil: yetki.iv },
    })

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="tutanaklar-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Tutanak export hatası:', err)
    return NextResponse.json({ error: 'Excel üretilemedi' }, { status: 500 })
  }
}
