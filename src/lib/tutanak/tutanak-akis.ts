/**
 * IV-FR-03 Tutanak Formu — AKIŞ UYGULAMA (tek giriş noktası).
 *
 * Uçlar durum geçişini kendileri yazmaz; hepsi buradan geçer. Böylece
 *   · geçiş matrisi (tutanak-durum.ts) TEK yerde zorlanır,
 *   · tutanak geçmişi ve denetim kaydı HER adımda yazılır (atlanamaz),
 *   · bildirimler yanıttan sonra, hata yutularak gönderilir.
 *
 * Yazma + geçmiş AYNI transaction'da; bildirim transaction DIŞINDA (mail/push
 * yavaş ve hatalı olabilir, kaydı kilitlemesin).
 */

import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit-log'
import {
  GECIS_YASAK_HATASI,
  aksiyonUygunMu,
  hedefDurum,
  sahitKarariSonrasiDurum,
  type TutanakAksiyon,
} from './tutanak-durum'
import {
  acanaSonucBildir,
  ivEkibineBildir,
  sahitlereBildir,
  sonYoneticiyeBildir,
  yoneticiyeBildir,
  type TutanakBildirimOzeti,
} from './tutanak-bildirim'
import type { TutanakDurum, TutanakGecmisAdim } from '@/generated/prisma'

export type AksiyonGirdisi = {
  tutanakId: string
  aksiyon: TutanakAksiyon
  aktor: { userId: string; ad: string; personnelId: string | null }
  not?: string | null
}

export type AksiyonSonucu =
  | { ok: true; yeniDurum: TutanakDurum }
  | { ok: false; hata: string; kod: 400 | 403 | 404 }

const ADIM_HARITASI: Record<TutanakAksiyon, TutanakGecmisAdim> = {
  GONDER: 'GONDERILDI',
  SAHIT_ONAY: 'SAHIT_ONAYLADI',
  SAHIT_RET: 'SAHIT_REDDETTI',
  YONETICI_ONAY: 'YONETICI_ONAYLADI',
  YONETICI_RET: 'YONETICI_REDDETTI',
  IV_KAPAT: 'IV_KAPATTI',
}

function ozet(t: {
  id: string
  tutanakNo: string
  tutanakTarihi: Date
  adSoyadSnapshot: string
  sicilSnapshot: string | null
  bolumSnapshot: string
  sebep: TutanakBildirimOzeti['sebep']
}): TutanakBildirimOzeti {
  return {
    id: t.id,
    tutanakNo: t.tutanakNo,
    tutanakTarihi: t.tutanakTarihi,
    adSoyadSnapshot: t.adSoyadSnapshot,
    sicilSnapshot: t.sicilSnapshot,
    bolumSnapshot: t.bolumSnapshot,
    sebep: t.sebep,
  }
}

/**
 * Aksiyonu uygular. YETKİ KONTROLÜ ÇAĞIRANDA (tutanakOnaylayabilir) — burada
 * yalnız durum geçişi doğrulanır; iki kapı birbirinin yerine geçmez.
 */
