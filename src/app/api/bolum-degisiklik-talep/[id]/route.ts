// Bölüm Değişikliği Talep Formu — tek talep detayı.
// Görebilen: İV (hepsi) ∨ talebi AÇAN (kendi kaydı). Diğerleri 403.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { bolumTalepYetkisiCore } from '@/lib/bolum-talep/bolum-talep-yetki'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const yetki = await bolumTalepYetkisiCore(user.id, user.role, user.department)
    if (!yetki.erisebilir) {
      return NextResponse.json({ error: 'Bu forma erişim yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params
    const talep = await prisma.bolumDegisiklikTalep.findUnique({
      where: { id },
      include: {
        personnel: { select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true } },
        acan: { select: { id: true, name: true, email: true } },
        kararVeren: { select: { id: true, name: true, email: true } },
        transfer: { select: { id: true, transferTarihi: true, transferEdenBolum: true, transferEdilenBolum: true } },
      },
    })
    if (!talep) return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 })
    if (!yetki.iv && talep.acanUserId !== user.id) {
      return NextResponse.json({ error: 'Bu talebi görüntüleme yetkiniz yok' }, { status: 403 })
    }

    return NextResponse.json({ talep, iv: yetki.iv })
  } catch (err) {
    console.error('Bölüm talep detay hatası:', err)
    return NextResponse.json({ error: 'Talep yüklenemedi' }, { status: 500 })
  }
}
