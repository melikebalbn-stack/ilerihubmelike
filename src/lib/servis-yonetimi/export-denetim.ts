import { NextResponse } from 'next/server'
import { requireAllPermissions } from '@/lib/auth/require-permission'
import { logAuditEvent } from '@/lib/audit-log'

// Servis dışa aktarma (Excel/PDF) ORTAK kuralları (Paket B3).
//
// 1) YETKİ: servis.view VE servis.export — İKİSİ BİRDEN. requirePermission'a dizi vermek
//    OR'dur; dışa aktarma "görüntüleme"den ayrı ve daha hassas bir eksen: ekranı göremeyen
//    dosyasını da alamamalı, ekranı görüp export izni olmayan da indirememeli.
// 2) DENETİM FAIL-CLOSED: dosya verilmeden ÖNCE audit satırı yazılır; yazılamazsa dosya
//    VERİLMEZ (500). Taşınabilir kopya sistemden çıkıyor — izi olmayan çıkış olmaz.
// 3) KVKK: audit `details` içine yalnız dosya adı/tür, filtre ve SATIR SAYISI yazılır;
//    kişi adı/sicil/telefon yazılmaz.

export const SERVIS_EXPORT_YETKILERI = ['servis.view', 'servis.export']

export const AUDIT_ACTION_EXPORT = 'SERVIS_EXPORT'

export const exportYetkisiIste = () => requireAllPermissions(SERVIS_EXPORT_YETKILERI)

export type ExportDenetimi = {
  /** 'KAPASITE_EXCEL' | 'GUZERGAH_LISTESI_PDF' | ... — hangi rapor. */
  rapor: string
  format: 'XLSX' | 'PDF'
  satirSayisi: number
  /** Uygulanan filtreler (tarih, güzergâh vb.) — kişi verisi YOK. */
  filtre?: Record<string, string | number | boolean | null>
  /** "Kim, hangi güzergâh için" sorgusu için (@@index targetType+targetId). */
  hedefId?: string
}

/**
 * Export denetimini yazar. Başarısızsa çağıran 500 dönmeli (`exportDenetimiHatasi`).
 * @returns true = yazıldı, dosya verilebilir.
 */
export async function exportDenetimiYaz(actorId: string, d: ExportDenetimi): Promise<boolean> {
  const sonuc = await logAuditEvent({
    action: AUDIT_ACTION_EXPORT,
    actorId,
    targetType: 'SERVIS',
    targetId: d.hedefId ?? d.rapor,
    details: { rapor: d.rapor, format: d.format, satirSayisi: d.satirSayisi, filtre: d.filtre ?? {} },
  })
  return sonuc.ok
}

export const exportDenetimiHatasi = () =>
  NextResponse.json(
    { ok: false, message: 'Dışa aktarma denetim kaydı yazılamadığı için dosya verilmedi. Lütfen tekrar deneyin.' },
    { status: 500 },
  )
