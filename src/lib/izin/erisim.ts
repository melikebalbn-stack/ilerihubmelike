import 'server-only'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { baglam, talepAcikMi, type Baglam } from './talep-ortak'

/**
 * Talep / onay uçlarının ortak kapısı: oturum şart; SystemSetting izin_talep_acik != 'true' iken yalnız İV
 * (izin.admin) erişir (canlıya geçiş öncesi deneme), diğerleri 403. Yetki kapsamı servislerde (kendi / ekip / İV).
 */
export async function izinErisim(): Promise<{ ctx: Baglam; error: null } | { ctx: null; error: NextResponse }> {
  const r = await requireUser()
  if (r.error) return { ctx: null, error: r.error }
  const ctx = await baglam(r.user.id)
  if (!ctx.ivMi && !(await talepAcikMi())) {
    return { ctx: null, error: NextResponse.json({ ok: false, error: 'İzin talebi henüz açılmadı' }, { status: 403 }) }
  }
  return { ctx, error: null }
}
