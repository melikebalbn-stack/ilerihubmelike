import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { requirePermission } from '@/lib/auth/require-permission'
import { hasPermission } from '@/lib/auth/has-permission'
import { ZimmetOnayDurumu } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

function optionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const zimmet = await prisma.zimmetFormu.findFirst({
      where: { id, silindiMi: false },
      include: {
        zimmetSahibi: { select: { name: true, email: true } },
        createdBy: { select: { name: true, email: true } },
        onaylayan: { select: { name: true, email: true } },
      },
    })

    if (!zimmet) {
      return NextResponse.json({ error: 'Zimmet formu bulunamadı' }, { status: 404 })
    }

    // Sahip kendi kaydını, zimmet-formu.view yetkilisi hepsini görebilir.
    const yetkili =
      zimmet.zimmetSahibiId === user.id || (await hasPermission('zimmet-formu.view'))
    if (!yetkili) {
      return NextResponse.json({ error: 'Bu kaydı görüntüleme yetkiniz yok' }, { status: 403 })
    }

    return NextResponse.json(zimmet)
  } catch (err) {
    console.error('[GET /api/zimmet-formu/[id]]', err)
    return NextResponse.json({ error: 'Zimmet formu yüklenemedi' }, { status: 500 })
  }
}

// Sadece ONAY_BEKLIYOR durumundaki (henüz onaylanmamış/reddedilmemiş) hatalı
// kayıtlar silinebilir - örn. yanlış girilmiş bir seri numarası. Onaylanmış/
// reddedilmiş kayıtlar kalıcı kayıt niteliğinde olduğu için silinemez.
// Yetki: zimmet-formu.approve (soft-delete).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error: permError } = await requirePermission('zimmet-formu.approve')
    if (permError) return permError

    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const mevcut = await prisma.zimmetFormu.findUnique({
      where: { id },
      select: { id: true, durum: true },
    })
    if (!mevcut) {
      return NextResponse.json({ error: 'Zimmet formu bulunamadı' }, { status: 404 })
    }
    if (mevcut.durum !== ZimmetOnayDurumu.ONAY_BEKLIYOR) {
      return NextResponse.json(
        {
          error:
            'Onaylanmış/reddedilmiş kayıtlar silinemez, yalnızca onay bekleyen hatalı kayıtlar silinebilir',
        },
        { status: 400 },
      )
    }

    await prisma.zimmetFormu.update({
      where: { id },
      data: {
        silindiMi: true,
        silinmeTarihi: new Date(),
        silenId: user.id,
      },
    })
    // Silme de bir "durum değişikliği" - audit log'a yazılır.
    await prisma.zimmetDurumGecmisi.create({
      data: {
        zimmetId: id,
        eskiDurum: mevcut.durum,
        yeniDurum: 'SILINDI',
        islemYapanId: user.id,
      },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/zimmet-formu/[id]]', err)
    return NextResponse.json({ error: 'Zimmet formu silinemedi' }, { status: 500 })
  }
}

// Kayıt hangi durumda olursa olsun (ONAY_BEKLIYOR, ONAYLANDI, REDDEDILDI)
// düzenlenebilir - durum ALAN değişikliğiyle değişmez, mevcut durum aynen
// korunur (ör. ONAYLANDI kayıt düzenlenince tekrar onaya düşmez). Silme hâlâ
// sadece ONAY_BEKLIYOR'da (bkz. DELETE) - o kısıtlama genişletilmedi.
// Yetki: zimmet-formu.approve (DELETE ile aynı).
// Var olan kayıt üzerinde update() yapılır - mükerrer kayıt oluşmaz.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error: permError } = await requirePermission('zimmet-formu.approve')
    if (permError) return permError

    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const mevcut = await prisma.zimmetFormu.findFirst({
      where: { id, silindiMi: false },
      select: {
        id: true,
        durum: true,
        seriNumarasi: true,
        aciklama: true,
        ozellik: true,
        macAdresi: true,
        pcAdi: true,
        imeiNumarasi: true,
      },
    })
    if (!mevcut) {
      return NextResponse.json({ error: 'Zimmet formu bulunamadı' }, { status: 404 })
    }

    const guncellendi = await prisma.zimmetFormu.update({
      where: { id },
      data: {
        seriNumarasi: optionalString(body.seriNumarasi),
        aciklama: optionalString(body.aciklama),
        ozellik: optionalString(body.ozellik),
        macAdresi: optionalString(body.macAdresi),
        pcAdi: optionalString(body.pcAdi),
        imeiNumarasi: optionalString(body.imeiNumarasi),
        marka: optionalString(body.marka),
        model: optionalString(body.model),
      },
    })

    // Düzenleme durumu DEĞİŞTİRMİYOR (ONAYLANDI ise ONAYLANDI kalır) ama
    // Melih'in onay/timeline ekranında hangi alanın neden-neye değiştiğini
    // görebilmesi için not alanına yapılandırılmış bir geçmiş satırı
    // düşülüyor. PENDING migration (prisma/migrations/PENDING_zimmet_durum_gecmisi)
    // Melih'in onayına bırakıldığı için GEÇİCİ olarak devre dışı - migration
    // çalışınca aşağıdaki bloğu geri aç:
    const degisiklikler: string[] = []
    if (mevcut.seriNumarasi !== guncellendi.seriNumarasi) {
      degisiklikler.push(`Seri No: "${mevcut.seriNumarasi ?? '—'}" → "${guncellendi.seriNumarasi ?? '—'}"`)
    }
    if (mevcut.aciklama !== guncellendi.aciklama) {
      degisiklikler.push(`Açıklama: "${mevcut.aciklama ?? '—'}" → "${guncellendi.aciklama ?? '—'}"`)
    }
    if (mevcut.ozellik !== guncellendi.ozellik) {
      degisiklikler.push(`Özellik: "${mevcut.ozellik ?? '—'}" → "${guncellendi.ozellik ?? '—'}"`)
    }
    if (mevcut.macAdresi !== guncellendi.macAdresi) {
      degisiklikler.push(`MAC Adresi: "${mevcut.macAdresi ?? '—'}" → "${guncellendi.macAdresi ?? '—'}"`)
    }
    if (mevcut.pcAdi !== guncellendi.pcAdi) {
      degisiklikler.push(`PC Adı: "${mevcut.pcAdi ?? '—'}" → "${guncellendi.pcAdi ?? '—'}"`)
    }
    if (mevcut.imeiNumarasi !== guncellendi.imeiNumarasi) {
      degisiklikler.push(`IMEI: "${mevcut.imeiNumarasi ?? '—'}" → "${guncellendi.imeiNumarasi ?? '—'}"`)
    }
    const not = degisiklikler.length > 0
      ? `Kayıt düzenlendi: ${degisiklikler.join('; ')}`
      : 'Kayıt düzenlendi (alan değişikliği yok)'
    await prisma.zimmetDurumGecmisi.create({
      data: {
        zimmetId: id,
        eskiDurum: mevcut.durum,
        yeniDurum: mevcut.durum,
        islemYapanId: user.id,
        not,
      },
    })

    return NextResponse.json(guncellendi)
  } catch (err) {
    console.error('[PATCH /api/zimmet-formu/[id]]', err)
    return NextResponse.json({ error: 'Zimmet formu güncellenemedi' }, { status: 500 })
  }
}
