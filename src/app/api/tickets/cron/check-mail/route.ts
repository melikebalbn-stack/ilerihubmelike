import { NextRequest, NextResponse } from 'next/server'
import { listeleGelenKutusu, klasorBulVeyaOlustur, tasi, GraphMailHatasi } from '@/lib/graph/mail'
import { GraphTokenHatasi } from '@/lib/graph/token'
import { tekMesajIsle, type IsleSonucu } from '@/lib/tickets/mail-isle'

export const dynamic = 'force-dynamic'

/**
 * IT Ticket — E-POSTA KANALI ALIMI (Faz 2).
 *
 * destek@ilerigroup.com gelen kutusunu tarar; her maili ya mevcut ticket'a
 * yorum olarak ekler, ya yeni ticket açar, ya yoksayar. İşlenen mail "İşlenmiş"
 * klasörüne taşınır.
 *
 * Auth: x-cron-secret (check-sla ile birebir aynı desen).
 * Kuru koşu: ?dryRun=1 → hiçbir şey YAZILMAZ, klasör OLUŞTURULMAZ, TAŞINMAZ.
 * Sınır: ?limit=N (varsayılan 25, azami 100).
 *
 * TEKİLLEŞTİRME iki katmanlı: EmailIngestLog.messageId @unique + taşıma.
 * Taşıma başarısız olsa bile ikinci tur maili yeniden işlemez — DB kaydı
 * yeter. Bu yüzden taşıma hatası sonucu HATA'ya ÇEVİRMEZ, yalnız raporlanır.
 *
 * KAPSAM DIŞI (bilinçli): bildirim gönderimi. Yeni ticket açılsa bile
 * dispatchTicketCreated çağrılmıyor — mevcut bildirim akışına dokunulmadı.
 */

const KUTU = 'destek@ilerigroup.com'
const ISLENMIS_KLASOR = 'İşlenmiş'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dryRun') === '1'
  const limitHam = parseInt(url.searchParams.get('limit') || '25', 10)
  const limit = Number.isFinite(limitHam) ? Math.max(1, Math.min(100, limitHam)) : 25
  const baslangic = new Date()

  let mesajlar
  try {
    mesajlar = await listeleGelenKutusu(KUTU, limit)
  } catch (err) {
    // Graph erişimi komple düşmüş: hata gövdesini SAKLAYARAK döndür. 403'ün
    // izin eksikliği mi politika engeli mi olduğu ancak mesajdan anlaşılıyor.
    const detay =
      err instanceof GraphMailHatasi || err instanceof GraphTokenHatasi
        ? { httpDurum: err.httpDurum, hamGovde: err.hamGovde }
        : {}
    console.error('[ticket-mail] gelen kutusu okunamadı:', err)
    return NextResponse.json(
      { ok: false, hata: err instanceof Error ? err.message : String(err), ...detay },
      { status: 502 },
    )
  }

  // Klasör YALNIZ gerçek koşuda ve taşınacak bir şey varsa hazırlanır.
  // dryRun hiçbir yazma yapmaz — klasör oluşturmak da yazmadır.
  let hedefKlasorId: string | null = null
  if (!dryRun && mesajlar.length > 0) {
    try {
      hedefKlasorId = (await klasorBulVeyaOlustur(KUTU, ISLENMIS_KLASOR)).id
    } catch (err) {
      console.error('[ticket-mail] "İşlenmiş" klasörü hazırlanamadı:', err)
      // Taşıma yapılamayacak ama işleme DEVAM eder: tekilleştirme DB'de.
    }
  }

  const sonuclar: IsleSonucu[] = []
  const tasimaHatalari: string[] = []

  for (const m of mesajlar) {
    const sonuc = await tekMesajIsle(m, dryRun, KUTU)
    sonuclar.push(sonuc)

    if (!dryRun && hedefKlasorId && sonuc.tasinabilir) {
      try {
        await tasi(KUTU, sonuc.graphId, hedefKlasorId)
      } catch (err) {
        // (f) Taşıma hatası sonucu HATA'ya çevirmez — DB kaydı zaten
        // tekilleştirmeyi sağlıyor, mail bir daha işlenmez.
        const msg = `${sonuc.messageId ?? sonuc.graphId}: ${err instanceof Error ? err.message : String(err)}`
        console.error('[ticket-mail] taşıma başarısız:', msg)
        tasimaHatalari.push(msg)
      }
    }
  }

  const say = (t: IsleSonucu['sonuc']) => sonuclar.filter((s) => s.sonuc === t).length

  return NextResponse.json({
    ok: true,
    dryRun,
    kutu: KUTU,
    limit,
    toplam: sonuclar.length,
    ticket_olusturuldu: say('ticket_olusturuldu'),
    yorum_eklendi: say('yorum_eklendi'),
    yoksayildi: say('yoksayildi'),
    hata: say('hata'),
    zaten_islenmis: say('zaten_islenmis'),
    ...(tasimaHatalari.length > 0 ? { tasimaHatalari } : {}),
    mesajlar: sonuclar.map((s) => ({
      messageId: s.messageId,
      gonderici: s.gonderici,
      konu: s.konu,
      sonuc: s.sonuc,
      sebep: s.sebep,
      ticketNumber: s.ticketNumber,
    })),
    checkedAt: baslangic.toISOString(),
  })
}
