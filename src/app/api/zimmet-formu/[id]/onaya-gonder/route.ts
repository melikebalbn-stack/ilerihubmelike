import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { requirePermission } from '@/lib/auth/require-permission'
import { ZimmetOnayDurumu, ZimmetKaynak } from '@/generated/prisma'
import { dispatchZimmetApproval } from '@/lib/zimmet/notifications'
import { APPROVER_USER_ID, APPROVER_EMAIL, APPROVER_NAME } from '@/lib/zimmet/constants'

export const dynamic = 'force-dynamic'

/**
 * POST /api/zimmet-formu/[id]/onaya-gonder
 *
 * Kaydı oluşturan/IT tarafı, ONAY_BEKLIYOR durumundaki bir zimmet için onaycıya
 * (constants.ts'teki sabit approver) bildirim tetikler. DURUM YAZMASI YOK — kayıt
 * zaten ONAY_BEKLIYOR; bu uç yalnız bildirimi (yeniden) gönderir (hatırlatma).
 * Tekrar çağrılabilir. Audit: zimmetDurumGecmisi (DELETE'in 'SILINDI' sentinel'i
 * gibi, yeniDurum='ONAYA_GONDERILDI').
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error: permError } = await requirePermission('zimmet-formu.create')
    if (permError) return permError

    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const zimmet = await prisma.zimmetFormu.findFirst({
      where: { id, silindiMi: false },
      include: {
        zimmetSahibi: { select: { name: true, email: true } },
        createdBy: { select: { name: true, email: true } },
      },
    })
    if (!zimmet) {
      return NextResponse.json({ error: 'Zimmet formu bulunamadı' }, { status: 404 })
    }
    if (zimmet.durum !== ZimmetOnayDurumu.ONAY_BEKLIYOR) {
      return NextResponse.json({ error: 'Bu zimmet formu zaten işleme alınmış' }, { status: 409 })
    }
    // Devir kayıtları bu uçtan onaya gönderilmez — sahibinin onayına gider
    // (/devir-onay + devir bildirimi akışı).
    if (zimmet.kaynak === ZimmetKaynak.SYTELINE_DEVIR) {
      return NextResponse.json(
        { error: 'Devir kayıtları sahibinin onayına gider; bu uç kullanılmaz.' },
        { status: 409 },
      )
    }

    // Durum değişmez (zaten ONAY_BEKLIYOR) — yalnız denetim izi + bildirim.
    await prisma.zimmetDurumGecmisi.create({
      data: {
        zimmetId: id,
        eskiDurum: zimmet.durum,
        yeniDurum: 'ONAYA_GONDERILDI',
        islemYapanId: user.id,
        not: 'Onay bildirimi gönderildi',
      },
    })

    void dispatchZimmetApproval({
      zimmet: {
        id: zimmet.id,
        zimmetSahibiAdi: zimmet.zimmetSahibi?.name ?? zimmet.zimmetSahibi?.email ?? '—',
        departman: zimmet.departman,
        tur: zimmet.tur,
        turDiger: zimmet.turDiger,
        teslimEdenAdi: zimmet.createdBy.name ?? zimmet.createdBy.email,
        createdAt: zimmet.createdAt,
      },
      approver: { id: APPROVER_USER_ID, email: APPROVER_EMAIL, name: APPROVER_NAME },
    }).catch(console.error)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/zimmet-formu/[id]/onaya-gonder]', err)
    return NextResponse.json({ error: 'Onay bildirimi gönderilemedi' }, { status: 500 })
  }
}
