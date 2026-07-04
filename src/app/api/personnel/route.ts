import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'
import { YAKA_DETAY_MAP } from '@/lib/personnel-constants'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  return isInsanVarliklari(dept)
}

function hasPersonnelAccess(role: string, department?: string | null): boolean {
  return ALLOWED_ROLES.includes(role) || isHRDepartment(department)
}

export async function GET(request: NextRequest) {
  try {
    // PR-PERSONNEL-SECURITY: HR-only role check (PII expose kapatıldı; caller'lar sadece (dashboard)/personnel/*)
    const { user, error } = await requireUser()
    if (error) return error

    if (!hasPersonnelAccess(user.role, user.department)) {
      return NextResponse.json({ error: 'Personel listesi için HR yetkisi gerekli' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const bolum = searchParams.get('bolum')
    const yakaRengi = searchParams.get('yakaRengi') || searchParams.get('yaka')
    const durumParam = searchParams.get('durum')
    const aktifParam = searchParams.get('aktif')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '25')))
    const sortBy = searchParams.get('sortBy') || 'adSoyad'
    const sortDir = searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc'

    // Durum filtresi
    const where: any = {}
    if (durumParam === 'PASIF') {
      where.aktif = false
    } else if (durumParam === 'TUMU') {
      // tümü - aktif filtresi yok
    } else if (aktifParam === 'false') {
      where.aktif = false
    } else {
      where.aktif = true
    }

    if (bolum) {
      where.bolum = bolum
    }

    if (yakaRengi) {
      where.yakaRengi = yakaRengi
    }

    if (search) {
      where.OR = [
        { adSoyad: { contains: search, mode: 'insensitive' } },
        { sicilNo: { contains: search, mode: 'insensitive' } },
        { gorev: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Sıralama
    const orderBy: any = {}
    orderBy[sortBy] = sortDir

    const [personnel, total] = await Promise.all([
      prisma.personnel.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.personnel.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      personnel,
      total,
      page,
      limit,
      pagination: { page, limit, total, totalPages },
    })
  } catch (error) {
    console.error('Personel listesi alınırken hata:', error)
    return NextResponse.json({ error: 'Personel listesi alınırken bir hata oluştu' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-personnel: requireUser — createdBy + sensitive yazımı için user.id
    const { user, error } = await requireUser()
    if (error) return error

    if (!hasPersonnelAccess(user.role, user.department)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const body = await request.json()
    // PR-1: bankAccounts ayrı tabloya (PersonnelBankAccount) yazılır.
    const { sensitive, bankAccounts, ...personnelData } = body

    // Parse date fields
    if (personnelData.iseGirisTarihi) {
      personnelData.iseGirisTarihi = new Date(personnelData.iseGirisTarihi)
    }
    if (personnelData.denemeDegerlendirme) {
      personnelData.denemeDegerlendirme = new Date(personnelData.denemeDegerlendirme)
    }
    if (personnelData.altiAyDegerlendirme) {
      personnelData.altiAyDegerlendirme = new Date(personnelData.altiAyDegerlendirme)
    }
    if (personnelData.ilkYardimciBelgesi) {
      personnelData.ilkYardimciBelgesi = new Date(personnelData.ilkYardimciBelgesi)
    }
    if (personnelData.kalfalikBelgesi) {
      personnelData.kalfalikBelgesi = new Date(personnelData.kalfalikBelgesi)
    }
    if (personnelData.ustalikBelgesi) {
      personnelData.ustalikBelgesi = new Date(personnelData.ustalikBelgesi)
    }
    if (personnelData.yanginSertifikasi) {
      personnelData.yanginSertifikasi = new Date(personnelData.yanginSertifikasi)
    }
    if (personnelData.mykBelgesiTarihi) {
      personnelData.mykBelgesiTarihi = new Date(personnelData.mykBelgesiTarihi)
    }

    // Parse int fields
    if (personnelData.mezuniyetYili) {
      personnelData.mezuniyetYili = parseInt(personnelData.mezuniyetYili) || null
    }

    // Boş stringleri temizle (Prisma enum hataları için)
    for (const key of Object.keys(personnelData)) {
      if (personnelData[key] === '') personnelData[key] = null
    }

    // Yaka Aşama 1: yeni personel aktif → Yaka Rengi + Yaka Detayı zorunlu + tutarlı.
    if (!personnelData.yakaRengi || !personnelData.yakaDetayi) {
      return NextResponse.json({ error: 'Yaka Rengi ve Yaka Detayı zorunludur' }, { status: 400 })
    }
    const izinliDetay = YAKA_DETAY_MAP[personnelData.yakaRengi as string] ?? []
    if (!izinliDetay.includes(personnelData.yakaDetayi as string)) {
      return NextResponse.json({ error: 'Yaka Detayı, seçilen Yaka Rengi ile uyumsuz' }, { status: 400 })
    }

    personnelData.createdBy = user.id

    // PR-B: Personnel create + ilk AÇIK EmploymentPeriod = TEK transaction (dual-write).
    // Eski Personnel.iseGirisTarihi/exitDate alanları AYNEN yazılır (paralel korunur).
    const newPersonnel = await prisma.$transaction(async (tx) => {
      const created = await tx.personnel.create({ data: personnelData })
      await tx.employmentPeriod.create({
        data: {
          personnelId: created.id,
          girisTarihi: created.iseGirisTarihi,
          cikisTarihi: null, // açık dönem
          entryRecordedById: user.id,
          entryRecordedAt: new Date(),
        },
      })
      return created
    })

    // Create sensitive record if provided
    if (sensitive && Object.keys(sensitive).length > 0) {
      if (sensitive.dogumTarihi) {
        sensitive.dogumTarihi = new Date(sensitive.dogumTarihi)
      }

      await prisma.personnelSensitive.create({
        data: {
          personnelId: newPersonnel.id,
          updatedBy: user.id,
          ...sensitive,
        },
      })

      // Log sensitive data write
      await prisma.personnelAccessLog.create({
        data: {
          personnelId: newPersonnel.id,
          accessedBy: user.id,
          accessType: 'CREATE_SENSITIVE',
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        },
      })
    }

    // PR-1: Banka hesapları (varsa) — PersonnelBankAccount'a yaz. Tek primary normalize edilir.
    if (Array.isArray(bankAccounts) && bankAccounts.length > 0) {
      const emptyToNull = (v: unknown) => {
        if (v === null || v === undefined) return null
        const s = String(v).trim()
        return s === '' ? null : s
      }
      const primaryIdx = bankAccounts.findIndex((a: any) => a.isPrimary)
      // En az bir hesap varsa ve hiçbiri primary değilse ilkini primary yap.
      const effectivePrimary = primaryIdx >= 0 ? primaryIdx : 0
      for (let i = 0; i < bankAccounts.length; i++) {
        const a = bankAccounts[i]
        await prisma.personnelBankAccount.create({
          data: {
            personnelId: newPersonnel.id,
            bankaAdi: emptyToNull(a.bankaAdi),
            bankaSube: emptyToNull(a.bankaSube),
            hesapNo: emptyToNull(a.hesapNo),
            ibanNo: emptyToNull(a.ibanNo),
            isPrimary: i === effectivePrimary,
            aktif: a.aktif === undefined ? true : !!a.aktif,
            aciklama: emptyToNull(a.aciklama),
            updatedBy: user.id,
          },
        })
      }
    }

    return NextResponse.json(newPersonnel, { status: 201 })
  } catch (error: any) {
    console.error('Personel oluşturulurken hata:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Bu sicil numarası zaten kayıtlı' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Personel oluşturulurken bir hata oluştu' }, { status: 500 })
  }
}
