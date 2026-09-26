import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { katalogAra } from '../_ara'

export const dynamic = 'force-dynamic'

/**
 * GET ?q=metin — alan adı, alan etiketi, entity adı VE entity etiketinde arama (aktif alanlar).
 * Dönüş: alan eşleşmeleri (≤200) + entity düzeyi eşleşmeler (ad/etiket; alan sayısıyla). İstemci gruplar.
 * Arama mantığı _ara.ts'te — AI alan önerisi de aynı fonksiyonu kullanır.
 */
export async function GET(req: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  return NextResponse.json(await katalogAra(q))
}
