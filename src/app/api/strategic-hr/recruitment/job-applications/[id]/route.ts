import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { resolveTransitionRoles } from '@/lib/recruitment/resolve-roles'
import { digerBasvurular } from '@/lib/recruitment/mukerrer-basvuru'
import { oturumOzetiGetir } from '@/lib/recruitment/assessment-session'
import { logAuditEvent } from '@/lib/audit-log'
import { fotoDosyasiniSil } from '@/lib/job-application/foto-dosya'
import {
  basvuruDuzeltmeSchema,
  degisiklikleriCikar,
  DUZENLENEBILIR_ALANLAR,
} from '@/lib/recruitment/basvuru-duzeltme-alanlari'

// PR-RECRUIT-RBAC: PublicJobApplication — İK (recruitment.admin/hr.admin) tam erişim;
// atanan müdür (assignedManagerId) yalnız değerlendirme için gereken NON-hassas alanlar.

// Saf müdür (İK yetkisi yok) görünürlük WHITELIST'i. Alan seçimi SUNUCUDA yapılır —
// hassas alanlar (TC, doğum, adli sicil, sağlık, medeni/askerlik, beden, KVKK imza, ev adresi,
// İK notu, iletişim) client'a HİÇ gönderilmez. (org modülü hasFullAccess deseni.)
const MANAGER_SELECT = {
  id: true,
  applicationNumber: true,
  fullName: true,
  requestedPosition: true,
  educationLevel: true,
  educationHistory: true,
  workExperience: true,
  foreignLanguages: true,
  computerSkills: true,
  coursesAndSeminars: true,
  photoUrl: true,
  status: true,
  assignedManagerId: true,
  assignedAt: true,
  createdAt: true,
} satisfies Prisma.PublicJobApplicationSelect

