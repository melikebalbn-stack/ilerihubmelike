import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { checkRateLimit } from '@/lib/rate-limit'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { veriSetiAlanlari } from '@/lib/rapor/veri-seti-alanlar'
import { aiGorunumKur, AiYapilandirmaHatasi, ISTEK_SINIRI, type AiAlan } from '@/lib/rapor/ai-gorunum'
import { etkilesimliMi, type SablonIcerikHer, type VeriSetiTanim } from '@/lib/rapor/tipler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Kullanıcı başına saatlik istek sınırı (projedeki bellek içi limiter). */
const SAATLIK_SINIR = 40
const PENCERE_MS = 60 * 60 * 1000

const Govde = z.object({
  istek: z.string().trim().min(1, 'İstek boş').max(ISTEK_SINIRI, `İstek en fazla ${ISTEK_SINIRI} karakter`),
  mevcutGorunum: z.record(z.string(), z.unknown()),
  ornekDegerler: z.record(z.string(), z.array(z.string())).optional(),
})

/**
 * POST /api/raporlar/[id]/ai — doğal dil isteğinden ekran görünümü kurar.
 *
 * Yetki: rapor.view. Raporu ÇALIŞTIRABİLEN herkes kendi ekranındaki görünümü değiştirebilir;
 * bu uç hiçbir şey KAYDETMEZ (kaydetmek hâlâ rapor.tasarla ister). API anahtarı sunucuda kalır.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requirePermission(PERMISSION_KEYS.RAPOR_VIEW)
  if (error) return error
  const { id } = await params

  const ham = await req.json().catch(() => null)
  const govde = Govde.safeParse(ham)
  if (!govde.success) {
    return NextResponse.json({ error: govde.error.issues[0]?.message ?? 'Geçersiz istek gövdesi' }, { status: 400 })
  }

  const sinir = checkRateLimit(`rapor-ai:${userId}`, { windowMs: PENCERE_MS, maxAttempts: SAATLIK_SINIR })
  if (!sinir.success) {
    return NextResponse.json(
      { error: `Saatlik yapay zekâ isteği sınırına ulaşıldı (${SAATLIK_SINIR}). ${Math.ceil(sinir.resetIn / 60)} dakika sonra tekrar dene.` },
      { status: 429 },
    )
  }

  const sablon = await prisma.raporSablon.findUnique({ where: { id }, include: { veriSeti: { select: { tanim: true } } } })
  if (!sablon) return NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 })
  const icerik = sablon.icerik as unknown as SablonIcerikHer
  if (!etkilesimliMi(icerik)) return NextResponse.json({ error: 'Bu rapor bir AI Rapor değil' }, { status: 400 })

  const alanlar = await veriSetiAlanlari(sablon.veriSeti.tanim as unknown as VeriSetiTanim)
  const mevcutGorunum = govde.data.mevcutGorunum as unknown as Parameters<typeof aiGorunumKur>[0]['mevcutGorunum']
  const aiAlanlar: AiAlan[] = [
    ...alanlar.map((a) => ({ ad: a.ad, etiket: a.etiket, tip: a.veriTipi })),
    ...(mevcutGorunum.hesaplananAlanlar ?? []).map((h) => ({ ad: h.ad, etiket: null, tip: 'sayi', hesaplanan: true, ifade: h.ifade })),
  ]

  const kullanici = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  const t0 = Date.now()
  try {
    const sonuc = await aiGorunumKur({
      istek: govde.data.istek,
      mevcutGorunum,
      alanlar: aiAlanlar,
      ornekDegerler: govde.data.ornekDegerler,
    })
    console.info(
      `[rapor-ai] ${kullanici?.email ?? userId} · ${sablon.kod} · "${govde.data.istek.replace(/\s+/g, ' ').slice(0, 200)}" · ` +
        `model=${sonuc.olcum.model} giris=${sonuc.olcum.girisToken} cikis=${sonuc.olcum.cikisToken} ` +
        `deneme=${sonuc.olcum.deneme} ${sonuc.olcum.sureMs}ms · ${sonuc.anlasilmadi ? 'ANLASILMADI' : 'OK'}`,
    )
    return NextResponse.json({ gorunum: sonuc.gorunum, aciklama: sonuc.aciklama, anlasilmadi: sonuc.anlasilmadi })
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e)
    console.error(`[rapor-ai] ${kullanici?.email ?? userId} · ${sablon.kod} · HATA (${Date.now() - t0}ms):`, mesaj)
    if (e instanceof AiYapilandirmaHatasi) {
      return NextResponse.json({ error: 'Yapay zekâ özelliği bu sunucuda yapılandırılmamış' }, { status: 503 })
    }
    return NextResponse.json({ error: `Yapay zekâ isteği başarısız: ${mesaj}` }, { status: 502 })
  }
}
