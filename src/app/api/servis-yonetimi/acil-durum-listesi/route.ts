import { NextRequest, NextResponse } from 'next/server'
import { requireAllPermissions } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit-log'
import {
  acilDurumListesiGetir,
  AcilDurumListesiError,
  type AcilDurumListesiSonucu,
} from '@/lib/servis-yonetimi/acil-durum-listesi'

export const dynamic = 'force-dynamic'

// MASTER Madde 49 — Acil Durum Servis Listesi.
//
// YETKİ: servis.view VE servis.kvkk.view — İKİSİ BİRDEN (requireAllPermissions,
// AND mantığı). servis.export KULLANILMAZ: o "dışa aktarma" ekseni, buradaki
// kısıt "iletişim verisini görme". Normal servis ekranlarını görebilen
// (servis.view'lı) bir kullanıcı bu ekranı GÖREMEZ.
//
// KVKK ERİŞİM İZİ iki mekanizma birlikte (yenisi kurulmuyor — rule 6):
//   a) PersonnelAccessLog — listede dönen HER personel için satır
//      (/api/personnel/export'taki createMany deseni, accessType serbest metin).
//   b) logAuditEvent — "kim, ne zaman, hangi güzergâh/dilim için açtı" olayı;
//      (a)'nın kapsayamadığını tamamlar: dış firma şoförü Personnel olmadığı
//      için PersonnelAccessLog'a yazılamaz (FK).
//
// 🔴 LOG YAZIMI SONUCU BOZMAZ: acil bir ekranda log hatası yüzünden veri
// gösterememek kabul edilemez. İz yazımı yanıt üretildikten SONRA, hata
// yutularak yapılır — ama sessizce değil, sunucuya console.error düşer.
const ERISIM_TIPI = 'VIEW_ACIL_DURUM'

function erisilenPersonelIdleri(sonuc: AcilDurumListesiSonucu): string[] {
  const idler = new Set<string>()
  for (const y of sonuc.yolcular.kayitlar) idler.add(y.personnelId)
  for (const s of [...sonuc.sorumlu.ana.kayitlar, ...sonuc.sorumlu.yedek.kayitlar]) idler.add(s.personnelId)
  // Dahili şoför Personnel'dir; dış firma şoföründe personnelId null → atlanır.
  for (const s of [...sonuc.sofor.ana.kayitlar, ...sonuc.sofor.yedek.kayitlar]) {
    if (s.personnelId) idler.add(s.personnelId)
  }
  return [...idler]
}

async function erisimIziYaz(args: {
  actorId: string
  ipAddress: string | null
  guzergahId: string
  dilimId: string
  sonuc: AcilDurumListesiSonucu
}): Promise<void> {
  const personnelIdler = erisilenPersonelIdleri(args.sonuc)

  // (a) Kişi başı KVKK erişim izi.
  try {
    if (personnelIdler.length > 0) {
      await prisma.personnelAccessLog.createMany({
        data: personnelIdler.map(personnelId => ({
          personnelId,
          accessedBy: args.actorId,
          accessType: ERISIM_TIPI,
          ipAddress: args.ipAddress,
        })),
      })
    }
  } catch (err) {
    console.error('[acil-durum-listesi] PersonnelAccessLog yazılamadı:', err)
  }

  // (b) Erişim olayının kendisi. logAuditEvent hatayı kendi içinde yutar
  // ({ok:false} döner) — yine de çağrıyı sarmalıyoruz ki beklenmeyen bir
  // istisna yanıtı düşürmesin.
  try {
    await logAuditEvent({
      action: 'SERVIS_ACIL_DURUM_GORUNTULENDI',
      actorId: args.actorId,
      // Hedef = güzergâh: "X güzergâhının acil listesine kim baktı" sorgusu
      // @@index([targetType, targetId]) üzerinden doğrudan çalışsın ve gerçek
      // PERSONNEL olaylarını kirletmesin.
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

export async function GET(request: NextRequest) {
  const { userId, error } = await requireAllPermissions(['servis.view', 'servis.kvkk.view'])
  if (error) return error

  const guzergahId = request.nextUrl.searchParams.get('guzergahId')?.trim()
  const dilimId = request.nextUrl.searchParams.get('dilimId')?.trim()
  if (!guzergahId || !dilimId) {
    return NextResponse.json({ ok: false, message: 'guzergahId ve dilimId zorunludur.' }, { status: 400 })
  }

  try {
    const sonuc = await acilDurumListesiGetir({ guzergahId, dilimId })

    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
    await erisimIziYaz({ actorId: userId, ipAddress, guzergahId, dilimId, sonuc })

    return NextResponse.json({ ok: true, data: sonuc })
  } catch (err) {
    if (err instanceof AcilDurumListesiError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 404 })
    }
    console.error('Acil durum servis listesi alma hatası:', err)
    return NextResponse.json({ ok: false, message: 'Acil durum listesi alınırken hata oluştu.' }, { status: 500 })
  }
}
