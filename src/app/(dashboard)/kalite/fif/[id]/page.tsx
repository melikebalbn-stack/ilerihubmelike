import { redirect, notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { fifKapsamindaMi, fifDuzenleyebilirMi, canManageFif, isFifKss } from '@/lib/quality/fif-access'
import { uygunGecisler, altKayitDuzenlenebilir, yeniAkisMi, type FifGecisCtx, type FifGecisState } from '@/lib/quality/fif-durum'
import { fifKimdeBekliyor } from '@/lib/quality/fif-termin'
import { FifGecmisPanel } from '@/components/quality/fif/FifGecmisPanel'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { prisma } from '@/lib/prisma'
import { FifFormClient } from '@/components/quality/fif/FifFormClient'
import { FifDurumPanel } from '@/components/quality/fif/FifDurumPanel'
import { FifEklerPanel } from '@/components/quality/fif/FifEklerPanel'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { getSlaAyar, getTatilMap } from '@/lib/sla'
import { kokNedenSonTarihi } from '@/lib/quality/fif-eskalasyon'
import { fifEtiket } from '@/lib/quality/fif-durum-etiket'
import { FifDurum, FifEkTerminDurum } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

/** Kök neden uyarısının göründüğü durumlar: KSS kayda aldıktan (FAALIYET) sonrası. */
const KOK_NEDEN_UYARI_DURUMLARI = new Set<FifDurum>([
  FifDurum.FAALIYET, FifDurum.KAPATMA_BEKLIYOR, FifDurum.KSS_KAPANIS_BEKLIYOR, FifDurum.ETKINLIK, FifDurum.KAPANDI,
])

/**
 * FİF detay — durum paneli (kimde bekliyor) + form + ekler + geçmiş.
 * Görme: fifKapsamindaMi (satır sorumlusu dahil). Form düzenleme: fifDuzenleyebilirMi
 * (satır sorumlusu SALT-OKUNUR görür; kendi satırında Kapat / Ek Termin İste yapar).
 */
export default async function FifDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser()
  if (error) redirect('/login')

  const { id } = await params
  const fif = await prisma.fif.findUnique({
    where: { id },
    include: {
      faaliyetler: {
        orderBy: { sira: 'asc' },
        // Satırın BEKLEYEN ek termin talebi (en fazla bir tane — ek-termin ucu garanti eder).
        include: { ekTerminler: { where: { durum: FifEkTerminDurum.BEKLIYOR }, orderBy: { createdAt: 'desc' }, take: 1 } },
      },
      etkinlikler: true,
      kokNedenler: true,
      besNedenler: true,
      ekler: { orderBy: { createdAt: 'asc' } },
      gecmis: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!fif) notFound()
  if (!(await fifKapsamindaMi(session, fif))) return <YetkisizErisim permission="fif.view" />
  const duzenlenebilir = await fifDuzenleyebilirMi(session, fif)

  // Durum geçişleri için ctx: manage + sorumlu bölüm müdürü User id.
  let sorumluBolumMudurUserId: string | null = null
  if (fif.sorumluBolumId) {
    const dept = await prisma.departmentDefinition.findUnique({ where: { id: fif.sorumluBolumId }, select: { mudurId: true } })
    if (dept?.mudurId) {
      const u = await prisma.user.findFirst({ where: { personnelId: dept.mudurId, isActive: true }, select: { id: true } })
      sorumluBolumMudurUserId = u?.id ?? null
    }
  }
  // isKss: API (durum/route.ts) ile AYNI ctx/state — eksikken KSS kullanıcısı
  // "Kayda Al" / "Kapanışı Onayla" butonlarını göremiyordu.
  const ctx: FifGecisCtx = {
    userId: session.user.id, isManage: canManageFif(session), sorumluBolumMudurUserId, isKss: await isFifKss(session),
  }
  const gecisState: FifGecisState = {
    durum: fif.durum, createdById: fif.createdById, hazirlayanUserId: fif.hazirlayanUserId,
    yayinlayanOnaylayanUserId: fif.yayinlayanOnaylayanUserId, sorumluOnaylayanUserId: fif.sorumluOnaylayanUserId,
    izlemeSorumlusuUserId: fif.izlemeSorumlusuUserId,
    sorumluBolumId: fif.sorumluBolumId, yayinlayanBolumId: fif.yayinlayanBolumId,
    uygunsuzlukTanimi: fif.uygunsuzlukTanimi, tur: fif.tur,
    yayilimVarMi: fif.yayilimVarMi, yayilimAciklama: fif.yayilimAciklama,
    faaliyetler: fif.faaliyetler, etkinlikler: fif.etkinlikler,
  }
  // Durum geçişleri (form düzenleme yetkisi olmayan satır sorumlusu da görür;
  // geçiş kuralları kendi rol kontrolünü yapar). yeniAkis: satır bazlı etkinlik.
  const gecisler = uygunGecisler(ctx, gecisState)
  const yeniAkis = yeniAkisMi(gecisState)

  // userId → ad (düz string; TEK sorguda): geçmiş + formdaki kayıtlı kişiler + paraflar.
  const userIds = [...new Set(
    [
      ...fif.gecmis.map((g) => g.userId),
      fif.hazirlayanUserId, fif.sorumluOnaylayanUserId, fif.yayinlayanOnaylayanUserId,
      fif.izlemeSorumlusuUserId,
      ...fif.faaliyetler.flatMap((f) => [f.parafUserId, f.sorumluUserId, f.etkinlikKontrolUserId, ...f.ekTerminler.map((t) => t.talepEdenUserId)]),
    ].filter((x): x is string => !!x),
  )]
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, personnel: { select: { adSoyad: true } } } })
    : []
  const adById = new Map(users.map((u) => [u.id, u.name || u.personnel?.adSoyad || u.id]))
  const kullaniciAdlari = Object.fromEntries(adById)
  const siraById = new Map(fif.faaliyetler.map((f) => [f.id, f.sira]))
  const gecmis = fif.gecmis.map((g) => ({
    id: g.id, eskiDurum: g.eskiDurum, yeniDurum: g.yeniDurum, olay: g.olay,
    userAd: g.userId ? adById.get(g.userId) ?? null : null,
    aciklama: g.aciklama, createdAt: g.createdAt.toISOString(),
    faaliyetId: g.faaliyetId, faaliyetSira: g.faaliyetId ? siraById.get(g.faaliyetId) ?? null : null,
  }))
  const kimde = fifKimdeBekliyor({
    durum: fif.durum, yeniAkis,
    hazirlayanAd: adById.get(fif.hazirlayanUserId ?? fif.createdById ?? '') ?? null,
    yayinlayanOnaylayanAd: fif.yayinlayanOnaylayanUserId ? adById.get(fif.yayinlayanOnaylayanUserId) ?? null : null,
    satirlar: fif.faaliyetler.map((f) => ({
      sonuc: f.sonuc, gerceklesenTarih: f.gerceklesenTarih, etkinlikPlanTarihi: f.etkinlikPlanTarihi,
      etkinlikUygun: f.etkinlikUygun, bekleyenTalep: f.ekTerminler.length > 0,
      sorumluAd: f.sorumluUserId ? adById.get(f.sorumluUserId) ?? null : null,
    })),
  }, new Date())

  const initial = {
    id: fif.id, kayitNo: fif.kayitNo, tur: fif.tur, tarih: fif.tarih.toISOString(), durum: fif.durum,
    sorumluBolumId: fif.sorumluBolumId, yayinlayanBolumId: fif.yayinlayanBolumId,
    sorumluOnaylayanUserId: fif.sorumluOnaylayanUserId,
    yayinlayanOnaylayanUserId: fif.yayinlayanOnaylayanUserId,
    izlemeSorumlusuUserId: fif.izlemeSorumlusuUserId,
    kaynakId: fif.kaynakId,
    denetlemeAdi: fif.denetlemeAdi, uygunsuzlukTanimi: fif.uygunsuzlukTanimi,
    standartMadde: fif.standartMadde, ekTerminNedeni: fif.ekTerminNedeni, kokNedenAnalizi: fif.kokNedenAnalizi,
    // Kapanış değerlendirmesi (Rev 3) — alanlar şemada vardı, ekrana FAZ A'da çıktı.
    kysDegisikligi: fif.kysDegisikligi,
    riskFirsatGuncelleme: fif.riskFirsatGuncelleme,
    ogrenilenDers: fif.ogrenilenDers,
    yayilimVarMi: fif.yayilimVarMi,
    yayilimAciklama: fif.yayilimAciklama,
    faaliyetler: fif.faaliyetler.map((f) => ({
      id: f.id, sira: f.sira, aciklama: f.aciklama,
      aksiyonTuru: f.aksiyonTuru,
      hedefTarih: f.hedefTarih ? f.hedefTarih.toISOString() : null,
      // Paket 3: satır sorumlusu + termin rozetleri + kapalı kilidi.
      sorumluUserId: f.sorumluUserId,
      ilkHedefTarih: f.ilkHedefTarih ? f.ilkHedefTarih.toISOString() : null,
      gerceklesenTarih: f.gerceklesenTarih ? f.gerceklesenTarih.toISOString() : null,
      sonuc: f.sonuc,
      // Paket 3b-2: satır bazlı etkinlik + bekleyen ek termin talebi.
      etkinlikPlanTarihi: f.etkinlikPlanTarihi ? f.etkinlikPlanTarihi.toISOString() : null,
      etkinlikUygun: f.etkinlikUygun,
      bekleyenTalep: f.ekTerminler[0]
        ? {
            id: f.ekTerminler[0].id,
            istenenHedefTarih: f.ekTerminler[0].istenenHedefTarih.toISOString(),
            mevcutHedefTarih: f.ekTerminler[0].mevcutHedefTarih ? f.ekTerminler[0].mevcutHedefTarih.toISOString() : null,
            neden: f.ekTerminler[0].neden,
            talepEdenAd: adById.get(f.ekTerminler[0].talepEdenUserId) ?? '—',
          }
        : null,
    })),
  }

  // 5 İŞ GÜNÜ KÖK NEDEN UYARISI: FAALIYET ve sonrası durumlarda, kök neden (özet
  // metin + Ek-1 balık kılçığı + 5 Neden) hiç girilmemişse. Başlangıç = KSS'nin
  // "Kayda Al" anı: FAALIYET'e İLK giriş (yeniden faaliyete dönüşte süre
  // sıfırlanmaz). İş günü eskalasyonla AYNI SLA takviminden.
  const kokNedenBos = !fif.kokNedenAnalizi?.trim() && fif.kokNedenler.length === 0 && fif.besNedenler.length === 0
  let kokNedenUyari: { sonTarih: string; gecikti: boolean } | null = null
  if (kokNedenBos && KOK_NEDEN_UYARI_DURUMLARI.has(fif.durum)) {
    const kayda = [...fif.gecmis].reverse().find((g) => g.yeniDurum === FifDurum.FAALIYET)
    const baslangic = kayda?.createdAt ?? fif.createdAt
    const yil = baslangic.getFullYear()
    const [ayar, tatilMap] = await Promise.all([getSlaAyar(), getTatilMap([yil, yil + 1])])
    const s = kokNedenSonTarihi(baslangic, tatilMap, ayar, new Date())
    kokNedenUyari = {
      sonTarih: s.sonGun.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }),
      gecikti: s.gecikti,
    }
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[#1B4F72]">FİF Detay — {fifEtiket(fif)}</h1>
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 border rounded px-2 py-0.5">KAL-FR-10 · Rev 3</span>
      </div>
      {kokNedenUyari && (
        <Alert variant={kokNedenUyari.gecikti ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{kokNedenUyari.gecikti ? 'Kök neden analizi süresi geçti' : 'Kök neden analizi bekleniyor'}</AlertTitle>
          <AlertDescription>
            FİF açıldıktan sonra 5 iş günü içerisinde kök neden analizinin doldurulması gerekmektedir. Son tarih: {kokNedenUyari.sonTarih}
          </AlertDescription>
        </Alert>
      )}
      <FifDurumPanel
        fifId={fif.id} durum={fif.durum} gecisler={gecisler} kimde={kimde} yeniAkis={yeniAkis}
      />
      {/* key: kayıt değişince (durum geçişi/kaydet) form yeniden kurulur — yoksa
          useState eski değerleri tutuyor, sonraki Kaydet sunucudaki güncel veriyi eziyordu. */}
      <FifFormClient
        key={fif.updatedAt.toISOString()} initial={initial} kullaniciAdlari={kullaniciAdlari}
        aktifKullaniciId={session.user.id} duzenlenebilir={duzenlenebilir} isKss={ctx.isKss ?? false}
      />
      <FifEklerPanel
        fifId={fif.id}
        durum={fif.durum}
        duzenlenebilir={duzenlenebilir && altKayitDuzenlenebilir(ctx, fif.durum)}
        // Eski FİF geneli etkinlik sekmesi YALNIZ eski akışta: KSS kapanış onayı
        // (hub/main gibi) FifEtkinlik maddelerini yeni akışta da açar; o zaman satır
        // bazlı etkinlik geçerli olduğundan sekme gizlenir.
        eskiEtkinlikAkisi={!yeniAkis && (fif.etkinlikler.length > 0 || fif.durum === FifDurum.ETKINLIK)}
        etkinlikler={fif.etkinlikler.map((e) => ({ madde: e.madde, planlananTarih: e.planlananTarih ? e.planlananTarih.toISOString() : null, gerceklesenTarih: e.gerceklesenTarih ? e.gerceklesenTarih.toISOString() : null, uygun: e.uygun }))}
        kokNedenler={fif.kokNedenler.map((k) => ({ kategori: k.kategori, aciklama: k.aciklama }))}
        besNedenler={fif.besNedenler.map((b) => ({ muhtemelSebep: b.muhtemelSebep, neden1: b.neden1, neden2: b.neden2, neden3: b.neden3, neden4: b.neden4, neden5: b.neden5 }))}
        ekler={fif.ekler.map((e) => ({ id: e.id, tip: e.tip, dosyaYolu: e.dosyaYolu }))}
      />
      <FifGecmisPanel kayitlar={gecmis} faaliyetler={fif.faaliyetler.map((f) => ({ id: f.id, sira: f.sira }))} />
    </div>
  )
}
