import 'server-only'
import { prisma } from '@/lib/prisma'
import { anomaliBul, VARSAYILAN_ANOMALI_AYAR, type Anomali, type GecisNokta } from './anomali'
import { yerel } from './puantaj-motor'

/**
 * PDKS Adım 7 — anomali taraması (DB). Tarih aralığındaki geçerli geçişleri kişi başına toplar ve
 * saf çekirdek anomaliBul'u uygular. hizEsikSn ayardan (pdks_anomali_hiz_esik_sn, vars. 60).
 */
export interface AnomaliSatir {
  tur: Anomali['tur']
  personnelId: string
  adSoyad: string
  sicil: string | null
  bolum: string | null
  zaman: string
  detay: string
}

export async function anomaliTara(bas: string, bit: string): Promise<{ bas: string; bit: string; satirlar: AnomaliSatir[] }> {
  const ayarKayit = await prisma.systemSetting.findUnique({ where: { key: 'pdks_anomali_hiz_esik_sn' }, select: { value: true } })
  const hizEsikSn = Number(ayarKayit?.value) > 0 ? Number(ayarKayit!.value) : VARSAYILAN_ANOMALI_AYAR.hizEsikSn

  const gecisler = await prisma.pdksGecis.findMany({
    where: {
      olayTipi: 'GECERLI_KART',
      personnelId: { not: null },
      yon: { not: null },
      olayZamani: { gte: yerel(bas, '00:00'), lt: yerel(bit, '00:00', 1) },
    },
    orderBy: { olayZamani: 'asc' },
    select: { id: true, personnelId: true, yon: true, kapiNo: true, cihazId: true, olayZamani: true },
  })

  const byPid = new Map<string, GecisNokta[]>()
  for (const x of gecisler) {
    const arr = byPid.get(x.personnelId!) ?? []
    arr.push({ id: x.id, zaman: x.olayZamani, yon: x.yon as 'GIRIS' | 'CIKIS', kapiNo: x.kapiNo, cihazId: x.cihazId })
    byPid.set(x.personnelId!, arr)
  }

  const anomaliler: Anomali[] = []
  for (const [pid, arr] of byPid) anomaliler.push(...anomaliBul(pid, arr, { hizEsikSn }))

  const ids = [...new Set(anomaliler.map((a) => a.personnelId))]
  const pers = ids.length
    ? await prisma.personnel.findMany({ where: { id: { in: ids } }, select: { id: true, adSoyad: true, sicilNo: true, department: { select: { name: true } } } })
    : []
  const persById = new Map(pers.map((p) => [p.id, p]))

  const satirlar: AnomaliSatir[] = anomaliler
    .map((a) => {
      const p = persById.get(a.personnelId)
      return {
        tur: a.tur,
        personnelId: a.personnelId,
        adSoyad: p?.adSoyad ?? a.personnelId,
        sicil: p?.sicilNo ?? null,
        bolum: p?.department?.name ?? null,
        zaman: a.zaman.toISOString(),
        detay: a.detay,
      }
    })
    .sort((a, b) => b.zaman.localeCompare(a.zaman))

  return { bas, bit, satirlar }
}