export async function tutanakAksiyonUygula(girdi: AksiyonGirdisi): Promise<AksiyonSonucu> {
  const { tutanakId, aksiyon, aktor } = girdi
  const not = girdi.not?.trim() || null

  const mevcut = await prisma.tutanak.findUnique({
    where: { id: tutanakId },
    include: { sahitler: { select: { id: true, personnelId: true, durum: true } } },
  })
  if (!mevcut) return { ok: false, hata: 'Tutanak bulunamadı', kod: 404 }
  if (!aksiyonUygunMu(mevcut.durum, aksiyon)) {
    return { ok: false, hata: GECIS_YASAK_HATASI, kod: 400 }
  }

  // Şahit kararında, karar veren şahit satırı bulunmalı.
  const sahitSatiri =
    aksiyon === 'SAHIT_ONAY' || aksiyon === 'SAHIT_RET'
      ? mevcut.sahitler.find((s) => s.personnelId === aktor.personnelId && s.durum === 'BEKLIYOR')
      : undefined
  if ((aksiyon === 'SAHIT_ONAY' || aksiyon === 'SAHIT_RET') && !sahitSatiri) {
    return { ok: false, hata: 'Bu tutanakta bekleyen bir şahit kaydınız yok.', kod: 403 }
  }

  // Ret notu zorunlu: gerekçesiz ret akışı tıkar, oluşturan neyi düzelteceğini bilemez.
  if ((aksiyon === 'SAHIT_RET' || aksiyon === 'YONETICI_RET') && !not) {
    return { ok: false, hata: 'Ret gerekçesi zorunludur.', kod: 400 }
  }

  const simdi = new Date()
  let yeniDurum: TutanakDurum = mevcut.durum

  await prisma.$transaction(async (tx) => {
    if (aksiyon === 'SAHIT_ONAY' || aksiyon === 'SAHIT_RET') {
      const kararim = aksiyon === 'SAHIT_ONAY' ? 'ONAYLADI' : 'REDDETTI'
      await tx.tutanakSahit.update({
        where: { id: sahitSatiri!.id },
        data: { durum: kararim, not, kararAt: simdi },
      })
      // Durum, KARARDAN SONRAKİ şahit tablosuna göre hesaplanır.
      const sonrakiDurumlar = mevcut.sahitler.map((s) =>
        s.id === sahitSatiri!.id ? (kararim as typeof s.durum) : s.durum,
      )
      yeniDurum = sahitKarariSonrasiDurum(sonrakiDurumlar)
      await tx.tutanak.update({
        where: { id: tutanakId },
        data: {
          durum: yeniDurum,
          ...(yeniDurum === 'REDDEDILDI' ? { redSebebi: not } : {}),
          // Şahitler tamamlanıp yöneticiye geçtiyse son yönetici bilgilendirme
          // damgası burada atılır; bildirim transaction dışında gönderilir.
          ...(yeniDurum === 'YONETICI_BEKLIYOR' && mevcut.bilgilendirilenSonYoneticiId
            ? { sonYoneticiBildirimAt: simdi }
            : {}),
        },
      })
    } else {
      yeniDurum = hedefDurum(aksiyon)
      await tx.tutanak.update({
        where: { id: tutanakId },
        data: {
          durum: yeniDurum,
          ...(aksiyon === 'GONDER' ? { gonderildiAt: simdi } : {}),
          ...(aksiyon === 'YONETICI_ONAY'
            ? { yoneticiKarar: 'ONAYLADI', yoneticiNot: not, yoneticiKararAt: simdi }
            : {}),
          ...(aksiyon === 'YONETICI_RET'
            ? { yoneticiKarar: 'REDDETTI', yoneticiNot: not, yoneticiKararAt: simdi, redSebebi: not }
            : {}),
          ...(aksiyon === 'IV_KAPAT'
            ? { ivKapatanId: aktor.userId, ivKapanisAt: simdi, ivNot: not }
            : {}),
        },
      })
    }

    await tx.tutanakGecmis.create({
      data: {
        tutanakId,
        adim: ADIM_HARITASI[aksiyon],
        aktorId: aktor.userId,
        aktorAd: aktor.ad,
        not,
        oncekiDurum: mevcut.durum,
        yeniDurum,
      },
    })
  })

  await logAuditEvent({
    action: `TUTANAK_${ADIM_HARITASI[aksiyon]}`,
    actorId: aktor.userId,
    targetType: 'TUTANAK',
    targetId: tutanakId,
    // Açıklama metni denetim kaydına DA yazılmaz (gizli disiplin verisi);
    // yalnız kimlik + geçiş + not izi tutulur.
    details: {
      tutanakNo: mevcut.tutanakNo,
      personnelId: mevcut.personnelId,
      oncekiDurum: mevcut.durum,
      yeniDurum,
      not,
    },
  })

  // ── BİLDİRİMLER (best-effort, transaction dışında) ──
  const o = ozet(mevcut)
  try {
    if (yeniDurum === 'SAHIT_BEKLIYOR') {
      await sahitlereBildir(o, mevcut.sahitler.map((s) => s.personnelId))
    } else if (yeniDurum === 'YONETICI_BEKLIYOR') {
      await yoneticiyeBildir(o, mevcut.yoneticiId)
      if (mevcut.bilgilendirilenSonYoneticiId) {
        await sonYoneticiyeBildir(o, mevcut.bilgilendirilenSonYoneticiId)
        await prisma.tutanakGecmis.create({
          data: {
            tutanakId,
            adim: 'SON_YONETICI_BILGILENDIRILDI',
            aktorId: null,
            aktorAd: 'Sistem',
            not: 'Son yöneticiye mail + Hub bildirimi gönderildi (onay adımında değil).',
          },
        })
      }
    } else if (yeniDurum === 'IK_BEKLIYOR') {
      await ivEkibineBildir(o)
    } else if (yeniDurum === 'REDDEDILDI') {
      await acanaSonucBildir(o, mevcut.acanUserId, { tur: 'REDDEDILDI', kimAd: aktor.ad, not })
    } else if (yeniDurum === 'TAMAMLANDI') {
      await acanaSonucBildir(o, mevcut.acanUserId, { tur: 'TAMAMLANDI', kimAd: aktor.ad, not })
    }
  } catch (err) {
    console.error('[tutanak-akis] bildirim adımı başarısız:', err)
  }

  return { ok: true, yeniDurum }
}
