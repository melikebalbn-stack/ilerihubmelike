import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { recalculateCosts } from '@/lib/cost-analysis/calculations'

// GET - Tek maliyet analizi detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-cost-analysis: requireUser — yetkisiz user createdById eşleşmesi gerek
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const analysis = await prisma.costAnalysis.findUnique({
      where: { id },
      include: {
        category: true,
        customer: true,
        materials: {
          include: {
            supplier: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        laborItems: {
          include: {
            machine: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        externalServices: {
          include: {
            supplier: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        otherCosts: {
          orderBy: { sortOrder: 'asc' },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 5,
        },
        parent: {
          select: {
            id: true,
            code: true,
            revision: true,
            revisionNumber: true,
          },
        },
      },
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Maliyet analizi bulunamadı' }, { status: 404 })
    }

    // Authorization: yetkisiz kullanıcılar sadece kendi oluşturduklarını görebilir
    if (!(session.user.permissions?.includes('costanalysis.admin') ?? false) && analysis.createdById !== user.id) {
      return NextResponse.json({ error: 'Bu analize erişim yetkiniz yok' }, { status: 403 })
    }

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Maliyet analizi alınırken hata:', error)
    return NextResponse.json(
      { error: 'Maliyet analizi alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - Maliyet analizi güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess
    const { session, user, error } = await requireUser()
    if (error) return error
    if (!(session.user.permissions?.includes('costanalysis.admin') ?? false)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Mevcut analizi kontrol et
    const existingAnalysis = await prisma.costAnalysis.findUnique({
      where: { id },
    })

    if (!existingAnalysis) {
      return NextResponse.json({ error: 'Maliyet analizi bulunamadı' }, { status: 404 })
    }

    // Onaylı analizler düzenlenemez (yeni versiyon oluşturulmalı)
    if (existingAnalysis.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Onaylı analizler düzenlenemez. Yeni versiyon oluşturun.' },
        { status: 400 }
      )
    }

    const {
      code,
      name,
      description,
      revision,
      finishedWeight,
      currency,
      categoryId,
      customerId,
      overheadRate,
      profitRate,
      status,
    } = body

    // Kod değiştiyse benzersizlik kontrolü (composite unique: code + revisionNumber)
    if (code && code !== existingAnalysis.code) {
      const duplicateCode = await prisma.costAnalysis.findFirst({
        where: { code, revisionNumber: existingAnalysis.revisionNumber },
      })
      if (duplicateCode) {
        return NextResponse.json(
          { error: 'Bu ürün kodu zaten mevcut' },
          { status: 400 }
        )
      }
    }

    // ONAY İZİ — durum geçişine bağlı (2026-09-03).
    // Bu uç eskiden YALNIZ `status` yazıyordu: arayüzden Onaylı yapılan kayıtta
    // "kim/ne zaman onayladı" hiç kaydedilmiyordu (mevcut APPROVED kayıtlardaki
    // approvedById uygulamadan değil, veri aktarımından geliyor). Geri Taslak'a
    // çekilen kayıtta da eski onay izi asılı kalıyordu.
    //
    // YALNIZ durum GERÇEKTEN değiştiğinde yazılır: status göndermeyen (ya da
    // aynı durumu gönderen) alan güncellemeleri approvedAt'i tazelemez.
    // NOT: `user` requireUser'ın DB satırı; user.id === session.user.id ve
    // approvedById FK'sının beklediği değer bu.
    const yeniStatus = status || existingAnalysis.status
    const onayIzi: { approvedById?: string | null; approvedAt?: Date | null } = {}
    if (yeniStatus !== existingAnalysis.status) {
      if (yeniStatus === 'APPROVED') {
        onayIzi.approvedById = user.id
        onayIzi.approvedAt = new Date()
      } else if (yeniStatus === 'DRAFT' || yeniStatus === 'REJECTED') {
        // Reddetmede de onay izi silinir: rejectionReason ayrı alanda tutulur,
        // şemada rejectedById/rejectedAt YOK (bkz. rapor).
        onayIzi.approvedById = null
        onayIzi.approvedAt = null
      }
    }

    const analysis = await prisma.costAnalysis.update({
      where: { id },
      data: {
        code: code?.trim() || existingAnalysis.code,
        name: name?.trim() || existingAnalysis.name,
        description: description !== undefined ? description?.trim() || null : existingAnalysis.description,
        revision: revision?.trim() || existingAnalysis.revision,
        finishedWeight: finishedWeight ? parseFloat(finishedWeight) : existingAnalysis.finishedWeight,
        currency: currency || existingAnalysis.currency,
        categoryId: categoryId !== undefined ? (categoryId || null) : existingAnalysis.categoryId,
        customerId: customerId !== undefined ? (customerId || null) : existingAnalysis.customerId,
        overheadRate: overheadRate !== undefined ? parseFloat(overheadRate) : existingAnalysis.overheadRate,
        profitRate: profitRate !== undefined ? parseFloat(profitRate) : existingAnalysis.profitRate,
        status: yeniStatus,
        ...onayIzi,
      },
      include: {
        category: true,
        customer: true,
      },
    })

    // BUGFIX: kar oranı/işletme gideri/bitmiş ağırlık değişince türetilen toplamlar
    // (profitAmount, salesPrice, totalCost, pricePerKg) yeniden hesaplanmalı —
    // aksi halde DB'de eski değerler kalır ve "toplam değişmiyor".
    const needsRecalc =
      overheadRate !== undefined ||
      profitRate !== undefined ||
      finishedWeight !== undefined
    if (needsRecalc) {
      await recalculateCosts(id)
      const fresh = await prisma.costAnalysis.findUnique({
        where: { id },
        include: { category: true, customer: true },
      })
      return NextResponse.json(fresh ?? analysis)
    }

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Maliyet analizi güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Maliyet analizi güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Maliyet analizi sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess
    const { session, user, error } = await requireUser()
    if (error) return error
    if (!(session.user.permissions?.includes('costanalysis.admin') ?? false)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params

    // Mevcut analizi kontrol et
    const existingAnalysis = await prisma.costAnalysis.findUnique({
      where: { id },
    })

    if (!existingAnalysis) {
      return NextResponse.json({ error: 'Maliyet analizi bulunamadı' }, { status: 404 })
    }

    // Onaylı analizler silinemez
    if (existingAnalysis.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Onaylı analizler silinemez. Arşivleyebilirsiniz.' },
        { status: 400 }
      )
    }

    // Cascade delete ile tüm alt kayıtlar da silinir
    await prisma.costAnalysis.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Maliyet analizi silindi' })
  } catch (error) {
    console.error('Maliyet analizi silinirken hata:', error)
    return NextResponse.json(
      { error: 'Maliyet analizi silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
