import { NextRequest, NextResponse } from 'next/server'
import { gecikmisKararlariIsle } from '@/lib/meetings/toplanti-bildirim'

export const dynamic = 'force-dynamic'

/**
 * POST/GET /api/cron/toplanti-karar-gecikme — GÜNLÜK (sabah).
 *
 * Son tarihi geçmiş ve hâlâ PENDING olan toplantı kararlarını OVERDUE yapar,
 * sorumlusuna hatırlatma (mail + in-app + push) gönderir.
 *
 * NEDEN: `DecisionStatus.OVERDUE` şemada VARDI ama hiçbir kod set etmiyordu;
 * 8 kararın 3'ünde son tarih dolu olmasına rağmen hepsi PENDING'di.
 *
 * Auth: x-cron-secret (fif-hatirlatma / check-evaluations deseniyle aynı).
 * Tekrar engeli: aynı gün, aynı karar için oluşturulmuş in-app bildirim varsa
 * atlanır — ayrı log tablosu ya da şema alanı GEREKTİRMEZ.
 *
 * `?kuru=1` → hiçbir şey yazılmaz, yalnız ne olacağını sayar (simülasyon).
 */
function cronYetkili(request: NextRequest): boolean {
  const s = request.headers.get('x-cron-secret')
  return !!s && s === process.env.CRON_SECRET
}

async function calistir(request: NextRequest) {
  if (!cronYetkili(request)) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  const kuru = new URL(request.url).searchParams.get('kuru') === '1'
  try {
    const sonuc = await gecikmisKararlariIsle({ kuru })
    return NextResponse.json({ ok: true, kuru, ...sonuc, checkedAt: new Date().toISOString() })
  } catch (error) {
    console.error('[cron/toplanti-karar-gecikme]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) { return calistir(request) }
export async function GET(request: NextRequest) { return calistir(request) }