// GET - Başvuru detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession()
    if (error) return error

    const { id } = await params

    // Rol belirleme için önce yalnız atama bilgisini oku (hassas veri çekmeden).
    const base = await prisma.publicJobApplication.findUnique({
      where: { id },
      select: { id: true, assignedManagerId: true },
    })
    if (!base) {
      return NextResponse.json({ error: 'Basvuru bulunamadi' }, { status: 404 })
    }

    // Yetki: İK (recruitment.admin/hr.admin) VEYA atanan müdür. TEK KAYNAK (resolve-roles).
    const roles = resolveTransitionRoles({
      permissions: session.user.permissions,
      userId: session.user.id,
      assignedManagerId: base.assignedManagerId,
    })
    if (roles.length === 0) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
    }

    // İK → tam kayıt (mevcut davranış birebir korunur) + sınav oturum özeti (İK: aktif linkli).
    // Onaylar kartı için KVKK onayı + sağlık beyanı varlığı/tarihi (mevcut ilişkilerden, yeni uç yok).
    if (roles.includes('IK')) {
      const application = await prisma.publicJobApplication.findUnique({
        where: { id },
        include: {
          consent: { select: { signedAt: true, createdAt: true, documentCode: true, documentRev: true } },
          health: { select: { createdAt: true } },
          // Kaynak SÖZLÜKTEN — ekran adı buradan okur. Eski `referralSource` enum kolonu
          // kayıtta duruyor ama yazma tarafı ona ARTIK YAZMIYOR, o yüzden okunmaz.
          referralSourceDef: { select: { name: true } },
        },
      })
      const sinavlar = await oturumOzetiGetir(prisma, id, { ik: true })
      // Aynı adayın DİĞER başvuruları — YALNIZ İK yolunda. Saf müdür dalında bu çağrı
      // HİÇ yapılmaz (aşağıya bakınız): adayın geçmişi İV'nin bilgisidir.
      const oncekiBasvurular = application
        ? await digerBasvurular(prisma, {
            id: application.id,
            tcKimlikNo: application.tcKimlikNo,
            createdAt: application.createdAt,
          })
        : []
      const onaylar = {
        kvkkAlindi: !!application?.consent,
        kvkkTarih: application?.consent?.signedAt ?? null,
        saglikBeyaniAlindi: !!application?.health,
        saglikTarih: application?.health?.createdAt ?? null,
        beyanKabul: !!application?.declarationAccepted,
        beyanTarih: application?.declarationDate ?? null,
      }
      return NextResponse.json({ ...application, onaylar, sinavlar, oncekiBasvurular })
    }

    // Saf müdür → whitelist alanlar + kısıtlı işaret + sınav özeti (müdür: puan/durum/tarih VAR,
    // sinavLink/token YOK — alan kapısı SUNUCUDA oturumOzetiGetir({ik:false})).
    const application = await prisma.publicJobApplication.findUnique({
      where: { id },
      select: MANAGER_SELECT,
    })
    const sinavlar = await oturumOzetiGetir(prisma, id, { ik: false })
    // Müdür: yalnız "alındı/alınmadı" — sağlık İÇERİĞİ ve tarihleri GÖNDERİLMEZ (hassas alan kuralı).
    const [consentSayi, healthSayi, beyan] = await Promise.all([
      prisma.jobApplicationConsent.count({ where: { applicationId: id } }),
      prisma.jobApplicationHealth.count({ where: { applicationId: id } }),
      prisma.publicJobApplication.findUnique({ where: { id }, select: { declarationAccepted: true } }),
    ])
    const onaylar = {
      kvkkAlindi: consentSayi > 0,
      saglikBeyaniAlindi: healthSayi > 0,
      beyanKabul: !!beyan?.declarationAccepted,
    }
    return NextResponse.json({ ...application, _restrictedView: true, onaylar, sinavlar })
  } catch (error) {
    console.error('Basvuru detayi alinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - Başvuru İK notlarını güncelle (yalnız notes)
//
// STATÜ DEĞİŞİMİ ARTIK BURADA YAPILMAZ. Tüm durum geçişleri tek geçit olan
// POST /api/recruitment/applications/[id]/transition üzerinden yapılır (izin matrisi +
// StageLog + bildirim + ret nedeni orada atomik). Bu uç yalnız İK notunu günceller.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession()
    if (error) return error

    if (!session.user.permissions?.includes('recruitment.admin')) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { notes } = body

    // ── 1) İK notu — MEVCUT DAVRANIŞ AYNEN. Denetime girmez (aday verisi değil, iç not).
    const updateData: Prisma.PublicJobApplicationUpdateInput = {}
    if (notes !== undefined) updateData.notes = notes

    // ── 2) Aday verisi düzeltmesi — BEYAZ LİSTE (basvuru-duzeltme-alanlari.ts TEK KAYNAK).
    // Zod nesnesi `.strict()` DEĞİL: beyaz liste dışı alan gövdede gelirse hata dönmez,
    // sessizce düşer ve YAZILMAZ. Statü kısıtı YOK — yanlış telefon her aşamada düzeltilebilir
    // olmalı; statü değişimi zaten bu uçtan yapılamıyor (tek geçit transition ucu).
    const parsed = basvuruDuzeltmeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Doğrulama hatası',
          alanHatalari: parsed.error.issues.map((i) => ({
            alan: i.path.join('.'),
            mesaj: i.message,
          })),
        },
        { status: 400 },
      )
    }

    // Değişiklikleri hesaplamak için ÖNCEKİ değerler — yalnız beyaz listedeki alanlar.
    const oncekiSelect = Object.fromEntries(DUZENLENEBILIR_ALANLAR.map((a) => [a, true]))
    const onceki = await prisma.publicJobApplication.findUnique({
      where: { id },
      select: oncekiSelect as Prisma.PublicJobApplicationSelect,
    })
    if (!onceki) {
      return NextResponse.json({ error: 'Basvuru bulunamadi' }, { status: 404 })
    }

    const degisiklikler = degisiklikleriCikar(
      onceki as Record<string, unknown>,
      parsed.data,
    )
    for (const d of degisiklikler) {
      // Alan adı beyaz listeden geldi (degisiklikleriCikar yalnız onları üretir).
      ;(updateData as Record<string, unknown>)[d.alan] = d.yeni
    }

    // ── 3) Yazma + denetim AYNI transaction'da. Denetim kaydı yazılamazsa düzeltme de
    // geri alınır (logAuditEvent'e `tx` verilince hata FIRLATIR — bkz. audit-log.ts).
    // Gerekçe: "kim neyi değiştirdi" izi olmadan düzeltme kalıcı olmamalı.
    const application = await prisma.$transaction(async (tx) => {
      const guncel = await tx.publicJobApplication.update({ where: { id }, data: updateData })
      if (degisiklikler.length > 0) {
        await logAuditEvent({
          action: 'JOB_APPLICATION_UPDATED',
          actorId: session.user.id,
          targetType: 'JOB_APPLICATION',
          targetId: id,
          details: {
            applicationNumber: guncel.applicationNumber,
            // Alan başına eski/yeni — denetim geçmişi ekranı bunu okur.
            degisiklikler,
          },
          tx,
        })
      }
      return guncel
    })

    return NextResponse.json(application)
  } catch (error) {
    console.error('Basvuru guncellenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Başvuru sil (sadece admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession()
    if (error) return error

    if (!session.user.permissions?.includes('recruitment.admin')) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
    }

    const { id } = await params

    // 1) Silmeden ÖNCE photoUrl'ü oku — kayıt gidince URL'e ulaşılamaz.
    const oncesi = await prisma.publicJobApplication.findUnique({
      where: { id },
      select: { applicationNumber: true, photoUrl: true },
    })
    if (!oncesi) {
      return NextResponse.json({ error: 'Basvuru bulunamadi' }, { status: 404 })
    }

    // 2) DB kaydını sil (bağlı tablolar Cascade ile gider; RecruitmentCost SetNull — kasıtlı).
    await prisma.publicJobApplication.delete({ where: { id } })

    // 3) Diskteki fotoğrafı sil. SIRA ÖNEMLİ: DB silmesi başarılı olduktan SONRA.
    //    Dosya silme BAŞARISIZ olsa bile DB silmesi GERİ ALINMAZ — "kayıt gitti, dosya kaldı"
    //    durumu tersinden (kayıt duruyor, dosya yok) daha az zararlı. Helper throw ETMEZ;
    //    kapsam dışı yol SİLİNMEZ (path traversal koruması) ve aşağıda denetime yazılır.
    const fotoSonuc = await fotoDosyasiniSil(oncesi.photoUrl)
    if (!fotoSonuc.silindi && fotoSonuc.sebep !== 'url-yok' && fotoSonuc.sebep !== 'dosya-yok') {
      console.error('[job-application DELETE] fotograf silinemedi:', fotoSonuc)
    }

    // 4) Denetim — mevcut logAuditEvent deseni (tx YOK: DB silmesi zaten tamamlandı,
    //    denetim hatası silmeyi geri alamaz/almamalı).
    await logAuditEvent({
      action: 'JOB_APPLICATION_DELETED',
      actorId: session.user.id,
      targetType: 'JOB_APPLICATION',
      targetId: id,
      details: {
        applicationNumber: oncesi.applicationNumber,
        photoUrl: oncesi.photoUrl,
        fotoSilindi: fotoSonuc.silindi,
        fotoSonuc: fotoSonuc.silindi ? 'silindi' : fotoSonuc.sebep,
      },
    })

    return NextResponse.json({ success: true, fotoSilindi: fotoSonuc.silindi })
  } catch (error) {
    console.error('Basvuru silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
