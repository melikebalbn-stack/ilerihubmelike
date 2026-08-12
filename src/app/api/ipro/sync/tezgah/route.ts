import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { tezgahSenkronu } from '@/lib/ipro/tezgah-sync'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/ipro/sync/tezgah — IFS tezgah (WC kaynak) senkronunu ELLE tetikler (Melike #15).
// Cron endpoint'iyle (/api/ipro/cron/ifs-tezgah-sync) AYNI lib fn'i (tezgahSenkronu) çağırır —
// ama x-cron-secret DEĞİL, ipro.admin OTURUM guard'ı (secret UI'a konamaz). Sync PASİFLEME YAPMAZ
// (yalnız ekle/güncelle/backfill) → güvenli. Cron route + tezgah-sync lib DEĞİŞMEZ (yalnız import).
export async function POST() {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  try {
    const sonuc = await tezgahSenkronu()
    return NextResponse.json({ ok: true, ...sonuc })
  } catch (e) {
    return iproHata(e, 'Tezgah senkronu başarısız')
  }
}
