/**
 * MAS duruş aynası — SAF planlayıcı (DB/MAS erişimi yok, birim test edilebilir).
 *
 * Eşleşme anahtarı MAS ProductionDowntime.Id = IproMachineDowntime.masId. MAS satırı başına tek IPRO kaydı:
 *  - MAS'ta duruş dizisi (UD → Kalıp bağlama → UD) üç ayrı kayıt olur; ara duruşlar kaybolmaz.
 *  - Bitiş MAS EndDateTime'dır; ayna-koşu anı ('simdi') ile kapatılmaz.
 *  - Aynı MAS satırında sebep/bitiş değişirse IPRO kaydı güncellenir.
 *  - Süresi 0 (veya negatif) kapalı duruşlar yazılmaz (ör. takvimden anlık kapanan çay molası).
 *  - masId'siz eski (legacy) IPRO kayıtları tezgah + başlangıç (±1 dk) ile MAS satırına bağlanır.
 */

export interface MasDurusGirdi {
  id: number
  tezgahKod: string | null
  baslangic: Date | null
  bitis: Date | null
  sebepKod: string | null
  sebepAd: string | null
}

export interface IproDurusGirdi {
  id: string
  masId: number | null
  tezgahId: string
  baslangic: Date
  bitis: Date | null
  durusSebebiId: string | null
}

export interface DurusVeri {
  tezgahId: string
  baslangic: Date
  bitis: Date | null
  durusSebebiId: string | null
  yorum: string | null
}

export interface DurusAynaPlani {
  olustur: (DurusVeri & { masId: number })[]
  guncelle: { id: string; masId: number | null; data: Partial<DurusVeri> & { masId?: number } }[]
  /** masId'li IPRO kaydı, MAS'ta artık yok (silinmiş/pasif) → sıfır süreye çekilir. */
  masSilinmis: { id: string; baslangic: Date }[]
  /** masId'siz, MAS'la eşleşmeyen AÇIK eski kayıt → çağıran kapatır (tek geçiş dönemi yolu). */
  eskiAcikEslesmeyen: { id: string; tezgahId: string }[]
  atlanan: { sebep: 'tezgah_yok' | 'baslangic_yok' | 'sifir_sure'; masId: number; detay: string }[]
  eslesmeyenSebepler: string[]
}

const TOLERANS_MS = 60_000

function ayniZaman(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) return a === b
  return a.getTime() === b.getTime()
}

export function durusAynaPlani(girdi: {
  mas: MasDurusGirdi[]
  /** MAS'ta bulunamayan masId'ler (duruslarByIds boş döndü) → silinmiş sayılır. */
  masBulunamayan?: number[]
  ipro: IproDurusGirdi[]
  tezgahByKod: Map<string, string>
  sebepByKod: Map<string, string>
}): DurusAynaPlani {
  const plan: DurusAynaPlani = { olustur: [], guncelle: [], masSilinmis: [], eskiAcikEslesmeyen: [], atlanan: [], eslesmeyenSebepler: [] }

  const iproByMasId = new Map<number, IproDurusGirdi>()
  const eskiler: IproDurusGirdi[] = []
  for (const r of girdi.ipro) {
    if (r.masId != null) iproByMasId.set(r.masId, r)
    else eskiler.push(r)
  }
  const eskiKullanildi = new Set<string>()

  const masSirali = [...girdi.mas].sort((a, b) => (a.baslangic?.getTime() ?? 0) - (b.baslangic?.getTime() ?? 0))
  for (const m of masSirali) {
    const tezgahId = m.tezgahKod ? girdi.tezgahByKod.get(m.tezgahKod) : undefined
    if (!tezgahId) {
      plan.atlanan.push({ sebep: 'tezgah_yok', masId: m.id, detay: m.tezgahKod ?? '—' })
      continue
    }
    if (!m.baslangic) {
      plan.atlanan.push({ sebep: 'baslangic_yok', masId: m.id, detay: m.tezgahKod ?? '—' })
      continue
    }
    const sifirSure = m.bitis !== null && m.bitis.getTime() <= m.baslangic.getTime()

    const sebepId = m.sebepKod ? girdi.sebepByKod.get(m.sebepKod) ?? null : null
    const sebepEtiket = `${m.sebepKod ?? '?'} - ${m.sebepAd ?? ''}`.trim()
    if (!sebepId && m.sebepKod && !plan.eslesmeyenSebepler.includes(sebepEtiket)) plan.eslesmeyenSebepler.push(sebepEtiket)
    const hedef: DurusVeri = {
      tezgahId,
      baslangic: m.baslangic,
      bitis: m.bitis,
      durusSebebiId: sebepId,
      yorum: sebepId ? null : `MAS: ${sebepEtiket}`,
    }

    let mevcut = iproByMasId.get(m.id)
    let baglanacak = false
    if (!mevcut) {
      mevcut = eskiler.find(
        (e) => !eskiKullanildi.has(e.id) && e.tezgahId === tezgahId && Math.abs(e.baslangic.getTime() - m.baslangic!.getTime()) <= TOLERANS_MS,
      )
      if (mevcut) {
        eskiKullanildi.add(mevcut.id)
        baglanacak = true
      }
    }

    if (!mevcut) {
      if (sifirSure) {
        plan.atlanan.push({ sebep: 'sifir_sure', masId: m.id, detay: `${m.tezgahKod} ${sebepEtiket}` })
        continue
      }
      plan.olustur.push({ ...hedef, masId: m.id })
      continue
    }

    // Mevcut kayıt: farkları güncelle (sıfır süreye düşmüşse bitiş=başlangıç ile etkisizleşir).
    const data: Partial<DurusVeri> & { masId?: number } = {}
    if (baglanacak) data.masId = m.id
    if (!ayniZaman(mevcut.baslangic, hedef.baslangic)) data.baslangic = hedef.baslangic
    if (!ayniZaman(mevcut.bitis, hedef.bitis)) data.bitis = hedef.bitis
    if (mevcut.durusSebebiId !== hedef.durusSebebiId) {
      data.durusSebebiId = hedef.durusSebebiId
      data.yorum = hedef.yorum
    }
    if (Object.keys(data).length) plan.guncelle.push({ id: mevcut.id, masId: mevcut.masId, data })
  }

  for (const masId of girdi.masBulunamayan ?? []) {
    const r = iproByMasId.get(masId)
    if (r && !(r.bitis && r.bitis.getTime() === r.baslangic.getTime())) plan.masSilinmis.push({ id: r.id, baslangic: r.baslangic })
  }

  for (const e of eskiler) {
    if (!eskiKullanildi.has(e.id) && e.bitis === null) plan.eskiAcikEslesmeyen.push({ id: e.id, tezgahId: e.tezgahId })
  }

  // Kapatmalar (bitiş dolan) önce, sonra oluşturmalar başlangıç sırasıyla: tezgah başına tek AÇIK duruş
  // (partial unique) kısıtı, önceki açık kaydın kapanmasından sonra yenisinin açılmasını gerektirir.
  plan.guncelle.sort((a, b) => Number(b.data.bitis != null) - Number(a.data.bitis != null))
  plan.olustur.sort((a, b) => a.baslangic.getTime() - b.baslangic.getTime())
  return plan
}
