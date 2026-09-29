// IV-FR-27 · Puanlanmış adımın GERİ ALINMASI — saf kurallar.
//
// 29.09.2026: Bedri Güler, Fatma Topkara'nın (ILR-01114) 6 ay formunu puanladı
// ama yanlış puanladı. Yönlendirme ucu "puan girilmiş adım yönlendirilemez"
// diyor (doğru — girilmiş puanı başkasının adı altında bırakmamak için), ama
// geri alma yolu YOKTU: form 49 puanla MUDUR_BEKLIYOR'a geçmiş, düzeltilemiyordu.
//
// KARAR: İV adımı geri alabilir. Form AYNI değerlendiricide kalır (yönlendirme
// DEĞİL), puanları silinir, değerlendirici yeniden doldurur.
//
// SAF: DB'ye/oturuma bakmaz — uç ve testler aynı kuralı çağırır.

import type { DenemeDurum, DenemeDegerlendiriciRol } from "@/generated/prisma";

/** Geri alma kararı için gereken asgari form görünümü. */
export type GeriAlinacakForm = {
  durum: DenemeDurum;
  degerlendirici1At: Date | null;
  degerlendirici2At: Date | null;
  degerlendirici2Id: string | null;
  degerlendirici2Rol: DenemeDegerlendiriciRol | null;
  /** O sıraya yazılmış puan satırı sayısı (taslak dahil). */
  puanSatirSayisi: { sira1: number; sira2: number };
};

export type GeriAlmaKarar =
  | { ok: true; hedefDurum: DenemeDurum }
  | { ok: false; sebep: string };

/** Kapanmış form — geri alma yok. */
const KAPALI: DenemeDurum[] = ["TAMAMLANDI", "IPTAL"];

/**
 * O adımın "bekleme" durumu: geri alındığında forma hangi duruma döneceği.
 *   sıra 1 → DEGERLENDIRICI1_BEKLIYOR
 *   sıra 2 → 2. değerlendirici müdür yrd. ise MUDUR_YRD_BEKLIYOR, müdürse MUDUR_BEKLIYOR
 * Rol, puanla ucunun hedef seçimiyle AYNI ölçüte bakar (degerlendirici2Rol).
 */
export function adimBeklemeDurumu(
  sira: 1 | 2,
  degerlendirici2Rol: DenemeDegerlendiriciRol | null,
): DenemeDurum {
  if (sira === 1) return "DEGERLENDIRICI1_BEKLIYOR";
  return degerlendirici2Rol === "MUDUR_YARDIMCISI" ? "MUDUR_YRD_BEKLIYOR" : "MUDUR_BEKLIYOR";
}

/**
 * Geri alınabilir mi? FAIL-CLOSED.
 *
 * Kurallar:
 *  1. Form kapalı (TAMAMLANDI/IPTAL) olamaz.
 *  2. O adım GERÇEKTEN gönderilmiş olmalı — `degerlendiriciNAt` damgası şart.
 *     Yalnız TASLAK puan varsa (damga yok) geri almaya gerek yoktur: değerlendirici
 *     zaten üzerine yazabiliyor. Damgayı ölçüt almak, "kaydet" ile "gönder"i
 *     ayıran mevcut davranışı korur.
 *  3. Tek puanlı yakada (gri/beyaz) 2. adım YOKTUR.
 *  4. SONRAKİ adım puanlanmışsa geri alma YOK — 1. puanı silmek, 2. değerlendiricinin
 *     zaten verdiği puanı dayanaksız bırakır ve `ortalama` anlamını yitirir.
 */
export function geriAlinabilirMi(sira: 1 | 2, form: GeriAlinacakForm): GeriAlmaKarar {
  if (KAPALI.includes(form.durum)) {
    return { ok: false, sebep: "Kapanmış ya da iptal edilmiş formda puan geri alınamaz." };
  }

  if (sira === 2 && !form.degerlendirici2Id) {
    return { ok: false, sebep: "Bu formda 2. değerlendirici adımı yok." };
  }

  const damga = sira === 1 ? form.degerlendirici1At : form.degerlendirici2At;
  if (!damga) {
    return { ok: false, sebep: `${sira}. değerlendirici puanını henüz göndermemiş — geri alınacak puan yok.` };
  }

  if (sira === 1) {
    const sonrakiPuanli = !!form.degerlendirici2At || form.puanSatirSayisi.sira2 > 0;
    if (sonrakiPuanli) {
      return {
        ok: false,
        sebep: "2. değerlendirici puan girmiş — önce onun puanı geri alınmalı, aksi hâlde ortalama dayanaksız kalır.",
      };
    }
  }

  return { ok: true, hedefDurum: adimBeklemeDurumu(sira, form.degerlendirici2Rol) };
}

/**
 * Geri alma sonrası ham toplamlar. Silinen sıra null olur, diğeri korunur.
 * `ortalama`/`basarili` bunlardan YENİDEN hesaplanır (denemeOrtalama ile).
 */
export function geriAlmaSonrasiPuanlar(
  sira: 1 | 2,
  mevcut: { puan1: number | null; puan2: number | null },
): { puan1: number | null; puan2: number | null } {
  return sira === 1 ? { puan1: null, puan2: mevcut.puan2 } : { puan1: mevcut.puan1, puan2: null };
}
