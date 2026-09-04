// PR-PERSONNEL-DEPARTMENT-TRANSFER: Tek personelin bölüm değişiklik akışı.
import { bolumFkCoz } from '@/lib/personnel/fk-cozum'
import { personelGoreviDegisti, personelEklendiginde, KOLTUK_YOK_SEBEBI, type GorevDegisimSonuc, type YeniPersonelSonuc } from '@/lib/org/personel-koltuk-senkron'
//
// POST: yeni transfer kaydı. Transaction'da:
//   1. PersonnelDepartmentTransfer create
//   2. Personnel.bolum yeni bölümle güncelle
//   3. Org şeması: ana koltuğu yeni bölümün kutusuna taşı (personelGoreviDegisti);
//      ana koltuğu HİÇ yoksa bir kez açmayı dene (personelEklendiginde)
//   4. permission_audit_log PERSONNEL_DEPARTMENT_TRANSFER kaydı (koltuk sonucu DAHİL)
//
// GET: bu personelin tüm geçmiş transferleri (desc).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'

const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  return isInsanVarliklari(dept)
}

function hasEditAccess(role: string, department?: string | null): boolean {
  return EDIT_ROLES.includes(role) || isHRDepartment(department)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasEditAccess(user.role, user.department)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const personnel = await prisma.personnel.findUnique({ where: { id } })
    if (!personnel) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }
    if (!personnel.aktif) {
      return NextResponse.json(
        { error: 'Pasif personelin bölümü değiştirilemez' },
        { status: 400 }
      )
    }

    // Validation
    const required = ['talepTarihi', 'talepEden', 'isgOnayi', 'doktorOnayi', 'transferEdilenBolum', 'transferTarihi']
    const missing = required.filter((k) => !body[k] || String(body[k]).trim() === '')
    if (missing.length > 0) {
      return NextResponse.json({ error: 'Zorunlu alan eksik', missing }, { status: 400 })
    }
    if (!Array.isArray(body.gerekceler) || body.gerekceler.length === 0) {
      return NextResponse.json({ error: 'En az bir gerekçe seçilmeli' }, { status: 400 })
    }
    if (String(body.transferEdilenBolum).trim() === (personnel.bolum ?? '').trim()) {
      return NextResponse.json(
        { error: 'Yeni bölüm mevcut bölümle aynı olamaz' },
        { status: 400 }
      )
    }

    const oldDepartment = personnel.bolum ?? '(belirtilmemiş)'
    const newDepartment = String(body.transferEdilenBolum).trim()

    // Koltuk sonucu yanıtta İK'ya döner (taşınmadıysa sebebiyle birlikte).
    let koltukSonuc: GorevDegisimSonuc = { tasindi: false, sebep: 'calistirilmadi' }
    // Açma yalnız "ana koltuğu yok" durumunda denenir; taşıma sonucundan ayrı tutulur.
    let koltukAcmaSonuc: YeniPersonelSonuc | null = null
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.personnelDepartmentTransfer.create({
        data: {
          personnelId: personnel.id,
          talepTarihi: new Date(body.talepTarihi),
          talepEden: body.talepEden,
          isgOnayi: body.isgOnayi,
          doktorOnayi: body.doktorOnayi,
          gerekceler: body.gerekceler,
          gerekceAciklamasi: body.gerekceAciklamasi || null,
          gerekceDigerKisi: body.gerekceDigerKisi || null,
          gerekceDigerIs: body.gerekceDigerIs || null,
          transferEdenBolum: oldDepartment,
          transferEdilenBolum: newDepartment,
          transferTarihi: new Date(body.transferTarihi),
          kayitEdenId: user.id,
        },
      })

      // FAZ 1 · ÇİFT YAZIM: bolum metni + departmentId birlikte. Transfer TARİHÇESİ
      // (personnel_department_transfer) metin kalır — tarihçe anlık görüntüdür.
      await tx.personnel.update({
        where: { id: personnel.id },
        data: {
          bolum: newDepartment,
          departmentId: await bolumFkCoz(tx, newDepartment),
          updatedAt: new Date(),
        },
      })

      // 2b. ORG ŞEMASI — ana koltuğu yeni bölümün kutusuna taşı.
      //
      // NEDEN BURADA: bölüm değişikliği bugüne dek YALNIZ Personnel'i güncelliyordu;
      // kişi eski bölümün kutusunda oturmaya devam ediyordu (03.09.2026 ölçümü:
      // ILR-01114 bugün Talaşlı İmalat → Mekanik Montaj transfer edildi ama koltuğu
      // "CNC Torna Opr." kutusunda kaldı). Taşıma mantığı zaten `{bolum, gorev}`
      // ÇİFTİNE göre çalışıyor — eksik olan tek şey çağrıydı.
      //
      // ROLLBACK YOK: fonksiyon ASLA throw etmez (kendi try/catch'i var) ve eşleşme
      // bulunamazsa koltuğu YERİNDE bırakıp sebep döner. Bölüm değişikliği bir İK
      // işlemidir; şema ikincildir — koltuk taşınamadı diye transfer kaydı ve bölüm
      // güncellemesi geri alınmaz, yalnız loglanır.
      koltukSonuc = await personelGoreviDegisti(tx, personnel.id, { actorId: user.id })

      // KOLTUK YOKSA AÇ — taşıma fonksiyonu yalnız TAŞIR (sözleşmesi değişmedi).
      // Koltuğu hiç açılmamış kişide bölüm transferi de sessiz kalıyordu; artık
      // BİR KEZ açma denenir. `personelEklendiginde` idempotent ve YENİ KUTU AÇMAZ:
      // boş kutu yoksa sebebiyle döner, transfer yine geçerli kalır.
      if (!koltukSonuc.tasindi && koltukSonuc.sebep === KOLTUK_YOK_SEBEBI) {
        koltukAcmaSonuc = await personelEklendiginde(tx, personnel.id, { actorId: user.id })
      }

      if (!koltukSonuc.tasindi && !koltukAcmaSonuc?.koltukAcildi) {
        console.warn('[department-transfer] koltuk tasinmadi:', {
          personnelId: personnel.id,
          sicilNo: personnel.sicilNo,
          eskiBolum: oldDepartment,
          yeniBolum: newDepartment,
          eskiKoltuk: koltukSonuc.eskiOrgUnitAdi ?? null,
          reason: koltukSonuc.sebep ?? '(sebep yok)',
          acmaDenendiMi: koltukAcmaSonuc !== null,
          acmaSebebi: koltukAcmaSonuc?.sebep ?? null,
        })
      } else if (koltukAcmaSonuc?.koltukAcildi) {
        console.info('[department-transfer] koltuk ACILDI (tasima degil):', {
          personnelId: personnel.id,
          sicilNo: personnel.sicilNo,
          yeniBolum: newDepartment,
          kutu: koltukAcmaSonuc.orgUnitAdi ?? null,
        })
      }

      // 3. DENETİM KAYDI — koltuk adımından SONRA yazılır ki sonucu (taşındı / açıldı /
      //    hiçbiri + sebep) aynı kayıtta görünsün. Sıra değişti, içerik korundu.
      await tx.permissionAuditLog.create({
        data: {
          action: 'PERSONNEL_DEPARTMENT_TRANSFER',
          actorId: user.id,
          targetType: 'PERSONNEL',
          targetId: personnel.id,
          details: {
            actorEmail: user.email,
            personnelSicilNo: personnel.sicilNo,
            personnelName: personnel.adSoyad,
            oldDepartment,
            newDepartment,
            transferDate: transfer.transferTarihi?.toISOString() ?? null,
            talepEden: transfer.talepEden,
            isgOnayi: transfer.isgOnayi,
            doktorOnayi: transfer.doktorOnayi,
            gerekceler: transfer.gerekceler,
            transferId: transfer.id,
            // Prisma Json alanı düz nesne ister (arayüz tipi kabul etmiyor) — alanlar
            // açıkça yazılıyor; `undefined` yerine null (Json'da undefined geçersiz).
            koltuk: {
              tasindi: koltukSonuc.tasindi,
              sebep: koltukSonuc.sebep ?? null,
              eskiKoltuk: koltukSonuc.eskiOrgUnitAdi ?? null,
              yeniKoltuk: koltukSonuc.yeniOrgUnitAdi ?? null,
            },
            ...(koltukAcmaSonuc
              ? {
                  koltukAcma: {
                    koltukAcildi: koltukAcmaSonuc.koltukAcildi,
                    sebep: koltukAcmaSonuc.sebep ?? null,
                    kutu: koltukAcmaSonuc.orgUnitAdi ?? null,
                  },
                }
              : {}),
          },
        },
      })

      return transfer
    })

    return NextResponse.json({
      ok: true,
      transfer: result,
      koltuk: koltukSonuc,
      ...(koltukAcmaSonuc ? { koltukAcma: koltukAcmaSonuc } : {}),
    })
  } catch (err) {
    console.error('Department transfer POST hatası:', err)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasEditAccess(user.role, user.department)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const { id } = await params

    const transfers = await prisma.personnelDepartmentTransfer.findMany({
      where: { personnelId: id },
      include: { kayitEden: { select: { id: true, name: true, email: true } } },
      orderBy: { transferTarihi: 'desc' },
    })

    return NextResponse.json(transfers)
  } catch (err) {
    console.error('Department transfer GET hatası:', err)
    return NextResponse.json({ error: 'Geçmiş yüklenemedi' }, { status: 500 })
  }
}
