import { NextRequest, NextResponse } from 'next/server'
import { ifsKuyrugaEkle, personelKuyrukKayitlari } from '@/lib/ifs/personel-sync/kuyruk'
import { personelPutGovdesiniHazirla } from '@/lib/personnel/put-govde'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { logAuditEvent } from '@/lib/audit-log'
import { computeTenure } from '@/lib/personnel-tenure'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'
import { YAKA_DETAY_MAP } from '@/lib/personnel-constants'
import { CIKIS_DEVIR_TIPLERI, CIKIS_TARAFLARI, sgkCikisKoduGecerliMi } from '@/lib/sgk-cikis-kodlari'
import { personelPasiflestiginde, personelAktiflestiginde, personelGoreviDegisti, personelEklendiginde, KOLTUK_YOK_SEBEBI, type GorevDegisimSonuc, type YeniPersonelSonuc } from '@/lib/org/personel-koltuk-senkron'

export const dynamic = 'force-dynamic'

const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']
const DELETE_ROLES = ['ADMIN', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  return isInsanVarliklari(dept)
}

function hasEditAccess(role: string, department?: string | null): boolean {
  return EDIT_ROLES.includes(role) || isHRDepartment(department)
}

// Beden profili girdisini normalize eder: boş string'ler null'a, olcuTarihi Date'e çevrilir.
// Hiçbir alan dolu değilse null döner → boş profil satırı OLUŞTURULMAZ/UPSERT edilmez.
function normalizeBeden(beden: unknown): {
  ustBeden: string | null
  altBeden: string | null
  ayakkabiNo: string | null
  eldivenNo: string | null
  olcuTarihi: Date | null
  not: string | null
} | null {
  if (!beden || typeof beden !== 'object') return null
  const b = beden as Record<string, unknown>
  const str = (v: unknown) => {
    if (v === null || v === undefined) return null
    const s = String(v).trim()
    return s === '' ? null : s
  }
  const ustBeden = str(b.ustBeden)
  const altBeden = str(b.altBeden)
  const ayakkabiNo = str(b.ayakkabiNo)
  const eldivenNo = str(b.eldivenNo)
  const not = str(b.not)
  const olcuRaw = str(b.olcuTarihi)
  const olcuTarihi = olcuRaw ? new Date(olcuRaw) : null
  if (!ustBeden && !altBeden && !ayakkabiNo && !eldivenNo && !not && !olcuTarihi) return null
  return { ustBeden, altBeden, ayakkabiNo, eldivenNo, olcuTarihi, not }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // PR-PERSONNEL-SECURITY: HR-only role check (PII expose kapatıldı)
    const { user, error } = await requireUser()
    if (error) return error

    if (!hasEditAccess(user.role, user.department)) {
      return NextResponse.json({ error: 'Personel detayı için HR yetkisi gerekli' }, { status: 403 })
    }

    const personnel = await prisma.personnel.findUnique({
      where: { id },
      select: {
        id: true,
        sicilNo: true,
        sinif: true,
        cinsiyet: true,
        adSoyad: true,
        yakaRengi: true,
        yakaDetayi: true,
        direktEndirekt: true,
        asansorMekanik: true,
        iseGirisTarihi: true,
        gorev: true,
        bolumDetay: true,
        bolum: true,
        birimSorumlusu: true,
        sorumlu2: true,
        sorumlu3: true,
        bolumMuduru: true,
        // SORUMLU-FK-YAZMA: düzenleme formu seçiciyi FK ile ön-doldurabilsin diye.
        sorumlu1Id: true,
        sorumlu2Id: true,
        sorumlu3Id: true,
        masrafMerkezi: true,
        interKepMail: true,
        mailAdresi: true,
        ikametAdresi: true,
        denemeDegerlendirme: true,
        altiAyDegerlendirme: true,
        telefon: true,
        kanGrubu: true,
        serviceRoute: true,
        serviceStop: true,
        egitimYeri: true,
        egitimTipi: true,
        egitimAlani: true,
        mezuniyetYili: true,
        ilkYardimciBelgesi: true,
        kalfalikBelgesi: true,
        ustalikBelgesi: true,
        forkliftEhliyeti: true,
        vincEhliyeti: true,
        mykBelgesiTarihi: true,
        yanginSertifikasi: true,
        eTrans: true,
        ustaOgreticiBelgesi: true,
        emekli: true,
        engelli: true,
        aktif: true,
        // PR-4a: Personnel.exit* artık okunmuyor — çıkış verisi EmploymentPeriod'dan
        // (lastClosedPeriod). Alanlar 4b'de DROP edilecek.
        azureAdId: true,
        azureAdEmail: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        // Faz 6 — bu kart hangi başvurudan doğdu (varsa). Yalnız numara + id döner;
        // başvurunun İÇERİĞİ buradan SIZMAZ (detay ayrı uçta, kendi yetkisiyle).
        jobApplicationId: true,
        jobApplication: { select: { id: true, applicationNumber: true, createdAt: true } },
        // Envanter: personel beden profili (1-1, opsiyonel)
        bedenProfili: {
          select: {
            ustBeden: true,
            altBeden: true,
            ayakkabiNo: true,
            eldivenNo: true,
            olcuTarihi: true,
            not: true,
          },
        },
        // PR-C: İstihdam Geçmişi (salt görüntüleme) — kronolojik dönemler
        employmentPeriods: {
          select: {
            id: true,
            girisTarihi: true,
            cikisTarihi: true,
            exitParty: true,
            exitCode: true,
            exitReason: true,
            exitRootCause: true,
            exitTurnoverType: true,
            exitGeneralNote: true,
            entryRecordedAt: true,
            exitRecordedAt: true,
            exitRecordedById: true,
          },
          orderBy: { girisTarihi: 'asc' },
        },
      },
    })

    if (!personnel) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }

    // PR-C: dönem-tabanlı toplam kıdem özeti (boşluklar sayılmaz). Backfill ile her
    // personelin ≥1 dönemi var; dönem yoksa null → UI eski workingPeriod'a düşer.
    const employmentSummary =
      personnel.employmentPeriods.length > 0
        ? computeTenure(personnel.employmentPeriods)
        : null

    // PR-EXIT-READ-FROM-PERIODS: Çıkış Bilgileri kartı artık en son KAPALI dönemden
    // beslenir (Personnel.exit* PR-4'te düşecek). Çıkış-giriş yapmış aktif kişide de
    // kapalı dönem kalır → kart görünür, "Çıkış-Giriş (aktif)" olarak işaretlenir.
    const closedPeriods = personnel.employmentPeriods.filter((p) => p.cikisTarihi != null)
    const lastClosed = closedPeriods.length
      ? closedPeriods.reduce((a, b) =>
          new Date(a.cikisTarihi as Date).getTime() >= new Date(b.cikisTarihi as Date).getTime() ? a : b
        )
      : null

    let lastClosedPeriod: {
      girisTarihi: Date
      cikisTarihi: Date | null
      exitParty: string | null
      exitCode: string | null
      exitReason: string | null
      exitRootCause: string | null
      exitTurnoverType: string | null
      exitGeneralNote: string | null
      exitRecordedAt: Date | null
      exitRecordedBy: { name: string | null; email: string } | null
      workingPeriod: { years: number; months: number; totalMonths: number } | null
    } | null = null

    if (lastClosed) {
      let recordedBy: { name: string | null; email: string } | null = null
      if (lastClosed.exitRecordedById) {
        const u = await prisma.user.findUnique({
          where: { id: lastClosed.exitRecordedById },
          select: { name: true, email: true },
        })
        recordedBy = u ? { name: u.name, email: u.email } : null
      }

      let wp: { years: number; months: number; totalMonths: number } | null = null
      if (lastClosed.girisTarihi && lastClosed.cikisTarihi) {
        const s = new Date(lastClosed.girisTarihi)
        const e = new Date(lastClosed.cikisTarihi)
        let m = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
        if (e.getDate() < s.getDate()) m -= 1
        if (m < 0) m = 0
        wp = { years: Math.floor(m / 12), months: m % 12, totalMonths: m }
      }

      lastClosedPeriod = {
        girisTarihi: lastClosed.girisTarihi,
        cikisTarihi: lastClosed.cikisTarihi,
        exitParty: lastClosed.exitParty,
        exitCode: lastClosed.exitCode,
        exitReason: lastClosed.exitReason,
        exitRootCause: lastClosed.exitRootCause,
        exitTurnoverType: lastClosed.exitTurnoverType,
        exitGeneralNote: lastClosed.exitGeneralNote,
        exitRecordedAt: lastClosed.exitRecordedAt,
        exitRecordedBy: recordedBy,
        workingPeriod: wp,
      }
    }

    // PR-AUDIT-LOG-EXPANSION (KVKK): kişisel veriye erişim audit
    // Hassas alan KAYDEDİLMEZ — sadece referans id + sicilNo
    await logAuditEvent({
      action: 'PERSONNEL_DETAIL_VIEWED',
      actorId: user.id,
      targetType: 'PERSONNEL',
      targetId: personnel.id,
      details: {
        actorEmail: user.email,
        sicilNo: personnel.sicilNo,
      },
    })

    // ŞEMA KOLTUĞU — "Şemaya Yerleştir" düğmesi bunun BOŞ olmasına bakar.
    // ANA koltuk = kurul/komite (ORG-KR-*) DIŞINDAKİ açık koltuk; filtre
    // personel-koltuk-senkron.ts'teki `anaKoltuklar` ile AYNI kural.
    // Personnel↔OrgEmployee arasında Prisma ilişkisi yok (personnelId düz kolon),
    // bu yüzden ayrı sorgu.
    const koltuklar = await prisma.orgEmployee.findMany({
      where: { personnelId: id, isActive: true },
      select: { id: true, orgUnit: { select: { code: true, name: true } } },
    })
    const anaKoltuklar = koltuklar
      .filter((k) => !k.orgUnit?.code?.startsWith('ORG-KR-'))
      .map((k) => ({ id: k.id, code: k.orgUnit?.code ?? null, ad: k.orgUnit?.name ?? null }))

    return NextResponse.json({
      ...personnel,
      employmentSummary,
      lastClosedPeriod,
      anaKoltuklar,
    })
  } catch (error) {
    console.error('Personel detayı alınırken hata:', error)
    return NextResponse.json({ error: 'Personel detayı alınırken bir hata oluştu' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-personnel: requireUser — role + department check
    const { user, error } = await requireUser()
    if (error) return error

    const { id: personnelId } = await params

    if (!hasEditAccess(user.role, user.department)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const existing = await prisma.personnel.findUnique({ where: { id: personnelId } })
    if (!existing) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }

    const ham = await request.json()
    // ?dryRun=1 — gövde boru hattını (beyaz liste, normalize, FK çözümü, doğrulama)
    // koşturur, YAZMAZ ve denetim kaydı ÜRETMEZ; yazılacak veriyi döndürür.
    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'

    // BEYAZ LİSTE (PERSONNEL-PUT-BEYAZ-LISTE, 12.09.2026): kara liste (delete body.X)
    // kalktı. Yalnız IZINLI_ALANLAR alınır; gövdedeki tanınmayan anahtarlar atılır ve
    // denetim kaydına `atilanAlanlar` olarak yazılır. Detay: @/lib/personnel/put-govde.
    const { data: body, atilanAlanlar, bedenInput } = await personelPutGovdesiniHazirla(prisma, ham, personnelId)

    // Yaka Aşama 1: efektif yaka/detay (body vermiyorsa mevcut değer). Aktif personelde
    // ikisi de zorunlu; her durumda yaka-detay tutarlı olmalı (YAKA_DETAY_MAP).
    const effYaka = body.yakaRengi !== undefined ? body.yakaRengi : existing.yakaRengi
    const effDetay = body.yakaDetayi !== undefined ? body.yakaDetayi : existing.yakaDetayi
    if (existing.aktif && (!effYaka || !effDetay)) {
      return NextResponse.json({ error: 'Aktif personel için Yaka Rengi ve Yaka Detayı zorunludur' }, { status: 400 })
    }
    if (effYaka && effDetay) {
      const izinliDetay = YAKA_DETAY_MAP[effYaka as string] ?? []
      if (!izinliDetay.includes(effDetay as string)) {
        return NextResponse.json({ error: 'Yaka Detayı, seçilen Yaka Rengi ile uyumsuz' }, { status: 400 })
      }
    }

    // Personnel update + beden profili upsert = TEK transaction.
    // Beden: yalnız en az bir alan doluysa upsert edilir (boş kayıt yaratma).
    const bedenData = normalizeBeden(bedenInput)

    if (dryRun) {
      return NextResponse.json({ dryRun: true, data: body, beden: bedenData, atilanAlanlar })
    }
    // Görev VEYA bölüm değiştiyse şemadaki ana koltuk da taşınır (kurul koltukları
    // etkilenmez). Eşleşme `{bolum, gorev}` ÇİFTİNDEN çözülüyor; bu yüzden tetikleyici
    // de iki alanı birlikte izler. Eskiden yalnız `gorev` izleniyordu ve bölüm tek
    // başına değişince kişi eski bölümün kutusunda kalıyordu (03.09.2026 ölçümü).
    const gorevDegisti =
      typeof body.gorev === 'string' && body.gorev !== (existing.gorev ?? '')
    const bolumDegisti =
      typeof body.bolum === 'string' && body.bolum !== (existing.bolum ?? '')
    const yerlesimDegisti = gorevDegisti || bolumDegisti
    let koltukSonuc: GorevDegisimSonuc | null = null
    // Taşıma "ana koltuğu yok" derse koltuk AÇILIR (aşağıda). Sonuç ayrı tutulur ki
    // denetim kaydında "taşındı" ile "açıldı" karışmasın.
    let koltukAcmaSonuc: YeniPersonelSonuc | null = null
    const updatedPersonnel = await prisma.$transaction(async (tx) => {
      const updated = await tx.personnel.update({
        where: { id: personnelId },
        data: body,
      })
      if (bedenData) {
        await tx.envanterPersonelBedenProfili.upsert({
          where: { personnelId },
          create: { personnelId, ...bedenData, updatedById: user.id },
          update: { ...bedenData, updatedById: user.id },
        })
      }
      if (yerlesimDegisti) {
        koltukSonuc = await personelGoreviDegisti(tx, personnelId, { actorId: user.id })
        // KOLTUK YOKSA AÇ: taşıma fonksiyonu yalnız TAŞIR (sözleşmesi bu, dokunulmadı).
        // Koltuğu hiç açılmamış kişi — oluşturulurken görev/bölüm şemadaki bir kutuyla
        // eşleşmediyse böyle olur (ör. ILR-01156: açılışta görev "ROBOT KAYNAK" idi,
        // şemada "Robot Kaynak Opr." var) — sonradan alan düzeltilse bile koltuksuz
        // kalıyordu. Artık düzeltme anında BİR KEZ açma denenir.
        // `personelEklendiginde` idempotent: açık koltuk varsa "zaten acik koltugu var"
        // ile erken döner, boş kutu yoksa/eşleşme yoksa sebebiyle döner — YENİ KUTU AÇMAZ.
        if (koltukSonuc && !koltukSonuc.tasindi && koltukSonuc.sebep === KOLTUK_YOK_SEBEBI) {
          koltukAcmaSonuc = await personelEklendiginde(tx, personnelId, { actorId: user.id })
        }
      }
      return updated
    })

    // IFS senkron kuyruğu (faz 1): kişi katmanları yeniden değerlendirilsin. Ateşle-unut.
    await ifsKuyrugaEkle(prisma, personelKuyrukKayitlari(personnelId), 'HOOK:personnel-put')

    // PR-AUDIT-LOG-EXPANSION (KVKK)
    await logAuditEvent({
      action: 'PERSONNEL_UPDATED',
      actorId: user.id,
      targetType: 'PERSONNEL',
      targetId: personnelId,
      details: {
        actorEmail: user.email,
        sicilNo: existing.sicilNo,
        changedFieldKeys: Object.keys(body),
        // Beyaz liste dışı kalıp sessizce atılan gövde anahtarları — boşsa da yazılır.
        atilanAlanlar,
        ...(gorevDegisti ? { gorevDegisimi: { eski: existing.gorev, yeni: body.gorev } } : {}),
        ...(bolumDegisti ? { bolumDegisimi: { eski: existing.bolum, yeni: body.bolum } } : {}),
        // Koltuk sonucu görev VEYA bölüm değişiminde yazılır — taşınmadıysa sebebiyle.
        // `koltukAcma` yalnız açma DENENDİYSE bulunur; "taşındı" ile karışmasın diye ayrı alan.
        ...(yerlesimDegisti ? { koltuk: koltukSonuc } : {}),
        ...(koltukAcmaSonuc ? { koltukAcma: koltukAcmaSonuc } : {}),
      },
    })

    return NextResponse.json({
      ...updatedPersonnel,
      ...(yerlesimDegisti ? { koltuk: koltukSonuc } : {}),
      ...(koltukAcmaSonuc ? { koltukAcma: koltukAcmaSonuc } : {}),
    })
  } catch (error: any) {
    console.error('Personel güncellenirken hata:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Bu sicil numarası zaten kayıtlı' }, { status: 409 })
    }
    // Prisma VALİDASYON hatası = gövdede şemaya uymayan alan var (Faz 6 regresyonundaki
    // gibi). Kullanıcı "kaydedilemedi" dışında bir şey anlayamaz; ham Prisma metni ise
    // model/alan yapısını sızdırır → KULLANICIYA GÖNDERİLMEZ, yalnız yukarıdaki
    // console.error ile sunucu loguna yazılır (üstteki satır korundu).
    if (error?.name === 'PrismaClientValidationError') {
      return NextResponse.json(
        { error: 'Kaydedilemeyen alan var, sistem yöneticisine bildirin' },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: 'Personel güncellenirken bir hata oluştu' }, { status: 500 })
  }
}

