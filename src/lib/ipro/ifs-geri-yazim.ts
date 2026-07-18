import { prisma } from '@/lib/prisma'
import { getIfsConfig } from '@/lib/ifs/config'
import { reportQuantityComplete } from '@/lib/ifs/shop-floor'

/**
 * Bir IproProductionLog kaydının qtyComplete'ini IFS'e yazar (ReportQuantityComplete).
 * SADECE complete — scrap (hurda) bu fonksiyonda YAZILMAZ (ifsScrapYazildi'ya dokunulmaz;
 * hurda IPRO'da bekliyor kararı).
 *
 * İdempotent: ifsCompleteYazildi=true ise tekrar yazmaz (çift sayım yok).
 * Hem "başla/bitir" anında hibrit deneme hem cron toparlama için ortak.
 *
 * OperationId GÖNDERİLMEZ — OrderNo+OperationNo+'*'+'*' kombosu kanıtlandı.
 * closeOperation HER ZAMAN false — aynı operasyona paralel operatör olabilir.
 */
export async function birKaydiIfseYaz(logId: string): Promise<{
  ok: boolean
  completeYazildi: boolean
  hata: string | null
}> {
  const log = await prisma.iproProductionLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      personnelId: true,
      ifsOrderNo: true,
      ifsOperationNo: true,
      qtyComplete: true,
      qtyScrap: true,
      ifsCompleteYazildi: true,
    },
  })
  if (!log) return { ok: false, completeYazildi: false, hata: 'Kayıt bulunamadı' }

  // İdempotent: zaten yazılmış.
  if (log.ifsCompleteYazildi) return { ok: true, completeYazildi: true, hata: null }

  // Yazılacak iyi yok → complete'i tamam say (yazma yapmadan işaretle).
  if (log.qtyComplete <= 0) {
    await prisma.iproProductionLog.update({
      where: { id: logId },
      data: { ifsCompleteYazildi: true, ifsCompleteHata: null },
    })
    return { ok: true, completeYazildi: true, hata: null }
  }

  // EmployeeId çöz (Personnel.sicilNo = IFS EmployeeId).
  const personnel = await prisma.personnel.findUnique({
    where: { id: log.personnelId },
    select: { sicilNo: true },
  })
  const sicilNo = personnel?.sicilNo
  if (!sicilNo) {
    await prisma.iproProductionLog.update({
      where: { id: logId },
      data: { ifsCompleteYazildi: false, ifsCompleteHata: 'Sicil no yok (IFS EmployeeId çözülemedi)' },
    })
    return { ok: false, completeYazildi: false, hata: 'Sicil yok' }
  }

  // İş emri/operasyon garanti (açık iş olmadan olmaz ama yine de kontrol).
  if (!log.ifsOrderNo || log.ifsOperationNo == null) {
    return { ok: false, completeYazildi: false, hata: 'IFS iş emri/operasyon eksik' }
  }

  const { company } = getIfsConfig()
  try {
    await reportQuantityComplete({
      operation: {
        OrderNo: log.ifsOrderNo,
        OperationNo: log.ifsOperationNo,
        ReleaseNo: '*',
        SequenceNo: '*',
      }, // OperationId YOK — kanıtlandı
      qtyComplete: log.qtyComplete,
      closeOperation: false, // HER ZAMAN false (paralel operatör)
      employee: { Company: company, EmployeeId: sicilNo },
    })
    await prisma.iproProductionLog.update({
      where: { id: logId },
      data: { ifsCompleteYazildi: true, ifsCompleteHata: null },
    })
    return { ok: true, completeYazildi: true, hata: null }
  } catch (e) {
    const msg = (e as Error)?.message ?? 'IFS yazım hatası'
    await prisma.iproProductionLog.update({
      where: { id: logId },
      data: { ifsCompleteYazildi: false, ifsCompleteHata: msg.slice(0, 500) },
    })
    return { ok: false, completeYazildi: false, hata: msg }
  }
}
