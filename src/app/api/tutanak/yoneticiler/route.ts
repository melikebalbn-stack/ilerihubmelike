// GET /api/tutanak/yoneticiler?personelId=<id>
//
// Formdaki yönetici RADIO'sunun seçenekleri: personelin org şemasındaki 1. ve 2.
// yöneticisi + otomatik hesaplanan "bilgilendirilecek son yönetici".
//
// Zincir boşsa (koltuğu yok / üstünde sahipli pozisyon yok) `secenekler` boş
// döner ve form tutanağı kaydedemez — yoneticiId zorunlu FK.

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { tutanakYetkisiCore, TUTANAK_ACMA_YETKISI_YOK } from '@/lib/tutanak/tutanak-yetki'
import { secilebilirBasamaklar, yoneticiZinciri } from '@/lib/tutanak/tutanak-yoneticiler'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const yetki = await tutanakYetkisiCore(user.id, user.role, user.department)
    if (!yetki.acabilir) {
      return NextResponse.json({ error: TUTANAK_ACMA_YETKISI_YOK }, { status: 403 })
    }

    const personelId = (request.nextUrl.searchParams.get('personelId') ?? '').trim()
    if (!personelId) return NextResponse.json({ secenekler: [], sonYonetici: null })

    const zincir = await yoneticiZinciri(personelId)
    const secenekler = secilebilirBasamaklar(zincir)

    return NextResponse.json({
      secenekler,
      // Zincirin en üstü — seçim yapıldığında hangi kişinin bilgilendirileceğini
      // formda göstermek için; nihai karar POST'ta yeniden hesaplanır.
      sonYonetici: zincir.length ? zincir[zincir.length - 1] : null,
      uyari: secenekler.length
        ? undefined
        : 'Personelin organizasyon şemasında yöneticisi bulunamadı — tutanak açılamaz.',
    })
  } catch (err) {
    console.error('Tutanak yönetici zinciri hatası:', err)
    return NextResponse.json({ error: 'Yönetici listesi alınamadı' }, { status: 500 })
  }
}