// SGK-CIKIS-KODU (16.09.2026): exitCode artık SGK işten ayrılış kodu (tek kaynak
// src/lib/sgk-cikis-kodlari.ts); exitParty / exitTurnoverType sabit sözlükten. Yalnız YENİ
// yazımlar doğrulanır — eski EmploymentPeriod kayıtlarındaki serbest metin (İSTİFA, İŞÇİ-DENEME…)
// okunmaya devam eder, geriye dönük doğrulama yok.
function cikisAlanlariniDogrula(b: { exitCode?: unknown; exitParty?: unknown; exitTurnoverType?: unknown }): string | null {
  if (b.exitCode !== undefined && b.exitCode !== null && b.exitCode !== '' && !sgkCikisKoduGecerliMi(String(b.exitCode))) {
    return `Çıkış kodu SGK işten ayrılış kodu olmalı (ör. 03); gelen: "${String(b.exitCode).slice(0, 40)}"`
  }
  if (b.exitParty !== undefined && b.exitParty !== null && b.exitParty !== '' && !(CIKIS_TARAFLARI as readonly string[]).includes(String(b.exitParty).trim())) {
    return `Çıkış tarafı şunlardan biri olmalı: ${CIKIS_TARAFLARI.join(', ')}`
  }
  if (b.exitTurnoverType !== undefined && b.exitTurnoverType !== null && b.exitTurnoverType !== '' && !(CIKIS_DEVIR_TIPLERI as readonly string[]).includes(String(b.exitTurnoverType).trim())) {
    return `Devir tipi şunlardan biri olmalı: ${CIKIS_DEVIR_TIPLERI.join(', ')}`
  }
  return null
}

