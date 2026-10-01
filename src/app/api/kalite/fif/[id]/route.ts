import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { fifKapsamindaMi, fifDuzenleyebilirMi, canManageFif } from '@/lib/quality/fif-access'
import { fifGuncelleInput, yayilimGecerli, type FifGuncelleInput } from '@/lib/quality/fif-validators'
import { gecisYapabilirMi, hardDeleteEdilebilir } from '@/lib/quality/fif-durum'
import { bolumOnaylayan } from '@/lib/quality/fif-zincir'
import { fifKaynakDogrula } from '@/lib/quality/fif-kaynak'
import { faaliyetKapaliMi } from '@/lib/quality/fif-termin'
import { FifDurum, type Prisma } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

/** GET /api/kalite/fif/[id] — detay. Auth: oturum (herkes okur). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { id } = await params


  const item = await prisma.fif.findUnique({
    where: { id },
    include: {
      sorumluBolum: { select: { id: true, name: true } },
      yayinlayanBolum: { select: { id: true, name: true } },
      faaliyetler: { orderBy: { sira: 'asc' } },
      kokNedenler: true,
      besNedenler: true,
      etkinlikler: true,
      ekler: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!item) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (!(await fifKapsamindaMi(session, item))) {
    return NextResponse.json({ error: 'Bu FİF kapsamınızda değil' }, { status: 403 })
  }
  return NextResponse.json({ item })
}

/**
 * PUT'ta istemcinin yazabildiği başlık alanları. Sistem alanları (durum, kayitNo,
 * hazırlayan, KSS, onaylayanlar, kapatmaTarihi) burada YOK — fifGuncelleInput
 * onları zaten atar; liste ikinci bekçi. Paket 3: kaynakId girdi; eski
 * denetlemeAdi ve uygulama sorumlusu artık yazılmaz (kolonlar geçmiş için durur).
 */
const DUZENLENEBILIR_ALANLAR = [
  'tur', 'tarih', 'sorumluBolumId', 'yayinlayanBolumId', 'kaynakId',
  'izlemeSorumlusuUserId',
  'uygunsuzlukTanimi', 'standartMadde', 'kokNedenAnalizi',
  'kysDegisikligi', 'riskFirsatGuncelleme', 'ogrenilenDers', 'yayilimVarMi', 'yayilimAciklama',
] as const satisfies readonly (keyof FifGuncelleInput)[]

/** Transaction içinden 4xx döndürmek için (rollback + anlamlı hata). */
class FifIstekHatasi extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

const tarihEsit = (a: Date | null | undefined, b: Date | null | undefined) =>
  (a ? a.getTime() : null) === (b ? b.getTime() : null)

