import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { kritikUrunBildirimGonder } from '@/lib/envanter/kritik-bildirim'

export async function POST() {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  try {
    const sonuc = await kritikUrunBildirimGonder()
    // Alıcılar henüz yapılandırılmadıysa GERÇEK MAIL GİTMEZ → anlamlı 400.
    if (sonuc.aliciYapilandirilmadi) {
      return NextResponse.json({ ok: false, message: sonuc.mesaj }, { status: 400 })
    }
    return NextResponse.json({ ok: true, ...sonuc })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Bildirim gönderilemedi.' },
      { status: 400 },
    )
  }
}