// PR-PERSONEL-CIKIS-FORMU: Pasife alma + çıkış bilgileri akışı.
//
// 4 senaryo (mutually exclusive — order matters):
//   1. Pasife alma: aktif true → false. 6 exit alanı zorunlu.
//   2. Aktife geri alma: aktif false → true. Tüm exit alanları temizlenir.
//   3. Pasif personel exit alanları düzenleme: aktif false ve aktif değişmiyor.
//   4. Aktif personel için PATCH (yalnız exit field gönderirse) — reddedilir.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    if (!hasEditAccess(user.role, user.department)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const personnel = await prisma.personnel.findUnique({ where: { id } })
    if (!personnel) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))

    // SENARYO 1: Pasife alma (aktif: true → false)
    if (body.aktif === false && personnel.aktif === true) {
      const required = ['exitDate', 'exitParty', 'exitCode', 'exitReason', 'exitRootCause', 'exitTurnoverType']
      const missing = required.filter((k) => !body[k] || String(body[k]).trim() === '')
      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: 'Çıkış bilgileri eksik',
            required,
            missing,
          },
          { status: 400 }
        )
      }

      const dogrulamaHatasi = cikisAlanlariniDogrula(body)
      if (dogrulamaHatasi) return NextResponse.json({ error: dogrulamaHatasi }, { status: 400 })

      const exitDateVal = new Date(body.exitDate)
      const recordedAt = new Date()
      const exitParty = String(body.exitParty).trim()
      const exitCode = String(body.exitCode).trim()
      const exitReason = String(body.exitReason).trim()
      const exitRootCause = String(body.exitRootCause).trim()
      const exitTurnoverType = String(body.exitTurnoverType).trim()
      const exitGeneralNote = body.exitGeneralNote ? String(body.exitGeneralNote) : null

      // PR-3 (tek-kaynak): Çıkış = SADECE açık dönemi kapat. Personnel.exit* YAZILMAZ,
      // Personnel'de yalnız aktif:false. Açık dönem yoksa dönemsiz çıkış (leavers'da
      // görünmez kayıt) yasak → hiçbir şey yazma, 409 dön.
      try {
        const updated = await prisma.$transaction(async (tx) => {
          const openPeriod = await tx.employmentPeriod.findFirst({
            where: { personnelId: id, cikisTarihi: null },
            select: { id: true },
          })
          if (!openPeriod) {
            const e = new Error('NO_OPEN_PERIOD') as Error & { code?: string }
            e.code = 'NO_OPEN_PERIOD'
            throw e
          }
          const u = await tx.personnel.update({
            where: { id },
            data: { aktif: false },
          })
          await tx.employmentPeriod.update({
            where: { id: openPeriod.id },
            data: {
              cikisTarihi: exitDateVal,
              exitParty,
              exitCode,
              exitReason,
              exitRootCause,
              exitTurnoverType,
              exitGeneralNote,
              exitRecordedById: user.id,
              exitRecordedAt: recordedAt,
            },
          })
          // Org senkronu: koltuk boşalt + vekalet kaldır (aynı transaction — atomik).
          await personelPasiflestiginde(tx, id, { sebep: 'CIKIS', actorId: user.id })
          return u
        })

        // KVKK: kayıt anahtarları + tarih saklanır, açıklama metni saklanmaz
        await ifsKuyrugaEkle(prisma, personelKuyrukKayitlari(id), 'HOOK:personnel-deactivate')
        await logAuditEvent({
          action: 'PERSONNEL_DEACTIVATED', // IFS kuyruğu aşağıda (pasifleştirme → EmploymentEndDate + SF Blocked)
          actorId: user.id,
          targetType: 'PERSONNEL',
          targetId: id,
          details: {
            actorEmail: user.email,
            sicilNo: personnel.sicilNo,
            exitDate: body.exitDate,
            exitCode: String(body.exitCode).trim(),
            exitTurnoverType: String(body.exitTurnoverType).trim(),
          },
        })

        return NextResponse.json({ ok: true, personnel: updated })
      } catch (e) {
        const code = (e as { code?: string })?.code
        if (code === 'NO_OPEN_PERIOD') {
          return NextResponse.json(
            { error: 'Bu personelin açık istihdam dönemi yok — çıkış işlenemez. Önce istihdam geçmişini kontrol edin.' },
            { status: 409 }
          )
        }
        throw e
      }
    }

    // SENARYO 2: Aktife geri alma (aktif: false → true)
    if (body.aktif === true && personnel.aktif === false) {
      // PR-B: reentryDate doğrula (zod, opsiyonel) — verilmezse bugün.
      let reentryDate: Date
      const rawReentry = body.reentryDate
      if (rawReentry === undefined || rawReentry === null || rawReentry === '') {
        reentryDate = new Date()
      } else {
        const parsed = z.coerce.date().safeParse(rawReentry)
        if (!parsed.success) {
          return NextResponse.json({ error: 'Geçersiz yeniden giriş tarihi' }, { status: 400 })
        }
        reentryDate = parsed.data
      }

      // Yeniden giriş, son KAPALI dönemin çıkış tarihinden ÖNCE olamaz
      const lastClosed = await prisma.employmentPeriod.findFirst({
        where: { personnelId: id, cikisTarihi: { not: null } },
        orderBy: { cikisTarihi: 'desc' },
        select: { cikisTarihi: true },
      })
      if (lastClosed?.cikisTarihi && reentryDate < lastClosed.cikisTarihi) {
        return NextResponse.json(
          { error: 'Yeniden giriş tarihi son çıkış tarihinden önce olamaz' },
          { status: 400 }
        )
      }

      try {
        // PR-3 (tek-kaynak): Reentry = YENİ açık dönem aç. Personnel'de yalnız aktif:true.
        // exit* null'lama YOK (alanlar artık ne okunuyor ne yazılıyor; PR-4'te düşecek).
        // iseGirisTarihi'ye DOKUNULMAZ (ilk giriş korunur).
        const { updated, newPeriodId } = await prisma.$transaction(async (tx) => {
          // Guard: zaten açık dönem var mı? (raw constraint hatası yerine temiz 409)
          const open = await tx.employmentPeriod.findFirst({
            where: { personnelId: id, cikisTarihi: null },
            select: { id: true },
          })
          if (open) {
            const e = new Error('OPEN_PERIOD_EXISTS') as Error & { code?: string }
            e.code = 'OPEN_PERIOD_EXISTS'
            throw e
          }
          const u = await tx.personnel.update({
            where: { id },
            data: {
              aktif: true,
            },
          })
          const np = await tx.employmentPeriod.create({
            data: {
              personnelId: id,
              girisTarihi: reentryDate,
              cikisTarihi: null,
              entryRecordedById: user.id,
              entryRecordedAt: new Date(),
            },
          })
          // Org koltuk senkronu — pasifleşmede kapanan koltuğu geri aç (simetri).
          // personelPasiflestiginde ile AYNI transaction deseni; SİLME YOK.
          await personelAktiflestiginde(tx, id, { sebep: 'REENTRY', actorId: user.id })
          return { updated: u, newPeriodId: np.id }
        })

        await ifsKuyrugaEkle(prisma, personelKuyrukKayitlari(id), 'HOOK:personnel-reactivate')
        await logAuditEvent({
          action: 'PERSONNEL_REACTIVATED', // IFS kuyruğu aşağıda (yeniden-aktif faz 1'de tespit+rapor)
          actorId: user.id,
          targetType: 'PERSONNEL',
          targetId: id,
          details: {
            actorEmail: user.email,
            sicilNo: personnel.sicilNo,
            newPeriodId,
          },
        })

        return NextResponse.json({ ok: true, personnel: updated })
      } catch (e) {
        const code = (e as { code?: string })?.code
        if (code === 'OPEN_PERIOD_EXISTS' || code === 'P2002') {
          return NextResponse.json(
            { error: 'Bu personelin zaten açık bir istihdam dönemi var. Önce mevcut dönemi kapatın.' },
            { status: 409 }
          )
        }
        throw e
      }
    }

    // SENARYO 3: Pasif personel için exit alanları düzenleme
    if (personnel.aktif === false && body.aktif !== true) {
      const exitDogrulama = cikisAlanlariniDogrula(body)
      if (exitDogrulama) return NextResponse.json({ error: exitDogrulama }, { status: 400 })
      const exitKeys = ['exitDate', 'exitParty', 'exitCode', 'exitReason', 'exitRootCause', 'exitTurnoverType', 'exitGeneralNote']
      const data: Record<string, unknown> = {}
      for (const k of exitKeys) {
        if (body[k] === undefined) continue
        if (k === 'exitDate') {
          data.exitDate = body.exitDate ? new Date(body.exitDate) : null
        } else {
          data[k] = body[k] === '' ? null : body[k]
        }
      }
      const changedKeys = Object.keys(data)
      if (changedKeys.length === 0) {
        return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 })
      }

      // PR-3 (tek-kaynak): en son KAPALI dönemi güncelle. Personnel.exit* YAZILMAZ.
      const lastClosed = await prisma.employmentPeriod.findFirst({
        where: { personnelId: id, cikisTarihi: { not: null } },
        orderBy: { cikisTarihi: 'desc' },
        select: { id: true },
      })
      if (!lastClosed) {
        return NextResponse.json(
          { error: 'Düzenlenecek çıkış kaydı (kapalı dönem) bulunamadı' },
          { status: 400 }
        )
      }

      // Personnel exit alan adları → dönem alanları: exitDate → cikisTarihi, diğerleri aynı ad.
      const periodData: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(data)) {
        if (k === 'exitDate') periodData.cikisTarihi = v
        else periodData[k] = v
      }
      periodData.exitRecordedById = user.id
      periodData.exitRecordedAt = new Date()

      await prisma.employmentPeriod.update({
        where: { id: lastClosed.id },
        data: periodData,
      })

      await logAuditEvent({
        action: 'PERSONNEL_EXIT_UPDATED',
        actorId: user.id,
        targetType: 'PERSONNEL',
        targetId: id,
        details: {
          actorEmail: user.email,
          sicilNo: personnel.sicilNo,
          changedFieldKeys: changedKeys,
        },
      })

      return NextResponse.json({ ok: true })
    }

    // SENARYO 4: Aktif personel için PATCH — bu endpoint sadece toggle akışı
    return NextResponse.json(
      {
        error: 'Geçersiz istek',
        message: 'Aktif personel için PATCH yalnız aktif=false toggle ile kullanılır. Diğer alan güncellemeleri PUT ile yapılır.',
      },
      { status: 400 }
    )
  } catch (error: unknown) {
    console.error('Personel PATCH hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-personnel: requireUser — admin role check (soft delete)
    const { user, error } = await requireUser()
    if (error) return error

    const { id: delId } = await params

    if (!DELETE_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const existing = await prisma.personnel.findUnique({ where: { id: delId } })
    if (!existing) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }

    // Soft delete: aktif = false + org koltuk/vekalet senkronu (aynı transaction — atomik).
    const updatedPersonnel = await prisma.$transaction(async (tx) => {
      const upd = await tx.personnel.update({
        where: { id: delId },
        data: { aktif: false },
      })
      await personelPasiflestiginde(tx, delId, { sebep: 'SOFT_DELETE', actorId: user.id })
      return upd
    })

    return NextResponse.json({ message: 'Personel pasif duruma alındı', personnel: updatedPersonnel })
  } catch (error) {
    console.error('Personel silinirken hata:', error)
    return NextResponse.json({ error: 'Personel silinirken bir hata oluştu' }, { status: 500 })
  }
}
