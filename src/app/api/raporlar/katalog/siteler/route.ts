import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { istek } from '@/lib/ifs/personel-sync/ifs-api'

export const dynamic = 'force-dynamic'

/**
 * GET — IFS site (Contract) listesi: ShopOrderHandling.Reference_UserAllowedSiteLov
 * (entegrasyon kullanıcısının görebildiği siteler; CompanySite'ın entity set'i yok).
 * 1 saat süreç içi önbellek; IFS'e ulaşılamazsa yalnız .env IFS_CONTRACT döner.
 */
interface Site { contract: string; aciklama: string }
let cache: { zaman: number; siteler: Site[] } | null = null
const TTL = 60 * 60 * 1000

export async function GET() {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const varsayilan = process.env.IFS_CONTRACT ?? 'ILER2'
  let siteler: Site[] = []
  let uyari: string | undefined
  if (cache && Date.now() - cache.zaman < TTL) siteler = cache.siteler
  else {
    try {
      const r = await istek<{ value?: { Contract?: string; Description?: string; ContractDesc?: string }[] }>('ShopOrderHandling.svc/Reference_UserAllowedSiteLov?$top=100')
      siteler = (r.body.value ?? []).filter((s) => s.Contract).map((s) => ({ contract: s.Contract!, aciklama: s.Description ?? s.ContractDesc ?? '' }))
      cache = { zaman: Date.now(), siteler }
    } catch (e) {
      uyari = `IFS site listesi alınamadı: ${e instanceof Error ? e.message : String(e)}`
    }
  }
  if (!siteler.some((s) => s.contract === varsayilan)) siteler = [{ contract: varsayilan, aciklama: '' }, ...siteler]
  return NextResponse.json({ varsayilan, siteler, ...(uyari ? { uyari } : {}) })
}
