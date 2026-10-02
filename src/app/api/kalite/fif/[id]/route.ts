import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { fifKapsamindaMi, fifDuzenleyebilirMi, canManageFif } from '@/lib/quality/fif-access'
import { fifGuncelleInput, yayilimGecerli, type FifGuncelleInput } from '@/lib/quality/fif-validators'
import {
  gecisYapabilirMi, hardDeleteEdilebilir, faaliyetPlanlamaYetkisi, kokNedenDoluMu, KOK_NEDEN_ONCE, EK_TERMINLI_SILINEMEZ,
} from '@/lib/quality/fif-durum'
import { bolumOnaylayan } from '@/lib/quality/fif-zincir'
import { fifKaynakDogrula } from '@/lib/quality/fif-kaynak'
import { faaliyetKapaliMi } from '@/lib/quality/fif-termin'
import { fifFaaliyetAtamaBildir, fifIzlemeSorumlusuBildir, type FifAtananSatir } from '@/lib/quality/fif-bildirim'
import { FifDurum, FifGecmisOlay, type Prisma } from '@/generated/prisma'

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

/**
 * Paket 4: faaliyet izleme sorumlusunu sorumlu bölüm müdürü "Sorumlu Bölüm Onayı"nda
 * seçer — formu açan kişi seçmez. Bu durumlarda payload'daki değer YAZILMAZ (kayıttaki
 * değer korunur). FAALIYET ve sonrasında DEĞİŞTİRMEK yalnız sorumlu bölüm müdürü
 * (snapshot) veya manage; diğerleri 403. Boşaltılabilir (Melih Bey kararı). Değişiklik
 * Geçmiş'e yazılır; yeni kişi varsa bilgilendirilir (boşaltmada bildirim yok).
 */
