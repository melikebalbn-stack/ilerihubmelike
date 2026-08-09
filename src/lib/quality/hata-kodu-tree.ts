/**
 * Hata kodu ağacı yardımcıları (KAL-KYT-15 Bölüm 1).
 *
 * Ağaç tek tabloda self-relation ile tutulur; derinlik pratikte 2 (başlık → alt kod)
 * ama kod hiçbir yerde 2 seviye VARSAYMAZ — keyfi derinlik desteklenir.
 */
import { prisma } from '@/lib/prisma'

/** GET/POST/PATCH yanıtlarında kullanılan ortak alan seti. */
export const hataKoduSelect = {
  id: true,
  kod: true,
  ad: true,
  ustKodId: true,
  aktif: true,
  siraNo: true,
  aciklama: true,
  olusturmaTarihi: true,
  guncellemeTarihi: true,
} as const

export type HataKoduDuz = {
  id: string
  kod: number
  ad: string
  ustKodId: string | null
  aktif: boolean
  siraNo: number
  aciklama: string | null
  olusturmaTarihi: Date
  guncellemeTarihi: Date
}

export type HataKoduAgac = HataKoduDuz & { altlar: HataKoduAgac[] }

/**
 * Düz listeyi ağaca çevirir. Sıralama girdideki sırayı korur (çağıran siraNo/kod'a göre sıralar).
 *
 * ⚠ Filtre (örn. ?aktif=1) bir üst kaydı listeden düşürüp altını bırakabilir. Bu durumda
 *   alt kayıt SESSİZCE KAYBOLMAZ — kök seviyesine çıkarılır (ustKodId alanı korunur,
 *   böylece istemci yetim olduğunu görebilir).
 */
export function agacKur(rows: HataKoduDuz[]): HataKoduAgac[] {
  const nodes = new Map<string, HataKoduAgac>()
  for (const r of rows) nodes.set(r.id, { ...r, altlar: [] })

  const kokler: HataKoduAgac[] = []
  for (const r of rows) {
    const node = nodes.get(r.id)!
    const ust = r.ustKodId ? nodes.get(r.ustKodId) : undefined
    if (ust) ust.altlar.push(node)
    else kokler.push(node) // kök VEYA üstü filtrelenmiş yetim
  }
  return kokler
}

/**
 * `ustKodId`, `id`'nin kendi alt ağacında mı? (döngü kontrolü)
 *
 * Aday üstten köke doğru yürür; yolda `id` görülürse döngü oluşur.
 * Kendine bağlama (ustKodId === id) da bu yolla yakalanır.
 * Bozuk veriye karşı ziyaret edilen düğüm seti ile sonsuz döngü korumalı.
 */
export async function dongruOlusurMu(id: string, ustKodId: string): Promise<boolean> {
  const gorulen = new Set<string>()
  let mevcut: string | null = ustKodId

  while (mevcut) {
    if (mevcut === id) return true
    if (gorulen.has(mevcut)) return false // hâlihazırda bozuk döngü — bu güncelleme sebebi değil
    gorulen.add(mevcut)

    const ust: { ustKodId: string | null } | null = await prisma.hataKodu.findUnique({
      where: { id: mevcut },
      select: { ustKodId: true },
    })
    mevcut = ust?.ustKodId ?? null
  }
  return false
}
