import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { requirePermission } from '@/lib/auth/require-permission'
import { ZimmetTuru, ZimmetCihazDurumu } from '@/generated/prisma'
import { dispatchZimmetApproval } from '@/lib/zimmet/notifications'
import { APPROVER_USER_ID, APPROVER_EMAIL, APPROVER_NAME } from '@/lib/zimmet/constants'

export const dynamic = 'force-dynamic'

const TUR_VALUES: string[] = Object.values(ZimmetTuru)
const CIHAZ_DURUMU_VALUES: string[] = Object.values(ZimmetCihazDurumu)

function optionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// GET - Kendi oluşturduğun zimmet formlarını listele (test/teyit için)
export async function GET() {
  const { error } = await requirePermission('zimmet-formu.view')
  if (error) return error

  const zimmetFormlari = await prisma.zimmetFormu.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      zimmetSahibi: { select: { id: true, name: true, email: true, department: true } },
    },
  })

  return NextResponse.json(zimmetFormlari)
}

// POST - Yeni zimmet formu kaydet ("Onayla gönder")
export async function POST(request: NextRequest) {
  try {
    const { error: permError } = await requirePermission('zimmet-formu.create')
    if (permError) return permError

    const { user, error } = await requireUser()
    if (error) return error

    const body = await request.json()

    const zimmetSahibiId = optionalString(body.zimmetSahibiId)
    if (!zimmetSahibiId) {
      return NextResponse.json({ error: 'Zimmet sahibi gerekli' }, { status: 400 })
    }

    const tur = typeof body.tur === 'string' ? body.tur : ''
    if (!TUR_VALUES.includes(tur)) {
      return NextResponse.json({ error: 'Geçerli bir tür seçin' }, { status: 400 })
    }

    const zimmetSahibi = await prisma.user.findUnique({ where: { id: zimmetSahibiId } })
    if (!zimmetSahibi) {
      return NextResponse.json({ error: 'Zimmet sahibi bulunamadı' }, { status: 400 })
    }

    const cihazDurumu = CIHAZ_DURUMU_VALUES.includes(body.cihazDurumu) ? body.cihazDurumu : ZimmetCihazDurumu.AKTIF

    let verilisTarihi: Date | null = null
    if (typeof body.verilisTarihi === 'string' && body.verilisTarihi.trim()) {
      const parsed = new Date(body.verilisTarihi)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Geçersiz veriliş tarihi' }, { status: 400 })
      }
      verilisTarihi = parsed
    }

    const zimmetFormu = await prisma.zimmetFormu.create({
      data: {
        zimmetSahibiId,
        altZimmetSahibi: optionalString(body.altZimmetSahibi),
        departman: optionalString(body.departman),
        tur: tur as ZimmetTuru,
        turDiger: tur === ZimmetTuru.DIGER ? optionalString(body.turDiger) : null,
        seriNumarasi: optionalString(body.seriNumarasi),
        aciklama: optionalString(body.aciklama),
        ozellik: optionalString(body.ozellik),
        macAdresi: optionalString(body.macAdresi),
        pcAdi: optionalString(body.pcAdi),
        imeiNumarasi: optionalString(body.imeiNumarasi),
        verilisTarihi,
        cihazDurumu,
        teslimNotu: optionalString(body.teslimNotu),
        teslimEdenImzaTarihi:
          body.teslimEdenImzalandi && body.teslimEdenImzaTarihi
            ? new Date(body.teslimEdenImzaTarihi)
            : null,
        createdById: user.id,
      },
    })

    void dispatchZimmetApproval({
      zimmet: {
        id: zimmetFormu.id,
        zimmetSahibiAdi: zimmetSahibi.name ?? zimmetSahibi.email,
        departman: zimmetFormu.departman,
        tur: zimmetFormu.tur,
        teslimEdenAdi: user.name ?? user.email,
        createdAt: zimmetFormu.createdAt,
      },
      approver: { id: APPROVER_USER_ID, email: APPROVER_EMAIL, name: APPROVER_NAME },
    }).catch(console.error)

    return NextResponse.json(zimmetFormu, { status: 201 })
  } catch (err) {
    console.error('[POST /api/zimmet-formu]', err)
    return NextResponse.json({ error: 'Form kaydedilemedi' }, { status: 500 })
  }
}
