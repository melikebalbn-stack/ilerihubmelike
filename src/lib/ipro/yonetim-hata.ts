import { NextResponse } from 'next/server'

/**
 * IPRO yönetim API'lerinde ortak hata → yanıt eşlemesi.
 * Zarf: { ok: false, error } (depo deseni).
 *
 * Prisma hata kodları: P2002 benzersizlik (kod alanları unique),
 * P2025 kayıt yok, P2003 FK ihlali.
 */
export function iproHata(e: unknown, varsayilan = 'İşlem başarısız') {
  const kod = (e as { code?: string })?.code
  if (kod === 'P2002') {
    const alan = (e as { meta?: { target?: string[] } })?.meta?.target?.join(', ') ?? 'kayıt'
    return NextResponse.json({ ok: false, error: `Bu değer zaten kayıtlı (${alan})` }, { status: 409 })
  }
  if (kod === 'P2025') {
    return NextResponse.json({ ok: false, error: 'Kayıt bulunamadı' }, { status: 404 })
  }
  if (kod === 'P2003') {
    return NextResponse.json({ ok: false, error: 'Bağlı kayıtlar olduğu için işlem yapılamadı' }, { status: 409 })
  }
  console.error('[ipro-yonetim]', e)
  const mesaj = e instanceof Error ? e.message : varsayilan
  return NextResponse.json({ ok: false, error: mesaj }, { status: 500 })
}

/** Zorunlu string alan kontrolü — Zod repo genelinde yaygın değil, manuel doğrulama deseni. */
export function zorunluMetin(v: unknown, ad: string): string {
  if (typeof v !== 'string' || v.trim() === '') {
    throw Object.assign(new Error(`${ad} zorunlu`), { kullaniciHatasi: true })
  }
  return v.trim()
}

/** kullaniciHatasi işaretli hatalar 400 döner, diğerleri iproHata'ya gider. */
export function istekHatasi(e: unknown) {
  if ((e as { kullaniciHatasi?: boolean })?.kullaniciHatasi) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 })
  }
  return null
}