const IZLEME_SECIMI_ONCESI = new Set<FifDurum>([
  FifDurum.TASLAK, FifDurum.ONAY_BEKLIYOR, FifDurum.KSS_KAYIT_BEKLIYOR, FifDurum.SORUMLU_ATAMA_BEKLIYOR,
])

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
  const { session, userId, error } = await requireSession()
  if (error) return error
  const { id } = await params

  const mevcut = await prisma.fif.findUnique({
    where: { id },
    select: {
      id: true, kayitNo: true, durum: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true, izlemeSorumlusuUserId: true,
      yayilimVarMi: true, yayilimAciklama: true, kaynakId: true,
      // Paket 4: satır ekleme / sorumlu atama (müdür) + "önce kök neden".
      sorumluOnaylayanUserId: true, kokNedenAnalizi: true,
      kokNedenler: { select: { aciklama: true } }, besNedenler: { select: { id: true } },
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

  // İzleme sorumlusu değişikliği (onay sonrası): yalnız müdür / manage; yeni kişi aktif olmalı, boşaltılabilir.
  const izlemeDegisti =
    !IZLEME_SECIMI_ONCESI.has(mevcut.durum) &&
    d.izlemeSorumlusuUserId !== undefined && (d.izlemeSorumlusuUserId ?? null) !== mevcut.izlemeSorumlusuUserId
  if (izlemeDegisti) {
    if (!canManageFif(session) && (!userId || userId !== mevcut.sorumluOnaylayanUserId)) {
      return NextResponse.json({ error: 'Faaliyet izleme sorumlusunu yalnız sorumlu bölüm müdürü değiştirebilir' }, { status: 403 })
    }
  }
  // Geçmiş açıklaması için adlar (önceki kişi pasif olabilir → isActive aranmaz).
  const kisiAdi = async (id: string | null | undefined, yalnizAktif: boolean) => {
    if (!id) return null
    const u = await prisma.user.findFirst({
      where: { id, ...(yalnizAktif ? { isActive: true } : {}) },
      select: { id: true, name: true, email: true, personnel: { select: { adSoyad: true } } },
    })
    return u ? u.name || u.personnel?.adSoyad || u.email || u.id : null
  }
  let izlemeGecmisi: string | null = null
  if (izlemeDegisti) {
    const yeniAd = await kisiAdi(d.izlemeSorumlusuUserId, true)
    if (d.izlemeSorumlusuUserId && !yeniAd) {
      return NextResponse.json({ error: 'Seçilen izleme sorumlusu aktif bir kullanıcı değil' }, { status: 400 })
    }
    const eskiAd = (await kisiAdi(mevcut.izlemeSorumlusuUserId, false)) ?? '—'
    izlemeGecmisi = yeniAd
      ? `Faaliyet izleme sorumlusu değişti: ${eskiAd} → ${yeniAd}`
      : `Faaliyet izleme sorumlusu boşaltıldı (önceki: ${eskiAd})`
  }

  // Paket 4 — FAALİYET PLANLAMA (satır ekleme, satıra uygulama sorumlusu atama,
  // FAALIYET'te hedef tarih girme): yalnız FAALIYET'te; izleme sorumlusu, sorumlu
  // bölüm müdürü veya manage (faaliyetPlanlamaYetkisi). Yeni satır için kök neden
  // önce dolu olmalı — aynı kayıtta gelen kök neden de sayılır (payload'da gelmeyen
  // taraf mevcut kayıttan).
  const planlamaHatasi = () =>
    faaliyetPlanlamaYetkisi({ userId, isManage: canManageFif(session) }, mevcut)
  const kokNedenDolu = () => kokNedenDoluMu({
    kokNedenAnalizi: d.kokNedenAnalizi !== undefined ? d.kokNedenAnalizi : mevcut.kokNedenAnalizi,
    kokNedenler: d.kokNedenler ?? mevcut.kokNedenler,
    besNedenler: d.besNedenler ?? mevcut.besNedenler,
  })

  // Commit sonrası yeni uygulama sorumlularına bildirim (atandı / değişti).
  const atananlar: FifAtananSatir[] = []

  let updated
  try {
    updated = await prisma.$transaction(async (tx) => {
      // updatedAt açıkça: yalnız faaliyet satırı değişip başlık alanı gelmese de
      // form key'i (updatedAt) değişsin — boş data'lı update'e güvenilmez.
      const baslik: Prisma.FifUncheckedUpdateInput = { updatedAt: new Date() }
      for (const alan of DUZENLENEBILIR_ALANLAR) {
        if (alan === 'izlemeSorumlusuUserId' && IZLEME_SECIMI_ONCESI.has(mevcut.durum)) continue
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
      if (izlemeGecmisi) {
        // Durum değişmez; denetim için ayrı olay (Geçmiş'te "İzleme sorumlusu değişti").
        await tx.fifGecmis.create({
          data: {
            fifId: id, eskiDurum: mevcut.durum, yeniDurum: mevcut.durum, userId,
            olay: FifGecmisOlay.IZLEME_SORUMLUSU_DEGISTI, aciklama: izlemeGecmisi,
          },
        })
      }

      // Faaliyetler id bazında senkron (undefined = dokunma). deleteMany+createMany
      // paraf/sonuç/gerçekleşen tarihi siliyordu; artık yalnız düzenlenebilir alanlar yazılır.
      // Paket 3 kuralları:
      //  · ilkHedefTarih: hedef tarih İLK dolduğunda sunucu yazar; istemciden alınmaz.
      //  · FAALIYET'te DOLU hedef tarih formdan değişmez (ek süre akışı değiştirir).
      //  · Kapalı satır (KSS "Sonuç Gir" → K) formdan düzenlenmez; yalnız sırası kayabilir.
      // Paket 4: yeni satır ve sorumlu değişikliği müdürde; yeni satır kök nedenden sonra.
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
          // Ek termin geçmişi (her durumda — onay/red/iptal dahil) denetim kaydıdır:
          // FifEkTermin → FifFaaliyet FK'si RESTRICT, silme DB'de reddedilir (P2003) →
          // anlamlı 400. Ayrı ön sorgu gerekmez; hata transaction'ı zaten geri alır.
          try {
            await tx.fifFaaliyet.deleteMany({ where: { fifId: id, id: { in: silinecek.map((f) => f.id) } } })
          } catch (e) {
            if ((e as { code?: string } | null)?.code === 'P2003') throw new FifIstekHatasi(EK_TERMINLI_SILINEMEZ, 400)
            throw e
          }
        }

        for (const f of d.faaliyetler) {
          const m = f.id ? mevcutById.get(f.id) : undefined
          if (!m) {
            const yetki = planlamaHatasi()
            if (yetki) throw new FifIstekHatasi(yetki.sebep, yetki.status)
            if (!kokNedenDolu()) throw new FifIstekHatasi(KOK_NEDEN_ONCE, 400)
            await tx.fifFaaliyet.create({
              data: {
                fifId: id, sira: f.sira, aciklama: f.aciklama,
                aksiyonTuru: f.aksiyonTuru ?? null,
                hedefTarih: f.hedefTarih ?? null,
                ilkHedefTarih: f.hedefTarih ?? null,
                sorumluUserId: f.sorumluUserId ?? null,
              },
            })
            if (f.sorumluUserId) {
              atananlar.push({ sira: f.sira, aciklama: f.aciklama, hedefTarih: f.hedefTarih ?? null, sorumluUserId: f.sorumluUserId })
            }
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

          const sorumluDegisti = f.sorumluUserId !== undefined && (f.sorumluUserId ?? null) !== m.sorumluUserId
          if (sorumluDegisti) {
            const yetki = planlamaHatasi()
            if (yetki) throw new FifIstekHatasi(yetki.sebep, yetki.status)
          }
          // FAALIYET'te hedef tarih girmek de planlamadır (dolu tarih zaten kilitli).
          if (mevcut.durum === FifDurum.FAALIYET && f.hedefTarih !== undefined && !tarihEsit(f.hedefTarih, m.hedefTarih)) {
            const yetki = planlamaHatasi()
            if (yetki) throw new FifIstekHatasi(yetki.sebep, yetki.status)
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
          if (sorumluDegisti && f.sorumluUserId) {
            atananlar.push({ sira: f.sira, aciklama: f.aciklama, hedefTarih: yeniHedef ?? null, sorumluUserId: f.sorumluUserId })
          }
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

  if (izlemeDegisti && d.izlemeSorumlusuUserId) {
    try {
      await fifIzlemeSorumlusuBildir(mevcut, d.izlemeSorumlusuUserId)
    } catch (e) {
      console.error('[fif-put] izleme bildirimi:', e)
    }
  }
  if (atananlar.length) {
    try {
      await fifFaaliyetAtamaBildir(mevcut, atananlar)
    } catch (e) {
      console.error('[fif-put] atama bildirimi:', e)
    }
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
      id: true, durum: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true, izlemeSorumlusuUserId: true,
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
