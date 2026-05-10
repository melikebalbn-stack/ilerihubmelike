import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { logAuditEvent } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']
const DELETE_ROLES = ['ADMIN', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  if (!dept) return false
  const d = dept.toLowerCase()
  return d.includes('insan') || d.includes('human') || d.includes('hr') || d.includes('ik')
}

function hasEditAccess(role: string, department?: string | null): boolean {
  return EDIT_ROLES.includes(role) || isHRDepartment(department)
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
        // PR-PERSONEL-CIKIS-FORMU: çıkış bilgileri
        exitDate: true,
        exitParty: true,
        exitCode: true,
        exitReason: true,
        exitRootCause: true,
        exitTurnoverType: true,
        exitGeneralNote: true,
        exitRecordedAt: true,
        exitRecordedBy: { select: { id: true, name: true, email: true } },
        azureAdId: true,
        azureAdEmail: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
      },
    })

    if (!personnel) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }

    // PR-PERSONEL-CIKIS-FORMU: workingPeriod runtime hesap (drift önler)
    let workingPeriod: { years: number; months: number; totalMonths: number } | null = null
    if (personnel.exitDate && personnel.iseGirisTarihi) {
      const start = new Date(personnel.iseGirisTarihi)
      const end = new Date(personnel.exitDate)
      let totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
      if (end.getDate() < start.getDate()) totalMonths -= 1
      if (totalMonths < 0) totalMonths = 0
      workingPeriod = { years: Math.floor(totalMonths / 12), months: totalMonths % 12, totalMonths }
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

    return NextResponse.json({ ...personnel, workingPeriod })
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
    delete body.aktif // toggle artık PATCH ile yapılıyor

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

    const updatedPersonnel = await prisma.personnel.update({
      where: { id: personnelId },
      data: body,
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

      const updated = await prisma.personnel.update({
        where: { id },
        data: {
          aktif: false,
          exitDate: new Date(body.exitDate),
          exitParty: String(body.exitParty).trim(),
          exitCode: String(body.exitCode).trim(),
          exitReason: String(body.exitReason).trim(),
          exitRootCause: String(body.exitRootCause).trim(),
          exitTurnoverType: String(body.exitTurnoverType).trim(),
          exitGeneralNote: body.exitGeneralNote ? String(body.exitGeneralNote) : null,
          exitRecordedById: user.id,
          exitRecordedAt: new Date(),
        },
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
    }

    // SENARYO 2: Aktife geri alma (aktif: false → true)
    if (body.aktif === true && personnel.aktif === false) {
      const updated = await prisma.personnel.update({
        where: { id },
        data: {
          aktif: true,
          exitDate: null,
          exitParty: null,
          exitCode: null,
          exitReason: null,
          exitRootCause: null,
          exitTurnoverType: null,
          exitGeneralNote: null,
          exitRecordedById: null,
          exitRecordedAt: null,
        },
      })

      await logAuditEvent({
        action: 'PERSONNEL_REACTIVATED',
        actorId: user.id,
        targetType: 'PERSONNEL',
        targetId: id,
        details: {
          actorEmail: user.email,
          sicilNo: personnel.sicilNo,
          previousExitDate: personnel.exitDate,
          previousExitCode: personnel.exitCode,
        },
      })

      return NextResponse.json({ ok: true, personnel: updated })
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

      const updated = await prisma.personnel.update({
        where: { id },
        data,
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

      return NextResponse.json({ ok: true, personnel: updated })
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