/**
 * PUT /api/kalite/fif/[id] — güncelle. Auth: kapsam (kendi/hazırlayan/bölüm; manage tümü).
 * KISMİ güncelleme: payload'da gelmeyen alan DOKUNULMAZ (eskiden `?? null` ile
 * siliniyordu). Onaylayanlar istemciden alınmaz; bölüm değişirse omurgadan
 * yeniden çözülür. Faaliyetler id bazında senkronlanır (paraf/sonuç korunur).
 * kayitNo/durum bu uçtan DEĞİŞMEZ. İPTAL için DELETE kullanılır.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { id } = await params

  const mevcut = await prisma.fif.findUnique({
    where: { id },
    select: {
      id: true, durum: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true,
      yayilimVarMi: true, yayilimAciklama: true, kaynakId: true,
    },
  })
  if (!mevcut) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (!(await fifDuzenleyebilirMi(session, mevcut))) {
    return NextResponse.json({ error: 'Bu FİF\'i düzenleme yetkiniz yok' }, { status: 403 })
  }
  if (mevcut.durum === FifDurum.IPTAL) {
    return NextResponse.json({ error: 'İptal edilmiş FİF düzenlenemez' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const parsed = fifGuncelleInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data

  // Yayılım kuralı (Rev 3): "var" işaretlendiyse açıklama zorunlu — TEK KAYNAK validator'da.
  // Kısmi güncellemede gelmeyen taraf mevcut kayıttan alınır.
  const yay = yayilimGecerli(
    d.yayilimVarMi ?? mevcut.yayilimVarMi,
    d.yayilimAciklama !== undefined ? d.yayilimAciklama : mevcut.yayilimAciklama,
  )
  if (!yay.ok) return NextResponse.json({ error: yay.sebep }, { status: 400 })

  // Kaynak: yalnız DEĞİŞİYORSA aktiflik aranır — sonradan pasife alınmış kaynağı
  // taşıyan eski kayıt, başka alanlarını kaydedebilmeli.
  if (d.kaynakId && d.kaynakId !== mevcut.kaynakId) {
    const hata = await fifKaynakDogrula(d.kaynakId)
    if (hata) return NextResponse.json({ error: hata }, { status: 400 })
  }

  let updated
  try {
    updated = await prisma.$transaction(async (tx) => {
      // updatedAt açıkça: yalnız faaliyet satırı değişip başlık alanı gelmese de
      // form key'i (updatedAt) değişsin — boş data'lı update'e güvenilmez.
      const baslik: Prisma.FifUncheckedUpdateInput = { updatedAt: new Date() }
      for (const alan of DUZENLENEBILIR_ALANLAR) {
        if (d[alan] !== undefined) (baslik as Record<string, unknown>)[alan] = d[alan]
      }
      // Bölüm değiştiyse onaylayan omurgadan yeniden çözülür (eskiden istemci
      // gönderiyordu; artık sistem alanı). Çözülemezse boş kalır — "Onaya Gönder"
      // zincir çözümü fail-closed olarak yakalar.
      if (d.sorumluBolumId !== undefined && d.sorumluBolumId !== mevcut.sorumluBolumId) {
        baslik.sorumluOnaylayanUserId = (await bolumOnaylayan(tx, d.sorumluBolumId))?.userId ?? null
      }
      if (d.yayinlayanBolumId !== undefined && d.yayinlayanBolumId !== mevcut.yayinlayanBolumId) {
        baslik.yayinlayanOnaylayanUserId = (await bolumOnaylayan(tx, d.yayinlayanBolumId))?.userId ?? null
      }
      await tx.fif.update({ where: { id }, data: baslik })

      // Faaliyetler id bazında senkron (undefined = dokunma). deleteMany+createMany
      // paraf/sonuç/gerçekleşen tarihi siliyordu; artık yalnız düzenlenebilir alanlar yazılır.
      // Paket 3 kuralları:
      //  · ilkHedefTarih: hedef tarih İLK dolduğunda sunucu yazar; istemciden alınmaz.
      //  · FAALIYET'te DOLU hedef tarih formdan değişmez (ek süre akışı değiştirir).
      //  · Kapalı satır ("Faaliyeti Kapat") formdan düzenlenmez; yalnız sırası kayabilir.
      if (d.faaliyetler) {
        const mevcutSatirlar = await tx.fifFaaliyet.findMany({
          where: { fifId: id },
          select: {
            id: true, parafUserId: true, aciklama: true, aksiyonTuru: true, hedefTarih: true, ilkHedefTarih: true,
            sorumluUserId: true, sonuc: true, gerceklesenTarih: true,
          },
        })
        const mevcutById = new Map(mevcutSatirlar.map((f) => [f.id, f]))
        const mevcutIdler = new Set(mevcutSatirlar.map((f) => f.id))
        const gelenIdler = new Set<string>()
        for (const f of d.faaliyetler) {
          if (!f.id) continue
          if (!mevcutIdler.has(f.id)) throw new FifIstekHatasi('Faaliyet satırı bu FİF\'e ait değil', 400)
          if (gelenIdler.has(f.id)) throw new FifIstekHatasi('Aynı faaliyet satırı birden fazla gönderildi', 400)
          gelenIdler.add(f.id)
        }

        const silinecek = mevcutSatirlar.filter((f) => !gelenIdler.has(f.id))
        if (silinecek.some((f) => f.parafUserId)) throw new FifIstekHatasi('Paraflı faaliyet silinemez', 400)
        if (silinecek.length) {
          await tx.fifFaaliyet.deleteMany({ where: { fifId: id, id: { in: silinecek.map((f) => f.id) } } })
        }

        for (const f of d.faaliyetler) {
          const m = f.id ? mevcutById.get(f.id) : undefined
          if (!m) {
            await tx.fifFaaliyet.create({
              data: {
                fifId: id, sira: f.sira, aciklama: f.aciklama,
                aksiyonTuru: f.aksiyonTuru ?? null,
                hedefTarih: f.hedefTarih ?? null,
                ilkHedefTarih: f.hedefTarih ?? null,
                sorumluUserId: f.sorumluUserId ?? null,
              },
            })
            continue
          }

          if (faaliyetKapaliMi(m)) {
            const degisti =
              f.aciklama !== m.aciklama ||
              (f.aksiyonTuru !== undefined && f.aksiyonTuru !== m.aksiyonTuru) ||
              (f.hedefTarih !== undefined && !tarihEsit(f.hedefTarih, m.hedefTarih)) ||
              (f.sorumluUserId !== undefined && f.sorumluUserId !== m.sorumluUserId)
            if (degisti) throw new FifIstekHatasi(`Kapatılmış faaliyet (#${f.sira}) düzenlenemez`, 400)
            await tx.fifFaaliyet.update({ where: { id: m.id }, data: { sira: f.sira } })
            continue
          }

          if (
            mevcut.durum === FifDurum.FAALIYET && m.hedefTarih &&
            f.hedefTarih !== undefined && !tarihEsit(f.hedefTarih, m.hedefTarih)
          ) {
            throw new FifIstekHatasi(`Faaliyet aşamasında dolu hedef tarih (#${f.sira}) formdan değiştirilemez — ek süre kullanın`, 400)
          }
          const yeniHedef = f.hedefTarih !== undefined ? f.hedefTarih : m.hedefTarih
          await tx.fifFaaliyet.update({
            where: { id: m.id },
            data: {
              sira: f.sira, aciklama: f.aciklama,
              ...(f.aksiyonTuru !== undefined ? { aksiyonTuru: f.aksiyonTuru } : {}),
              ...(f.hedefTarih !== undefined ? { hedefTarih: f.hedefTarih } : {}),
              ...(f.sorumluUserId !== undefined ? { sorumluUserId: f.sorumluUserId } : {}),
              ...(!m.ilkHedefTarih && yeniHedef ? { ilkHedefTarih: yeniHedef } : {}),
            },
          })
        }
      }
      if (d.kokNedenler) {
        await tx.fifKokNeden.deleteMany({ where: { fifId: id } })
        if (d.kokNedenler.length) {
          await tx.fifKokNeden.createMany({ data: d.kokNedenler.map((k) => ({ fifId: id, kategori: k.kategori, aciklama: k.aciklama })) })
        }
      }
      if (d.besNedenler) {
        await tx.fifBesNeden.deleteMany({ where: { fifId: id } })
        if (d.besNedenler.length) {
          await tx.fifBesNeden.createMany({ data: d.besNedenler.map((b) => ({
            fifId: id, muhtemelSebep: b.muhtemelSebep,
            neden1: b.neden1 ?? null, neden2: b.neden2 ?? null, neden3: b.neden3 ?? null,
            neden4: b.neden4 ?? null, neden5: b.neden5 ?? null,
          })) })
        }
      }
      if (d.etkinlikler) {
        await tx.fifEtkinlik.deleteMany({ where: { fifId: id } })
        if (d.etkinlikler.length) {
          await tx.fifEtkinlik.createMany({ data: d.etkinlikler.map((e) => ({
            fifId: id, madde: e.madde, planlananTarih: e.planlananTarih ?? null,
            gerceklesenTarih: e.gerceklesenTarih ?? null, uygun: e.uygun ?? null,
            onayUserId: e.onayUserId ?? null, onayTarihi: e.onayTarihi ?? null,
          })) })
        }
      }

      return tx.fif.findUnique({
        where: { id },
        include: { faaliyetler: { orderBy: { sira: 'asc' } }, kokNedenler: true, besNedenler: true, etkinlikler: true },
      })
    })
  } catch (e) {
    if (e instanceof FifIstekHatasi) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  return NextResponse.json({ item: updated })
}

/** DELETE /api/kalite/fif/[id] — İPTAL (soft). Auth: kapsam. Kayıt silinmez. */
/**
 * DELETE — TASLAK + alt kaydı YOK ise HARD DELETE (kayıt tamamen silinir; kayıt no
 * boşluğu kabul — o numara bir daha kullanılmaz). Aksi hâlde soft IPTAL.
 * Yetki: kapsam (hazırlayan/manage). Kalite/geçmiş için IPTAL akışı gecisYapabilirMi
 * ile korunur.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { id } = await params
  const mevcut = await prisma.fif.findUnique({
    where: { id },
    select: {
      id: true, durum: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true,
      _count: { select: { faaliyetler: true, etkinlikler: true, kokNedenler: true, besNedenler: true, ekler: true } },
    },
  })
  if (!mevcut) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (!(await fifDuzenleyebilirMi(session, mevcut))) {
    return NextResponse.json({ error: 'Bu FİF\'i düzenleme yetkiniz yok' }, { status: 403 })
  }

  const altKayitVar =
    mevcut._count.faaliyetler + mevcut._count.etkinlikler + mevcut._count.kokNedenler +
    mevcut._count.besNedenler + mevcut._count.ekler > 0

  // Boş TASLAK → hard delete (FifGecmis cascade siler).
  if (hardDeleteEdilebilir(mevcut.durum, altKayitVar)) {
    await prisma.fif.delete({ where: { id } })
    return NextResponse.json({ ok: true, silindi: 'hard' })
  }

  // Aksi hâlde IPTAL (kalite izi korunur). gecisYapabilirMi ile yetki teyidi.
  const iptal = gecisYapabilirMi(
    { userId: session.user.id, isManage: canManageFif(session), sorumluBolumMudurUserId: null },
    { durum: mevcut.durum, createdById: mevcut.createdById, hazirlayanUserId: mevcut.hazirlayanUserId,
      yayinlayanOnaylayanUserId: null, sorumluOnaylayanUserId: null, izlemeSorumlusuUserId: null,
      sorumluBolumId: mevcut.sorumluBolumId, yayinlayanBolumId: mevcut.yayinlayanBolumId, uygunsuzlukTanimi: null, tur: null,
      faaliyetler: [], etkinlikler: [] },
    FifDurum.IPTAL,
  )
  if (!iptal.ok) return NextResponse.json({ error: iptal.sebep }, { status: 403 })

  await prisma.$transaction(async (tx) => {
    await tx.fif.update({ where: { id }, data: { durum: FifDurum.IPTAL } })
    await tx.fifGecmis.create({ data: { fifId: id, eskiDurum: mevcut.durum, yeniDurum: FifDurum.IPTAL, userId: session.user.id, aciklama: 'İptal (silme talebi — alt kayıt mevcut)' } })
  })
  return NextResponse.json({ ok: true, silindi: 'iptal' })
}
