import { selfEntryOnaydanMuafMi } from '@/lib/onay/muafiyet'
import { resolveApprovers } from '@/lib/onay/yonetici-cozumu'

// Onaycı çözümü (resolveApprovers, getManagedPersonnelIds, muafiyet) ORTAK modüle taşındı:
// src/lib/onay/ (İzin Faz 1, 27.09). Burada yalnız Kart Okutamama'ya özgü onay KURALI kalır.

export interface OnayKarari {
  onayDurumu: 'BEKLIYOR' | 'ONAYLANDI'
  approverId: string | null
  approverId2: string | null
  approverId3: string | null
}

/**
 * Kayıt oluşturulurken onay durumunu ve onaycıları belirleyen TEK KAYNAK —
 * create, bulk ve import yolları buradan çağırır.
 *
 * Kural (üç yolda birebir aynı):
 *   - Başkası/ekip adına satır  → ONAYLANDI, onaycı atanmaz.
 *   - Kendi adına + muaf        → ONAYLANDI, onaycı atanmaz (2026-08 muafiyeti;
 *                                 kayıt doğrudan İV katmanına düşer).
 *   - Kendi adına + muaf değil  → BEKLIYOR + 1./2./3. Sorumlu (çözülemezse
 *                                 bölüm müdürü fallback'i, o da yoksa orphan:
 *                                 BEKLIYOR ama onaycısız — çağıran taraf
 *                                 notifyHrManagerOfUnresolvedApprover ile
 *                                 İ.V. Müdürü'nü haberdar eder).
 *
 * Eskiden bulk yolu muafiyet kontrolünü ATLIYORDU: muaf bir kişi bulk ile kendi
 * satırını girdiğinde BEKLIYOR doğuyor, aynı kişi create/import ile girdiğinde
 * ONAYLANDI doğuyordu.
 */
export async function onayKarariBelirle(
  personnelId: string,
  gonderenPersonnelId: string | null,
  o: { guvenlik?: boolean } = {}
): Promise<OnayKarari> {
  const bos: OnayKarari = {
    onayDurumu: 'ONAYLANDI',
    approverId: null,
    approverId2: null,
    approverId3: null,
  }
  // GÜVENLİK (28.09, İV): güvenliğin açtığı kayıt "başkası adına → ONAYLANDI" kuralından ÇIKAR —
  // her zaman BEKLIYOR + personelin AMİRLERİ. Müdür muafiyeti UYGULANMAZ (o, kişinin KENDİ girişi içindir).
  // Amir çözülemezse orphan (BEKLIYOR, onaycısız) → İ.V. Müdürü bilgilendirilir (çağıran).
  if (!o.guvenlik) {
    if (!gonderenPersonnelId || personnelId !== gonderenPersonnelId) return bos
    if (await selfEntryOnaydanMuafMi(personnelId)) return bos
  }

  const resolved = await resolveApprovers(personnelId)
  return {
    onayDurumu: 'BEKLIYOR',
    approverId: resolved.approverId,
    approverId2: resolved.approverId2,
    approverId3: resolved.approverId3,
  }
}
