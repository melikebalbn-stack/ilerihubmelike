import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { logAuditEvent } from '@/lib/audit-log'
import { computeTenure } from '@/lib/personnel-tenure'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'
import { YAKA_DETAY_MAP } from '@/lib/personnel-constants'

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

    return NextResponse.json({ ...personnel, employmentSummary, lastClosedPeriod })
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

    const body = await request.json()

    // Remove fields that should not be updated directly
    delete body.id
    delete body.createdAt
    delete body.updatedAt
    delete body.sensitive
    // PR-PERSONEL-CIKIS-FORMU: exit alanları yalnızca PATCH üzerinden değişir
    delete body.exitDate
    delete body.exitParty
    delete body.exitCode
    delete body.exitReason
    delete body.exitRootCause
    delete body.exitTurnoverType
    delete body.exitGeneralNote
    delete body.exitRecordedAt
    delete body.exitRecordedById
    delete body.exitRecordedBy
    delete body.workingPeriod
    // PR-C: salt-görüntüleme alanları — update body'sine girmez
    delete body.employmentPeriods
    delete body.employmentSummary
    delete body.aktif // toggle artık PATCH ile yapılıyor
    // Beden: nested obje ayrı upsert edilir; personnel.update data'sına girmemeli.
    // bedenProfili = GET'ten dönen salt-okuma nested obje (varsa) — silinir.
    const bedenInput = body.beden
    delete body.beden
    delete body.bedenProfili

    // Boş stringleri null'a çevir (Prisma enum/date/int hataları için)
    for (const key of Object.keys(body)) {
      if (body[key] === '') body[key] = null
    }

    // Parse date fields (null değerler atlanır)
    const dateFields = [
      'iseGirisTarihi', 'denemeDegerlendirme', 'altiAyDegerlendirme',
      'ilkYardimciBelgesi', 'kalfalikBelgesi', 'ustalikBelgesi', 'yanginSertifikasi', 'mykBelgesiTarihi',
    ]
    for (const field of dateFields) {
      if (body[field]) {
        body[field] = new Date(body[field])
      }
    }

    // Parse int fields
    if (body.mezuniyetYili) {
      body.mezuniyetYili = parseInt(body.mezuniyetYili) || null
    }

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
      return updated
    })

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
      },
    })

    return NextResponse.json(updatedPersonnel)
  } catch (error: any) {
    console.error('Personel güncellenirken hata:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Bu sicil numarası zaten kayıtlı' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Personel güncellenirken bir hata oluştu' }, { status: 500 })
  }
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
          return u
        })

        // KVKK: kayıt anahtarları + tarih saklanır, açıklama metni saklanmaz
        await logAuditEvent({
          action: 'PERSONNEL_DEACTIVATED',
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
          return { updated: u, newPeriodId: np.id }
        })

        await logAuditEvent({
          action: 'PERSONNEL_REACTIVATED',
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

    // Soft delete: aktif = false
    const updatedPersonnel = await prisma.personnel.update({
      where: { id: delId },
      data: { aktif: false },
    })

    return NextResponse.json({ message: 'Personel pasif duruma alındı', personnel: updatedPersonnel })
  } catch (error) {
    console.error('Personel silinirken hata:', error)
    return NextResponse.json({ error: 'Personel silinirken bir hata oluştu' }, { status: 500 })
  }
}
