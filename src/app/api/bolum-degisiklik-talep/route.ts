// Bölüm Değişikliği Talep Formu — liste + oluşturma.
//
// GET  : İV → TÜM talepler (durum/bölüm/tarih filtreleri). Müdür/müdür-yrd →
//        YALNIZ kendi açtıkları (acanUserId). Diğer herkes 403.
// POST : yalnız müdür/müdür-yrd. Personel, açanın kendi bölümü + ALT AĞACI
//        içinde olmalı. İV talep açmaz (kendi yolu personel kartı).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { bolumTalepYetkisiCore } from '@/lib/bolum-talep/bolum-talep-yetki'
import { yeniTalepNo } from '@/lib/bolum-talep/talep-no'
import { talepAcildiBildir } from '@/lib/bolum-talep/bolum-talep-bildirim'
import { platformYoneticiDenetim } from '@/lib/auth/platform-yonetici'
import type { Prisma } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

const LISTE_INCLUDE = {
  personnel: { select: { id: true, sicilNo: true, adSoyad: true, bolum: true } },
  acan: { select: { id: true, name: true, email: true } },
  kararVeren: { select: { id: true, name: true, email: true } },
} as const

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const yetki = await bolumTalepYetkisiCore(user.id, user.role, user.department)
    if (!yetki.erisebilir) {
      return NextResponse.json({ error: 'Bu forma erişim yetkiniz yok' }, { status: 403 })
    }

    const sp = request.nextUrl.searchParams
    const durum = sp.get('durum')
    const bolum = sp.get('bolum')
    const from = sp.get('from')
    const to = sp.get('to')

    const where: Prisma.BolumDegisiklikTalepWhereInput = {}
    // KAPSAM: İV hepsini görür; koltuk sahibi YALNIZ kendi açtıklarını.
    if (!yetki.iv) where.acanUserId = user.id
    if (durum === 'BEKLIYOR' || durum === 'ONAYLANDI' || durum === 'REDDEDILDI' || durum === 'IPTAL') {
      where.durum = durum
    }
    if (bolum) where.OR = [{ mevcutBolum: bolum }, { hedefBolum: bolum }]
    if (from || to) {
      where.talepTarihi = {}
      if (from) where.talepTarihi.gte = new Date(from)
      if (to) where.talepTarihi.lte = new Date(`${to}T23:59:59`)
    }

    const talepler = await prisma.bolumDegisiklikTalep.findMany({
      where,
      include: LISTE_INCLUDE,
      orderBy: [{ durum: 'asc' }, { talepTarihi: 'desc' }],
      take: 500,
    })

    const bekleyen = await prisma.bolumDegisiklikTalep.count({
      where: { ...where, durum: 'BEKLIYOR' },
    })

    return NextResponse.json({
      talepler,
      bekleyen,
      kapsam: yetki.iv ? 'tumu' : 'kendi',
      iv: yetki.iv,
      talepAcabilir: yetki.talepAcabilir,
    })
  } catch (err) {
    console.error('Bölüm talep liste hatası:', err)
    return NextResponse.json({ error: 'Liste yüklenemedi' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const yetki = await bolumTalepYetkisiCore(user.id, user.role, user.department)
    // İV DAHİL, koltuğu olmayan hiç kimse talep açamaz (Melih kararı 28.09).
    if (!yetki.talepAcabilir || !yetki.rol) {
      return NextResponse.json(
        { error: 'Talep yalnız müdür ve müdür yardımcıları tarafından açılabilir' },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const personnelId = String(body.personnelId ?? '').trim()
    const hedefBolum = String(body.hedefBolum ?? '').trim()
    if (!personnelId || !hedefBolum) {
      return NextResponse.json({ error: 'Personel ve hedef bölüm zorunludur' }, { status: 400 })
    }
    if (!Array.isArray(body.gerekceler) || body.gerekceler.length === 0) {
      return NextResponse.json({ error: 'En az bir gerekçe seçilmeli' }, { status: 400 })
    }

    const personnel = await prisma.personnel.findUnique({
      where: { id: personnelId },
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true, aktif: true },
    })
    if (!personnel) return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    if (!personnel.aktif) {
      return NextResponse.json({ error: 'Pasif personel için talep açılamaz' }, { status: 400 })
    }

    // KAPSAM KAPISI: personel açanın bölümü ya da alt bölümlerinden biri olmalı.
    const kapsamAdlari = yetki.kapsamBolumler.map((b) => b.name)
    if (!personnel.bolum || !kapsamAdlari.includes(personnel.bolum)) {
      return NextResponse.json(
        { error: 'Bu personel sizin bölümünüz ve alt bölümleriniz dışında — talep açılamaz' },
        { status: 403 },
      )
    }
    if (hedefBolum === (personnel.bolum ?? '').trim()) {
      return NextResponse.json({ error: 'Hedef bölüm mevcut bölümle aynı olamaz' }, { status: 400 })
    }
    const hedef = await prisma.departmentDefinition.findFirst({
      where: { name: hedefBolum, isActive: true },
      select: { id: true },
    })
    if (!hedef) {
      return NextResponse.json({ error: 'Hedef bölüm tanımlı değil' }, { status: 400 })
    }

    // AÇANIN KENDİ BÖLÜMÜ (snapshot). Eskiden kapsam listesinin İLK elemanı
    // yazılıyordu (30.09 hata: çok bölümlü müdürde/platform yöneticisinde alfabetik
    // ilk bölüm — "Melih Dilben · Müdür · Asansör Müdürlüğü"). Doğrusu açanın
    // Personnel.bolum değeri; Personnel bağı yoksa null kalır.
    const acanPersonnel = yetki.personnelId
      ? await prisma.personnel.findUnique({
          where: { id: yetki.personnelId },
          select: { bolum: true },
        })
      : null

    // Aynı personel için bekleyen talep varsa ikincisi açılmaz (DB'de kısmi
    // unique index de var; burada anlamlı mesajla erken dönülür).
    const bekleyenVar = await prisma.bolumDegisiklikTalep.findFirst({
      where: { personnelId, durum: 'BEKLIYOR' },
      select: { talepNo: true },
    })
    if (bekleyenVar) {
      return NextResponse.json(
        { error: `Bu personel için İnsan Varlıkları'nda bekleyen bir talep var (${bekleyenVar.talepNo})` },
        { status: 409 },
      )
    }

    const talep = await prisma.$transaction(async (tx) => {
      const olusan = await tx.bolumDegisiklikTalep.create({
        data: {
          talepNo: await yeniTalepNo(tx),
          personnelId: personnel.id,
          acanUserId: user.id,
          acanPersonnelId: yetki.personnelId,
          acanRol: yetki.rol!,
          acanBolum: acanPersonnel?.bolum ?? null,
          mevcutBolum: personnel.bolum ?? '(belirtilmemiş)',
          hedefBolum,
          // Yeni görev OPSİYONEL; boşsa onay anında mevcut görev korunur.
          hedefGorev: typeof body.hedefGorev === 'string' && body.hedefGorev.trim() ? body.hedefGorev.trim() : null,
          transferTarihi: body.transferTarihi ? new Date(body.transferTarihi) : null,
          gerekceler: body.gerekceler,
          gerekceAciklamasi: body.gerekceAciklamasi || null,
          gerekceDigerKisi: body.gerekceDigerKisi || null,
          gerekceDigerIs: body.gerekceDigerIs || null,
        },
        include: LISTE_INCLUDE,
      })

      await tx.permissionAuditLog.create({
        data: {
          action: 'BOLUM_TALEP_OLUSTUR',
          actorId: user.id,
          targetType: 'PERSONNEL',
          targetId: personnel.id,
          details: {
            talepNo: olusan.talepNo,
            talepId: olusan.id,
            acanEmail: user.email,
            acanRol: yetki.rol,
            personnelSicilNo: personnel.sicilNo,
            personnelName: personnel.adSoyad,
            mevcutBolum: olusan.mevcutBolum,
            hedefBolum: olusan.hedefBolum,
            hedefGorev: olusan.hedefGorev,
            transferTarihi: olusan.transferTarihi?.toISOString() ?? null,
            gerekceler: olusan.gerekceler,
          },
        },
      })

      return olusan
    })

    // Kapsam platform yöneticisi kuralından geldiyse denetime düşsün (yazma).
    if (yetki.platformBypass) {
      await platformYoneticiDenetim({
        userId: user.id,
        userEmail: user.email,
        islem: 'bolum-talep:olustur',
        targetType: 'PERSONNEL',
        targetId: personnel.id,
        detay: { talepNo: talep.talepNo, mevcutBolum: talep.mevcutBolum, hedefBolum: talep.hedefBolum },
      })
    }

    // Bildirim best-effort — talebi düşürmez.
    await talepAcildiBildir(talep, user.name ?? user.email ?? 'Bilinmiyor')

    return NextResponse.json({ ok: true, talep })
  } catch (err) {
    console.error('Bölüm talep POST hatası:', err)
    return NextResponse.json({ error: 'Talep oluşturulamadı' }, { status: 500 })
  }
}
