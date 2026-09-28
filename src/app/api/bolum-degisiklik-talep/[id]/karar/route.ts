// Bölüm Değişikliği Talep Formu — İV kararı (TEK onay adımı).
//
// ONAYLA → tek transaction: talep ONAYLANDI + mevcut transfer akışı
//   (bolumTransferiUygula: transfer kaydı + Personnel.bolum/departmentId +
//   koltuk taşıma/açma + PERSONNEL_DEPARTMENT_TRANSFER denetimi) + BOLUM_TALEP_ONAY.
// REDDET → talep REDDEDILDI + redGerekcesi (zorunlu) + BOLUM_TALEP_RED.
//          Personnel'e DOKUNULMAZ.
//
// Transfer tarihi: talepte boş bırakılmışsa İV burada ZORUNLU olarak verir.
// İSG + doktor onayı yalnız burada doldurulur (talep formunda yok).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { bolumTalepYetkisiCore } from '@/lib/bolum-talep/bolum-talep-yetki'
import { bolumTransferiUygula } from '@/lib/personnel/bolum-transfer-uygula'
import { kararBildir } from '@/lib/bolum-talep/bolum-talep-bildirim'
import type { TransferOnay } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

const ONAY_DEGERLERI = ['UYGUN', 'UYGUN_DEGIL']

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const yetki = await bolumTalepYetkisiCore(user.id, user.role, user.department)
    // KARAR YALNIZ İV'nin — koltuk sahibi kendi talebini onaylayamaz.
    if (!yetki.iv) {
      return NextResponse.json(
        { error: 'Talebi yalnız İnsan Varlıkları karara bağlayabilir' },
        { status: 403 },
      )
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const karar = String(body.karar ?? '')
    if (karar !== 'ONAYLA' && karar !== 'REDDET') {
      return NextResponse.json({ error: "karar 'ONAYLA' ya da 'REDDET' olmalı" }, { status: 400 })
    }

    const talep = await prisma.bolumDegisiklikTalep.findUnique({
      where: { id },
      include: { personnel: { select: { id: true, sicilNo: true, adSoyad: true, bolum: true, aktif: true } } },
    })
    if (!talep) return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 })
    if (talep.durum !== 'BEKLIYOR') {
      return NextResponse.json(
        { error: `Bu talep zaten karara bağlanmış (${talep.durum})` },
        { status: 409 },
      )
    }

    const simdi = new Date()

    // ── RED ──
    if (karar === 'REDDET') {
      const redGerekcesi = String(body.redGerekcesi ?? '').trim()
      if (!redGerekcesi) {
        return NextResponse.json({ error: 'Red gerekçesi zorunludur' }, { status: 400 })
      }

      const guncel = await prisma.$transaction(async (tx) => {
        const t = await tx.bolumDegisiklikTalep.update({
          where: { id },
          data: { durum: 'REDDEDILDI', kararVerenId: user.id, kararTarihi: simdi, redGerekcesi },
          include: { personnel: { select: { sicilNo: true, adSoyad: true } } },
        })
        await tx.permissionAuditLog.create({
          data: {
            action: 'BOLUM_TALEP_RED',
            actorId: user.id,
            targetType: 'PERSONNEL',
            targetId: talep.personnelId,
            details: {
              talepNo: t.talepNo,
              talepId: t.id,
              kararVerenEmail: user.email,
              personnelSicilNo: t.personnel.sicilNo,
              mevcutBolum: t.mevcutBolum,
              hedefBolum: t.hedefBolum,
              redGerekcesi,
            },
          },
        })
        return t
      })

      await kararBildir({ ...guncel, personnel: guncel.personnel }, user.name ?? user.email ?? 'İnsan Varlıkları')
      return NextResponse.json({ ok: true, talep: guncel })
    }

    // ── ONAY ──
    if (!talep.personnel.aktif) {
      return NextResponse.json(
        { error: 'Personel pasif — bölüm değişikliği uygulanamaz (talebi reddedin)' },
        { status: 400 },
      )
    }
    const isgOnayi = String(body.isgOnayi ?? '')
    const doktorOnayi = String(body.doktorOnayi ?? '')
    if (!ONAY_DEGERLERI.includes(isgOnayi) || !ONAY_DEGERLERI.includes(doktorOnayi)) {
      return NextResponse.json({ error: 'İSG ve doktor onayı zorunludur' }, { status: 400 })
    }
    // Talepte boş bırakılan transfer tarihini İV burada belirler.
    const transferTarihi = body.transferTarihi
      ? new Date(String(body.transferTarihi))
      : talep.transferTarihi
    if (!transferTarihi || Number.isNaN(transferTarihi.getTime())) {
      return NextResponse.json({ error: 'Transfer tarihi zorunludur' }, { status: 400 })
    }
    // Talep açıldıktan sonra bölüm başka yolla değişmiş olabilir (personel kartı
    // PUT / doğrudan "Bölüm Değiştir") — bayat talebi sessizce uygulamayız.
    if ((talep.personnel.bolum ?? '') === talep.hedefBolum) {
      return NextResponse.json(
        { error: 'Personel zaten hedef bölümde — talep geçersiz, reddedin' },
        { status: 409 },
      )
    }

    const sonuc = await prisma.$transaction(async (tx) => {
      const transfer = await bolumTransferiUygula(tx, {
        personnel: talep.personnel,
        yeniBolum: talep.hedefBolum,
        transferTarihi,
        talepTarihi: talep.talepTarihi,
        // Talep daima bölüm yöneticisinden gelir (personel onayı FAZ 2).
        talepEden: 'BOLUM_YONETICISI',
        isgOnayi: isgOnayi as TransferOnay,
        doktorOnayi: doktorOnayi as TransferOnay,
        gerekceler: talep.gerekceler,
        gerekceAciklamasi: talep.gerekceAciklamasi,
        gerekceDigerKisi: talep.gerekceDigerKisi,
        gerekceDigerIs: talep.gerekceDigerIs,
        actorId: user.id,
        actorEmail: user.email,
        talepNo: talep.talepNo,
      })

      const t = await tx.bolumDegisiklikTalep.update({
        where: { id },
        data: {
          durum: 'ONAYLANDI',
          kararVerenId: user.id,
          kararTarihi: simdi,
          transferTarihi,
          isgOnayi: isgOnayi as TransferOnay,
          doktorOnayi: doktorOnayi as TransferOnay,
          transferId: transfer.transferId,
        },
        include: { personnel: { select: { sicilNo: true, adSoyad: true } } },
      })

      await tx.permissionAuditLog.create({
        data: {
          action: 'BOLUM_TALEP_ONAY',
          actorId: user.id,
          targetType: 'PERSONNEL',
          targetId: talep.personnelId,
          details: {
            talepNo: t.talepNo,
            talepId: t.id,
            kararVerenEmail: user.email,
            personnelSicilNo: t.personnel.sicilNo,
            mevcutBolum: t.mevcutBolum,
            hedefBolum: t.hedefBolum,
            transferId: transfer.transferId,
            transferTarihi: transferTarihi.toISOString(),
            isgOnayi,
            doktorOnayi,
            koltukTasindi: transfer.koltuk.tasindi,
            koltukSebep: transfer.koltuk.sebep ?? null,
          },
        },
      })

      return { talep: t, transfer }
    })

    await kararBildir(
      { ...sonuc.talep, personnel: sonuc.talep.personnel },
      user.name ?? user.email ?? 'İnsan Varlıkları',
    )

    return NextResponse.json({
      ok: true,
      talep: sonuc.talep,
      koltuk: sonuc.transfer.koltuk,
      ...(sonuc.transfer.koltukAcma ? { koltukAcma: sonuc.transfer.koltukAcma } : {}),
    })
  } catch (err) {
    console.error('Bölüm talep karar hatası:', err)
    return NextResponse.json({ error: 'Karar kaydedilemedi' }, { status: 500 })
  }
}
