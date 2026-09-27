import { NextResponse } from 'next/server'
import { hataYaniti } from '../../../_hata'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { checkRateLimit } from '@/lib/rate-limit'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { aiDegerEtiketle, alanAnahtari, AiYapilandirmaHatasi, MAX_DEGER, type AiDegerAlani } from '@/lib/rapor/ai-deger-etiket'
import { entityEtiketleri } from '../../_entity-etiket'
import { tabloYok } from '../../_degerler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SAATLIK_SINIR = 20
const PENCERE_MS = 60 * 60 * 1000

const AlanSchema = z.object({ kaynakAd: z.string().min(1), entity: z.string().min(1), alan: z.string().min(1) })
const Govde = z.union([
  AlanSchema.extend({ yenidenUret: z.boolean().optional() }),
  z.object({ alanlar: z.array(AlanSchema).min(1).max(40), yenidenUret: z.boolean().optional() }),
])

/**
 * POST — değerleri Claude ile toplu Türkçeleştirir (rapor.katalog). KAYDETMEZ: öneriler döner,
 * kullanıcı düzeltip PUT /degerler ile kaydeder ("Tümünü AI ile doldur" akışında istemci kaydeder).
 *
 * Elle düzeltilmiş (kaynak='ELLE') satırların üzerine yazılmaz — onlar isteğe dahil edilmez.
 * `yenidenUret: true` ise etiketi olan AI satırları da yeniden üretilir (ELLE yine korunur).
 */
export async function POST(req: Request) {
  const { userId, error } = await requirePermission(PERMISSION_KEYS.RAPOR_KATALOG)
  if (error) return error
  const govde = Govde.safeParse(await req.json().catch(() => null))
  if (!govde.success) return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })
  const istenen = 'alanlar' in govde.data ? govde.data.alanlar : [govde.data]
  const yenidenUret = govde.data.yenidenUret ?? false

  const sinir = checkRateLimit(`rapor-deger-ai:${userId}`, { windowMs: PENCERE_MS, maxAttempts: SAATLIK_SINIR })
  if (!sinir.success) {
    return NextResponse.json({ error: `Saatlik yapay zekâ isteği sınırına ulaşıldı (${SAATLIK_SINIR}). ${Math.ceil(sinir.resetIn / 60)} dakika sonra tekrar dene.` }, { status: 429 })
  }

  let satirlar: { kaynakAd: string; entity: string; alan: string; deger: string; etiket: string | null; kaynak: string }[]
  try {
    satirlar = await prisma.raporKatalogDeger.findMany({
      where: { OR: istenen.map((a) => ({ kaynakAd: a.kaynakAd, entity: a.entity, alan: a.alan })) },
      select: { kaynakAd: true, entity: true, alan: true, deger: true, etiket: true, kaynak: true },
      orderBy: { deger: 'asc' },
    })
  } catch (e) {
    if (tabloYok(e)) return NextResponse.json({ error: 'rapor_katalog_deger tablosu henüz oluşturulmadı (migration bekliyor)' }, { status: 503 })
    throw e
  }
  if (!satirlar.length) return NextResponse.json({ error: 'Bu alan(lar) için katalogda değer yok' }, { status: 404 })

  // Alan etiketleri (rapor_katalog) + entity etiketleri → modele bağlam.
  const alanEtiketleri = new Map(
    (await prisma.raporKatalog.findMany({
      where: { OR: istenen.map((a) => ({ kaynakAd: a.kaynakAd, entity: a.entity, alan: a.alan })) },
      select: { kaynakAd: true, entity: true, alan: true, etiket: true },
    })).map((r) => [`${r.kaynakAd}|${r.entity}|${r.alan}`, r.etiket]),
  )
  const entityEtiket = await entityEtiketleri()

  const gruplar = new Map<string, AiDegerAlani>()
  let atlanan = 0
  for (const s of satirlar) {
    // ELLE düzeltilenlere dokunma; etiketi olan AI satırları yalnız yenidenUret'te gönderilir.
    if (s.kaynak === 'ELLE' && s.etiket) { atlanan++; continue }
    if (s.etiket && !yenidenUret) { atlanan++; continue }
    const anahtar = alanAnahtari(s)
    const g = gruplar.get(anahtar) ?? {
      kaynakAd: s.kaynakAd, entity: s.entity, alan: s.alan,
      entityEtiket: entityEtiket.get(`${s.kaynakAd}|${s.entity}`)?.etiket ?? null,
      alanEtiket: alanEtiketleri.get(anahtar) ?? null,
      degerler: [],
    }
    if (g.degerler.length < MAX_DEGER) g.degerler.push(s.deger)
    gruplar.set(anahtar, g)
  }
  const gonderilecek = [...gruplar.values()].filter((g) => g.degerler.length)
  if (!gonderilecek.length) {
    return NextResponse.json({ cevriler: {}, gonderilenDeger: 0, atlanan, not: 'Çevrilecek yeni değer yok (tümü elle/AI ile etiketli).' })
  }

  try {
    const sonuc = await aiDegerEtiketle(gonderilecek)
    const gonderilenDeger = gonderilecek.reduce((t, g) => t + g.degerler.length, 0)
    const donen = Object.values(sonuc.cevriler).reduce((t, m) => t + Object.keys(m).length, 0)
    console.info(`[rapor-ai-deger] ${gonderilecek.length} alan / ${gonderilenDeger} değer → ${donen} etiket · ${sonuc.olcum.sureMs} ms · ${sonuc.olcum.girisToken}+${sonuc.olcum.cikisToken} token · ${sonuc.olcum.model}`)
    return NextResponse.json({ cevriler: sonuc.cevriler, gonderilenDeger, donenEtiket: donen, atlanan, olcum: sonuc.olcum })
  } catch (e) {
    return hataYaniti(e, { kaynakTipi: 'ai' }, e instanceof AiYapilandirmaHatasi ? 503 : 502, 'rapor-ai-deger')
  }
}
