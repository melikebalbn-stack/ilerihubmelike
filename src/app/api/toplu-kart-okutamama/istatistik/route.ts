import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from '../_lib/access'
import { getManagedPersonnelIds } from '../_lib/approvers'
import { VALID_NEDEN, NEDEN_LABELS, type KartOkutamamaNedeni } from '../_lib/neden'

export const dynamic = 'force-dynamic'

// Mesai giriş bazı — 07:00 (dk). "Kayıt saatleri toplamı" = giriş bu bazın
// ÜSTÜNDE olan kayıtların fark toplamı (07:00 ve altı 0 katkı).
const BAZ_DK = 7 * 60

const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function girisDakika(hhmm: string | null): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * GET /api/toplu-kart-okutamama/istatistik
 * Mevcut erişim seviyesiyle KAPSAMLI istatistik:
 *   SELF → kendi kayıtları · GRİ → kendi + ekibi (1./2./3. Sorumlusu olduğu kişiler)
 *   · FULL → tüm fabrika. NONE erişemez.
 * Tek scoped fetch + bellek-içi aggregate (N+1 yok; veri kümesi küçük).
 */
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const access = await getBulkCardScanAccess(user.id)
    if (access.level === 'NONE') {
      return NextResponse.json({ error: 'Bu forma erişim yetkiniz yok' }, { status: 403 })
    }

    // Kapsam: personnelId listesi (FULL'da null → filtre yok).
    let personnelIds: string[] | null = null
    if (access.level === 'SELF') {
      personnelIds = access.personnelId ? [access.personnelId] : ['__none__']
    } else if (access.level === 'GRI') {
      const managed = access.personnelId ? await getManagedPersonnelIds(access.personnelId) : []
      personnelIds = [access.personnelId ?? '__none__', ...managed]
    } // FULL → null (tümü)

    // Son 6 ay penceresi (bu ay dahil): ilk günden başlar.
    const now = new Date()
    const pencereBaslangic = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const rows = await prisma.bulkCardScanFailure.findMany({
      where: {
        ...(personnelIds ? { personnelId: { in: personnelIds } } : {}),
      },
      select: {
        tarih: true,
        girisSaati: true,
        neden: true,
        onayDurumu: true,
        ivOnaylandi: true,
        personnel: { select: { bolum: true } },
      },
    })

    // Aylık kova iskeleti (son 6 ay, sıfır dahil).
    const aylikMap = new Map<string, { ay: string; label: string; sayi: number }>()
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      aylikMap.set(key, { ay: key, label: AY_KISA[d.getMonth()], sayi: 0 })
    }

    const nedenSayac: Record<string, number> = {}
    for (const n of VALID_NEDEN) nedenSayac[n] = 0
    let nedenYok = 0

    let kayitSaatiToplamiDk = 0
    let bekleyenOnay = 0
    let bekleyenIv = 0
    const bolumSayac = new Map<string, number>()

    for (const r of rows) {
      // Aylık (yalnız pencere içi)
      const t = new Date(r.tarih)
      if (t >= pencereBaslangic) {
        const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
        const kova = aylikMap.get(key)
        if (kova) kova.sayi++
      }

      // Neden dağılımı
      if (r.neden) nedenSayac[r.neden] = (nedenSayac[r.neden] ?? 0) + 1
      else nedenYok++

      // Kayıt saatleri toplamı (yalnız 07:00 üstü fark)
      const dk = girisDakika(r.girisSaati)
      if (dk !== null && dk > BAZ_DK) kayitSaatiToplamiDk += dk - BAZ_DK

      // Bekleyenler
      if (r.onayDurumu === 'BEKLIYOR') bekleyenOnay++
      if (!r.ivOnaylandi) bekleyenIv++

      // Bölüm (FULL kırılımı için)
      const b = (r.personnel?.bolum || '').trim() || 'Tanımsız'
      bolumSayac.set(b, (bolumSayac.get(b) ?? 0) + 1)
    }

    const nedenDagilim = VALID_NEDEN.map((n: KartOkutamamaNedeni) => ({
      neden: n,
      label: NEDEN_LABELS[n],
      sayi: nedenSayac[n],
    }))
    if (nedenYok > 0) nedenDagilim.push({ neden: 'YOK' as KartOkutamamaNedeni, label: 'Belirtilmemiş', sayi: nedenYok })

    const bolumKirilim =
      access.level === 'FULL'
        ? [...bolumSayac.entries()]
            .map(([bolum, sayi]) => ({ bolum, sayi }))
            .sort((a, b) => b.sayi - a.sayi)
            .slice(0, 12)
        : []

    return NextResponse.json({
      kapsam: access.level,
      toplamKayit: rows.length,
      aylik: [...aylikMap.values()],
      nedenDagilim,
      kayitSaatiToplamiDk,
      bekleyen: { onay: bekleyenOnay, iv: bekleyenIv },
      bolumKirilim,
    })
  } catch (error) {
    console.error('Kart okutamama istatistik hatası:', error)
    return NextResponse.json({ error: 'İstatistik alınamadı' }, { status: 500 })
  }
}
