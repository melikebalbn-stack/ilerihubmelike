import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'
import { logAuditEvent } from '@/lib/audit-log'
import { personelEklendiginde } from '@/lib/org/personel-koltuk-senkron'

/**
 * POST /api/personnel/[id]/koltuk-ac — "Şemaya Yerleştir".
 *
 * NE YAPAR: kişinin `{bolum, gorev}` çiftine uyan BOŞ kutuya oturtur
 * (`personelEklendiginde`). YENİ KUTU AÇMAZ; boş kadro yoksa sebebiyle döner.
 *
 * NEDEN AYRI UÇ: mevcut `strategic-hr/org-chart/uye-ata` ucu hedef kutuyu ÇAĞIRANDAN
 * ister (org şeması ekranında kutu seçilir). Buradaki akış tersi: personel kartından
 * tek tıkla, hedefi eşleşme motoru bulur. İkisi birbirinin yerine geçmez —
 * otomatik eşleşme tutmazsa İK org şeması ekranından elle yerleştirmeye devam eder.
 *
 * NEDEN GEREKLİ: koltuk yalnız personel OLUŞTURULURKEN açılıyor; o an bölüm/görev
 * şemadaki bir kutuyla eşleşmediyse kişi koltuksuz kalıyor ve sonradan alan
 * düzeltilmedikçe koltuk kazanamıyordu (ILR-01156 örneği).
 *
 * Yetki: personel PUT ucuyla AYNI kapı (ADMIN/HR_MANAGER/SUPER_ADMIN veya İV).
 */

const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

function hasEditAccess(role: string, department?: string | null): boolean {
  return EDIT_ROLES.includes(role) || isInsanVarliklari(department)
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasEditAccess(user.role, user.department)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const { id } = await params
    const personnel = await prisma.personnel.findUnique({
      where: { id },
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true, aktif: true },
    })
    if (!personnel) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }

    const sonuc = await personelEklendiginde(prisma, id, { actorId: user.id })

    // "zaten acik koltugu var" HATA DEĞİL: iki sekmeden art arda basılmış olabilir.
    // Sonuç ne olursa olsun 200 döner; açılıp açılmadığı gövdede.
    await logAuditEvent({
      action: 'PERSONNEL_KOLTUK_ACILDI',
      actorId: user.id,
      targetType: 'PERSONNEL',
      targetId: id,
      details: {
        actorEmail: user.email,
        sicilNo: personnel.sicilNo,
        bolum: personnel.bolum,
        gorev: personnel.gorev,
        koltukAcildi: sonuc.koltukAcildi,
        kutu: sonuc.orgUnitAdi ?? null,
        sebep: sonuc.sebep ?? null,
      },
    })

    if (!sonuc.koltukAcildi) {
      console.warn('[koltuk-ac] koltuk acilmadi:', {
        personnelId: id,
        sicilNo: personnel.sicilNo,
        bolum: personnel.bolum,
        gorev: personnel.gorev,
        reason: sonuc.sebep ?? '(sebep yok)',
      })
    }

    return NextResponse.json(sonuc)
  } catch (err) {
    console.error('Koltuk acma hatasi:', err)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
