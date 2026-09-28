// Bölüm transferinin UYGULAMA çekirdeği — TEK KAYNAK (28.09.2026).
//
// Gövdesi POST /api/personnel/[id]/department-transfer içinden AYNEN çıkarıldı;
// davranış değişmedi. İkinci çağıran: Bölüm Değişikliği Talep Formu'nun İV onayı
// (POST /api/bolum-degisiklik-talep/[id]/karar). Aynı transaction içinde koşar.
//
// SIRA (değişmedi):
//   1. PersonnelDepartmentTransfer create
//   2. Personnel.bolum + departmentId (FAZ 1 çift yazım)
//   3. Org şeması: ana koltuğu yeni bölümün kutusuna taşı; koltuk HİÇ yoksa bir kez aç
//   4. permission_audit_log PERSONNEL_DEPARTMENT_TRANSFER (koltuk sonucu DAHİL)
//
// ROLLBACK YOK: koltuk fonksiyonları throw etmez, eşleşme yoksa koltuğu yerinde
// bırakıp sebep döner. Bölüm değişikliği bir İK işlemidir; şema ikincildir.

import type { Prisma, TransferOnay, TransferTalepEden } from '@/generated/prisma'
import { bolumFkCoz } from '@/lib/personnel/fk-cozum'
import {
  personelGoreviDegisti,
  personelEklendiginde,
  KOLTUK_YOK_SEBEBI,
  type GorevDegisimSonuc,
  type YeniPersonelSonuc,
} from '@/lib/org/personel-koltuk-senkron'

export interface BolumTransferGirdisi {
  personnel: { id: string; sicilNo: string | null; adSoyad: string; bolum: string | null }
  yeniBolum: string
  transferTarihi: Date
  talepTarihi: Date
  talepEden: TransferTalepEden
  isgOnayi: TransferOnay
  doktorOnayi: TransferOnay
  gerekceler: string[]
  gerekceAciklamasi?: string | null
  gerekceDigerKisi?: string | null
  gerekceDigerIs?: string | null
  /** Denetim aktörü ve kayitEden — gerçek User.id olmalı (FK). */
  actorId: string
  actorEmail?: string | null
  /** Talep formundan geliyorsa denetim detayına eklenir (izlenebilirlik). */
  talepNo?: string | null
}

export interface BolumTransferSonucu {
  transferId: string
  transferTarihi: Date | null
  koltuk: GorevDegisimSonuc
  koltukAcma: YeniPersonelSonuc | null
}

export async function bolumTransferiUygula(
  tx: Prisma.TransactionClient,
  girdi: BolumTransferGirdisi,
): Promise<BolumTransferSonucu> {
  const { personnel, actorId } = girdi
  const oldDepartment = personnel.bolum ?? '(belirtilmemiş)'
  const newDepartment = girdi.yeniBolum.trim()

  const transfer = await tx.personnelDepartmentTransfer.create({
    data: {
      personnelId: personnel.id,
      talepTarihi: girdi.talepTarihi,
      talepEden: girdi.talepEden,
      isgOnayi: girdi.isgOnayi,
      doktorOnayi: girdi.doktorOnayi,
      gerekceler: girdi.gerekceler,
      gerekceAciklamasi: girdi.gerekceAciklamasi || null,
      gerekceDigerKisi: girdi.gerekceDigerKisi || null,
      gerekceDigerIs: girdi.gerekceDigerIs || null,
      transferEdenBolum: oldDepartment,
      transferEdilenBolum: newDepartment,
      transferTarihi: girdi.transferTarihi,
      kayitEdenId: actorId,
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

  // ORG ŞEMASI — ana koltuğu yeni bölümün kutusuna taşı. Taşıma mantığı
  // `{bolum, gorev}` ÇİFTİNE göre çalışır; bölüm güncellendikten sonra çağrılır.
  const koltukSonuc = await personelGoreviDegisti(tx, personnel.id, { actorId })

  // KOLTUK YOKSA AÇ — taşıma fonksiyonu yalnız TAŞIR (sözleşmesi değişmedi).
  // `personelEklendiginde` idempotent ve YENİ KUTU AÇMAZ: boş kutu yoksa sebebiyle döner.
  let koltukAcmaSonuc: YeniPersonelSonuc | null = null
  if (!koltukSonuc.tasindi && koltukSonuc.sebep === KOLTUK_YOK_SEBEBI) {
    koltukAcmaSonuc = await personelEklendiginde(tx, personnel.id, { actorId })
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

  // DENETİM — koltuk adımından SONRA yazılır ki sonucu (taşındı / açıldı / hiçbiri
  // + sebep) aynı kayıtta görünsün.
  await tx.permissionAuditLog.create({
    data: {
      action: 'PERSONNEL_DEPARTMENT_TRANSFER',
      actorId,
      targetType: 'PERSONNEL',
      targetId: personnel.id,
      details: {
        actorEmail: girdi.actorEmail ?? null,
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
        // Talep formundan geldiyse kaynak talep numarası (doğrudan yolda null).
        talepNo: girdi.talepNo ?? null,
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

  return {
    transferId: transfer.id,
    transferTarihi: transfer.transferTarihi,
    koltuk: koltukSonuc,
    koltukAcma: koltukAcmaSonuc,
  }
}
