// MASTER Madde 49 — KVKK erişim izi. Ekran (GET) ve PDF (export-pdf) uçları
// AYNI mantığı kullanır; ikinci kez yazılmasın diye burada (rule 6).
// Next.js route dosyası olarak algılanmasın diye alt çizgiyle başlıyor.
//
// İki mekanizma birlikte, yenisi kurulmadan:
//   a) PersonnelAccessLog — listede dönen HER personel için satır
//      (/api/personnel/export'taki createMany deseni; accessType serbest metin).
//   b) logAuditEvent — erişim olayının kendisi; (a)'nın kapsayamadığını
//      tamamlar: dış firma şoförü Personnel olmadığı için oraya yazılamaz.
//
// 🔴 LOG YAZIMI SONUCU BOZMAZ: acil bir ekranda log hatası yüzünden veri
// gösterememek kabul edilemez. Hatalar yutulur ama console.error ile görünür.
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit-log'
import type { AcilDurumListesiSonucu } from '@/lib/servis-yonetimi/acil-durum-listesi'

/** Ekranda görüntüleme. */
export const ERISIM_TIPI_GORUNTULEME = 'VIEW_ACIL_DURUM'
/** PDF indirme — taşınabilir kopya sistemden ÇIKTIĞI için ayrı tip
 *  (personel modülündeki VIEW_HEALTH / EXPORT_SENSITIVE ayrımıyla aynı mantık). */
export const ERISIM_TIPI_PDF = 'EXPORT_ACIL_DURUM'

export const AUDIT_ACTION_GORUNTULEME = 'SERVIS_ACIL_DURUM_GORUNTULENDI'
export const AUDIT_ACTION_PDF = 'SERVIS_ACIL_DURUM_PDF_INDIRILDI'

export function erisilenPersonelIdleri(sonuc: AcilDurumListesiSonucu): string[] {
  const idler = new Set<string>()
  for (const y of sonuc.yolcular.kayitlar) idler.add(y.personnelId)
  for (const s of [...sonuc.sorumlu.ana.kayitlar, ...sonuc.sorumlu.yedek.kayitlar]) idler.add(s.personnelId)
  // Dahili şoför Personnel'dir; dış firma şoföründe personnelId null → atlanır.
  for (const s of [...sonuc.sofor.ana.kayitlar, ...sonuc.sofor.yedek.kayitlar]) {
    if (s.personnelId) idler.add(s.personnelId)
  }
  return [...idler]
}

export async function acilDurumErisimIziYaz(args: {
  actorId: string
  ipAddress: string | null
  guzergahId: string
  dilimId: string
  sonuc: AcilDurumListesiSonucu
  erisimTipi: string
  auditAction: string
}): Promise<void> {
  const personnelIdler = erisilenPersonelIdleri(args.sonuc)

  try {
    if (personnelIdler.length > 0) {
      await prisma.personnelAccessLog.createMany({
        data: personnelIdler.map(personnelId => ({
          personnelId,
          accessedBy: args.actorId,
          accessType: args.erisimTipi,
          ipAddress: args.ipAddress,
        })),
      })
    }
  } catch (err) {
    console.error('[acil-durum-listesi] PersonnelAccessLog yazılamadı:', err)
  }

  try {
    await logAuditEvent({
      action: args.auditAction,
      actorId: args.actorId,
      // Hedef = güzergâh: "X güzergâhının acil listesine kim baktı" sorgusu
      // @@index([targetType, targetId]) üzerinden çalışsın, gerçek PERSONNEL
      // olaylarını kirletmesin.
      targetType: 'SERVIS',
      targetId: args.guzergahId,
      details: {
        guzergahId: args.guzergahId,
        guzergahKod: args.sonuc.guzergah.kod,
        dilimId: args.dilimId,
        dilimKod: args.sonuc.dilim.kod,
        // KVKK: sayı yazılır, kişisel veri YAZILMAZ.
        erisilenPersonelSayisi: personnelIdler.length,
        yolcuSayisi: args.sonuc.yolcular.kayitlar.length,
      },
    })
  } catch (err) {
    console.error('[acil-durum-listesi] denetim olayı yazılamadı:', err)
  }
}

export function istekIpAdresi(headers: Headers): string | null {
  return headers.get('x-forwarded-for') || headers.get('x-real-ip') || null
}
