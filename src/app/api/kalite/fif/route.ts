import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { fifWhereForUser } from '@/lib/quality/fif-access'
import { fifInput, yayilimGecerli } from '@/lib/quality/fif-validators'
import { fifKaynakDogrula } from '@/lib/quality/fif-kaynak'
import { fifEtiket } from '@/lib/quality/fif-durum-etiket'
import { normalizeTr } from '@/lib/normalize-tr'
import { FifDurum, Prisma } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/kalite/fif — liste. Auth: oturum (fif.view = herkes).
 * Filtre: ?durum= · ?q= (kayıt no — numarasızlar "Taslak" — / sorumlu bölüm adı, normalizeTr).
 * Sıra: createdAt desc (Paket 3: numara onayda verildiği için kayitNo NULL olabilir).
 * Not (Faz 1 açık nokta): kapsam daraltma (kendi/kendi bölümü) YOK — tümü döner.
 */
export async function GET(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error

  const sp = request.nextUrl.searchParams
  const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(sp.get('pageSize') ?? '20', 10) || 20))

  // Kapsam TEK YERDE: manage → tümü, diğer → kendi/hazırlayan/bölüm (fif-access).
  const kapsam = await fifWhereForUser(session)
  const where: Prisma.FifWhereInput = { ...kapsam }
  const durum = sp.get('durum')
  if (durum && durum in FifDurum) where.durum = durum as FifDurum

  const [rows, total] = await Promise.all([
    prisma.fif.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        sorumluBolum: { select: { id: true, name: true } },
        yayinlayanBolum: { select: { id: true, name: true } },
        _count: { select: { faaliyetler: true } },
      },
    }),
    prisma.fif.count({ where }),
  ])

  // Arama: kayıt no VEYA sorumlu bölüm adı (Türkçe normalize, DB'ye inmeden —
  // liste küçük, uygunsuzluk-query'deki gibi ileride SQL'e taşınabilir).
  const q = normalizeTr((sp.get('q') ?? '').trim())
  const filtered = q
    ? rows.filter(
        (r) =>
          normalizeTr(fifEtiket(r)).includes(q) ||
          normalizeTr(r.sorumluBolum?.name ?? '').includes(q),
      )
    : rows

  const items = filtered
    .slice((page - 1) * pageSize, page * pageSize)
    .map((r) => ({
      id: r.id,
      kayitNo: r.kayitNo,
      tur: r.tur,
      tarih: r.tarih,
      durum: r.durum,
      sorumluBolum: r.sorumluBolum,
      yayinlayanBolum: r.yayinlayanBolum,
      uygunsuzlukTanimi: r.uygunsuzlukTanimi,
      faaliyetSayisi: r._count.faaliyetler,
    }))

  return NextResponse.json({ items, total: q ? filtered.length : total, page, pageSize })
}

/**
 * POST /api/kalite/fif — oluştur. Auth: oturum (herkes TASLAK açabilir).
 * Paket 3: NUMARA VERİLMEZ (kayitNo NULL) — KSS "Kayda Al"da üretilir; vazgeçilen
 * taslaklar numara harcamaz. Durum TASLAK. Kullanıcı/bölüm alanları düz string id.
 * Faaliyet satırında paraf/sonuç/gerçekleşen tarih istemciden ALINMAZ ("Faaliyeti
 * Kapat" ucu yazar); ilk hedef tarih sunucuda hedef tarihten kopyalanır.
 */
export async function POST(request: NextRequest) {
  const { userId, error } = await requireSession()
  if (error) return error
  // Oluşturma: oturumu olan HERKES yeni FİF (TASLAK) açabilir (kapsam düzeltmesi).

  const body = await request.json().catch(() => null)
  const parsed = fifInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Geçersiz veri', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const d = parsed.data

  // Yayılım kuralı (Rev 3): "var" işaretlendiyse açıklama zorunlu — TEK KAYNAK validator'da.
  const yay = yayilimGecerli(d.yayilimVarMi, d.yayilimAciklama)
  if (!yay.ok) return NextResponse.json({ error: yay.sebep }, { status: 400 })
  if (d.kaynakId) {
    const hata = await fifKaynakDogrula(d.kaynakId)
    if (hata) return NextResponse.json({ error: hata }, { status: 400 })
  }
  const tarih = d.tarih ?? new Date()

  const created = await prisma.fif.create({
    data: {
      tur: d.tur,
      tarih,
      durum: FifDurum.TASLAK,
      sorumluBolumId: d.sorumluBolumId ?? null,
      yayinlayanBolumId: d.yayinlayanBolumId ?? null,
      hazirlayanUserId: d.hazirlayanUserId ?? userId,
      // Paket 4: izleme sorumlusunu formu açan SEÇMEZ — sorumlu bölüm müdürü "Sorumlu Bölüm Onayı"nda seçer.
      sorumluOnaylayanUserId: d.sorumluOnaylayanUserId ?? null,
      yayinlayanOnaylayanUserId: d.yayinlayanOnaylayanUserId ?? null,
      kaynakId: d.kaynakId ?? null,
      uygunsuzlukTanimi: d.uygunsuzlukTanimi ?? null,
      standartMadde: d.standartMadde ?? null,
      kokNedenAnalizi: d.kokNedenAnalizi ?? null,
      kapatmaTarihi: d.kapatmaTarihi ?? null,
      kysDegisikligi: d.kysDegisikligi ?? false,
      riskFirsatGuncelleme: d.riskFirsatGuncelleme ?? false,
      ogrenilenDers: d.ogrenilenDers ?? false,
      yayilimVarMi: d.yayilimVarMi ?? false,
      yayilimAciklama: d.yayilimAciklama ?? null,
      createdById: userId,
      faaliyetler: d.faaliyetler?.length
        ? { create: d.faaliyetler.map((f) => ({
            sira: f.sira,
            aciklama: f.aciklama,
            aksiyonTuru: f.aksiyonTuru ?? null,
            hedefTarih: f.hedefTarih ?? null,
            ilkHedefTarih: f.hedefTarih ?? null,
            sorumluUserId: f.sorumluUserId ?? null,
          })) }
        : undefined,
      kokNedenler: d.kokNedenler?.length
        ? { create: d.kokNedenler.map((k) => ({ kategori: k.kategori, aciklama: k.aciklama })) }
        : undefined,
      besNedenler: d.besNedenler?.length
        ? { create: d.besNedenler.map((b) => ({
            muhtemelSebep: b.muhtemelSebep,
            neden1: b.neden1 ?? null, neden2: b.neden2 ?? null, neden3: b.neden3 ?? null,
            neden4: b.neden4 ?? null, neden5: b.neden5 ?? null,
          })) }
        : undefined,
      etkinlikler: d.etkinlikler?.length
        ? { create: d.etkinlikler.map((e) => ({
            madde: e.madde,
            planlananTarih: e.planlananTarih ?? null,
            gerceklesenTarih: e.gerceklesenTarih ?? null,
            uygun: e.uygun ?? null,
            onayUserId: e.onayUserId ?? null,
            onayTarihi: e.onayTarihi ?? null,
          })) }
        : undefined,
    },
    include: { faaliyetler: { orderBy: { sira: 'asc' } } },
  })

  return NextResponse.json({ item: created }, { status: 201 })
}
