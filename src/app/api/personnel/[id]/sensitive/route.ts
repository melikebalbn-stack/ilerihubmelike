import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'

const VIEW_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']
const UPDATE_ROLES = ['ADMIN', 'SUPER_ADMIN']

function maskValue(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.length <= 6) return '***'
  return value.substring(0, 3) + '****' + value.substring(value.length - 3)
}

const emptyToNull = (v: unknown): string | null => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

// PR-1: banka hesabı yanıt biçimi — hesapNo/ibanNo maskeli (bankaSube/bankaAdi maskelenMEZ),
// unmask=true ise tam değer (PersonnelSensitive ile AYNI kural).
function mapAccount(a: any, unmask: boolean) {
  return {
    id: a.id,
    bankaAdi: a.bankaAdi,
    bankaSube: a.bankaSube,
    hesapNo: unmask ? a.hesapNo : maskValue(a.hesapNo),
    ibanNo: unmask ? a.ibanNo : maskValue(a.ibanNo),
    isPrimary: a.isPrimary,
    aktif: a.aktif,
    aciklama: a.aciklama,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // PR-Y2.5-personnel: requireUser — accessLog yazımı + admin role
    const { user, error } = await requireUser()
    if (error) return error

    if (!VIEW_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const unmask = searchParams.get('unmask') === 'true'

    const [sensitive, bankAccounts] = await Promise.all([
      prisma.personnelSensitive.findUnique({ where: { personnelId: id } }),
      prisma.personnelBankAccount.findMany({
        where: { personnelId: id },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      }),
    ])

    if (!sensitive && bankAccounts.length === 0) {
      return NextResponse.json({ error: 'Hassas veri bulunamadı' }, { status: 404 })
    }

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null

    // Log access (PR-1: banka hesapları aynı istekte döndüğü için ek log gerekmez)
    await prisma.personnelAccessLog.create({
      data: {
        personnelId: id,
        accessedBy: user.id,
        accessType: unmask ? 'UNMASK_SENSITIVE' : 'VIEW_SENSITIVE',
        ipAddress,
      },
    })

    const accounts = bankAccounts.map((a) => mapAccount(a, unmask))

    // PR-1: eski sensitive.banka* alanları geriye dönük uyum için yanıtta KALIR (UI artık bankAccounts kullanır).
    return NextResponse.json({
      id: sensitive?.id ?? null,
      personnelId: id,
      tcKimlikNo: sensitive ? (unmask ? sensitive.tcKimlikNo : maskValue(sensitive.tcKimlikNo)) : null,
      sgkNo: sensitive ? (unmask ? sensitive.sgkNo : maskValue(sensitive.sgkNo)) : null,
      dogumTarihi: sensitive?.dogumTarihi ?? null,
      bankaSube: sensitive?.bankaSube ?? null,
      bankaHesapNo: sensitive ? (unmask ? sensitive.bankaHesapNo : maskValue(sensitive.bankaHesapNo)) : null,
      ibanNo: sensitive ? (unmask ? sensitive.ibanNo : maskValue(sensitive.ibanNo)) : null,
      bankAccounts: accounts,
      updatedAt: sensitive?.updatedAt ?? null,
      updatedBy: sensitive?.updatedBy ?? null,
    })
  } catch (error) {
    console.error('Hassas veri alınırken hata:', error)
    return NextResponse.json({ error: 'Hassas veri alınırken bir hata oluştu' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // PR-Y2.5-personnel: requireUser — updatedBy yazımı + admin role
    const { user, error } = await requireUser()
    if (error) return error

    if (!UPDATE_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    // Verify personnel exists
    const personnel = await prisma.personnel.findUnique({ where: { id } })
    if (!personnel) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }

    const body = await request.json()

    // PR-1: banka hesapları ayrı tabloya gider — body'den ayır
    const incomingAccounts: any[] | null = Array.isArray(body.bankAccounts) ? body.bankAccounts : null
    delete body.bankAccounts

    // Parse date fields
    if (body.dogumTarihi) {
      body.dogumTarihi = new Date(body.dogumTarihi)
    }

    // Remove fields that should not be updated
    delete body.id
    delete body.personnelId
    delete body.createdAt
    delete body.updatedAt

    const sensitiveKeys = Object.keys(body)
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null

    await prisma.$transaction(async (tx) => {
      // 1) PersonnelSensitive scalar alanları (tc/sgk/dogum + geriye dönük banka*) — varsa upsert
      if (sensitiveKeys.length > 0) {
        await tx.personnelSensitive.upsert({
          where: { personnelId: id },
          update: { ...body, updatedBy: user.id },
          create: { personnelId: id, ...body, updatedBy: user.id },
        })
      }

      // 2) Banka hesapları reconcile (yalnız bankAccounts gönderildiyse)
      if (incomingAccounts) {
        const existing = await tx.personnelBankAccount.findMany({
          where: { personnelId: id },
          select: { id: true },
        })
        const existingIds = new Set(existing.map((e) => e.id))
        const keepIds = new Set(
          incomingAccounts.filter((a) => a.id && existingIds.has(a.id)).map((a) => a.id),
        )

        // Kısmi unique index (tek primary) çatışmasını önlemek için önce TÜM primary'leri temizle
        await tx.personnelBankAccount.updateMany({
          where: { personnelId: id },
          data: { isPrimary: false },
        })

        // Listede olmayan mevcut hesapları sil
        const toDelete = [...existingIds].filter((eid) => !keepIds.has(eid))
        if (toDelete.length) {
          await tx.personnelBankAccount.deleteMany({ where: { id: { in: toDelete } } })
        }

        // Tek primary normalize: ilk isPrimary işaretli hesap. Primary'yi EN SON uygula
        // (diğerleri zaten false → kısmi unique index ihlali olmaz).
        const primaryIdx = incomingAccounts.findIndex((a) => a.isPrimary)
        const order = incomingAccounts
          .map((_, i) => i)
          .sort((x, y) => (x === primaryIdx ? 1 : 0) - (y === primaryIdx ? 1 : 0))

        for (const i of order) {
          const a = incomingAccounts[i]
          const fields = {
            bankaAdi: emptyToNull(a.bankaAdi),
            bankaSube: emptyToNull(a.bankaSube),
            hesapNo: emptyToNull(a.hesapNo),
            ibanNo: emptyToNull(a.ibanNo),
            isPrimary: i === primaryIdx,
            aktif: a.aktif === undefined ? true : !!a.aktif,
            aciklama: emptyToNull(a.aciklama),
            updatedBy: user.id,
          }
          if (a.id && existingIds.has(a.id)) {
            await tx.personnelBankAccount.update({ where: { id: a.id }, data: fields })
          } else {
            await tx.personnelBankAccount.create({ data: { personnelId: id, ...fields } })
          }
        }
      }

      // 3) Erişim log (UPDATE_SENSITIVE) — mevcut desenle
      await tx.personnelAccessLog.create({
        data: {
          personnelId: id,
          accessedBy: user.id,
          accessType: 'UPDATE_SENSITIVE',
          ipAddress,
        },
      })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Hassas veri güncellenirken hata:', error)
    return NextResponse.json({ error: 'Hassas veri güncellenirken bir hata oluştu' }, { status: 500 })
  }
}
