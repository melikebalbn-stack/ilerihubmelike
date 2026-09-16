import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { planla, planOzetiMetni, type VarlikTipi } from '@/lib/ifs/personel-sync/plan'
import { uygula } from '@/lib/ifs/personel-sync/uygula'
import { PrismaKuyruk } from '@/lib/ifs/personel-sync/kuyruk'
import { ifsBaglanti } from '@/lib/ifs/personel-sync/ifs-api'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Hub → IFS personel senkronu — kuyruk boşaltıcı (faz 1).
 *
 * Auth: x-cron-secret = CRON_SECRET (diğer cron uçlarıyla aynı).
 *   ?dryRun=1   → plan hesaplanır, IFS'e YAZILMAZ, kuyruk güncellenmez
 *   ?batch=N    → kuyruktan en fazla N kayıt (varsayılan 50); ORG→POZISYON→LABOR_CLASS→EMPLOYEE→SF sırası
 *   ?tam=1      → kuyruğu yok say, TAM tarama (tüm aktif ILR- personel + şema)
 *   ?siciller=  → yalnız bu siciller (virgüllü; test)
 *
 * Kuyruk yalnız "bu Hub kaydına yeniden bak" işareti; fark hesabı planlayıcıda.
 * Cron satırı /etc/cron.d'ye EKLENMEDİ (faz 1: elle tetik). Hedef: her 15 dk.
 * NOT: eski ipro/cron/ifs-personel-sync (03:30) hâlâ cron.d'de — bkz. docs/ifs-personel-sync-kesif.md §8.
 */
export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest) { return handle(req) }

async function handle(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const dryRun = sp.get('dryRun') === '1'
  const tam = sp.get('tam') === '1'
  const batch = Math.min(500, Math.max(1, Number(sp.get('batch') ?? 50) || 50))
  const siciller = sp.get('siciller')?.split(',').map((s) => s.trim()).filter(Boolean)

  const { hostTest, mainRoot } = ifsBaglanti()
  const kuyruk = new PrismaKuyruk(prisma)
  try {
    let hedefler: Partial<Record<VarlikTipi, Set<string>>> | undefined
    let kuyrukKayitlari: Awaited<ReturnType<PrismaKuyruk['bekleyenler']>> = []
    if (!tam && !siciller) {
      kuyrukKayitlari = await kuyruk.bekleyenler(batch)
      if (kuyrukKayitlari.length === 0) return NextResponse.json({ ok: true, dryRun, mesaj: 'kuyruk boş', host: mainRoot })
      hedefler = {}
      for (const k of kuyrukKayitlari) (hedefler[k.varlikTipi] ??= new Set()).add(k.hubId)
    }
    const plan = await planla(prisma, siciller ? { siciller } : hedefler ? { hedefler } : {})
    const sonuc = await uygula(prisma, plan, { dryRun, kuyruk: dryRun ? undefined : kuyruk, actorId: 'cron:ifs-personel-sync' })
    console.log(`[ifs-personel-sync] ${dryRun ? 'DRY' : 'YAZ'} host=${hostTest ? 'test' : 'PROD'} kuyruk=${kuyrukKayitlari.length} yazıldı=${sonuc.ozet.yazildi} hata=${sonuc.ozet.hata} atlandı=${sonuc.ozet.atlandi}`)
    return NextResponse.json({
      ok: sonuc.ozet.hata === 0, dryRun, hostTest, kuyruk: kuyrukKayitlari.length, batch,
      planOzeti: planOzetiMetni(plan), ozet: sonuc.ozet,
      hatalar: sonuc.kalemler.filter((k) => k.durum === 'HATA').map((k) => ({ varlik: k.varlik, anahtar: k.ifsAnahtar, hata: k.hata })),
      atlananlar: sonuc.kalemler.filter((k) => k.durum === 'ATLANDI').map((k) => ({ varlik: k.varlik, anahtar: k.ifsAnahtar, sebep: k.sebep ?? k.hata })),
      ...(dryRun ? { kalemler: plan.kalemler.filter((k) => k.islem !== 'NOOP') } : {}),
    })
  } catch (e) {
    const kod = (e as { code?: string })?.code
    if (kod === 'P2021') return NextResponse.json({ ok: false, error: 'ifs_personel_sync_kayit tablosu yok — migration 20260916120000 uygulanmadı' }, { status: 503 })
    console.error('[ifs-personel-sync] hata', e)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
