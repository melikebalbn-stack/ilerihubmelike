import { getTumStoklar } from '@/lib/envanter/tum-stoklar'
import { sendEmail } from '@/lib/email'

// Kritik stok bildirimi. GERÇEK ALICILAR HENÜZ YAPILANDIRILMADI:
// alıcı listesi + periyodik cron tetiklemesi ayrı bir kararla (Melih) bağlanacak.
// Liste BOŞ kaldığı sürece mail GÖNDERİLMEZ — sendEmail hiç çağrılmaz (kazara gönderim yok).
// Gerçek alıcılar tanımlandığında aşağıdaki gönderim yolu olduğu gibi devreye girer.
const ALICILAR: { email: string; name: string }[] = []

export async function kritikUrunBildirimGonder(): Promise<{
  gonderildi: boolean
  kritikSayisi: number
  aliciYapilandirilmadi: boolean
  mesaj: string
}> {
  // Alıcı yapılandırılmadıysa hiç gönderme (route 400 döner). Stok sorgusuna bile gerek yok.
  if (ALICILAR.length === 0) {
    return {
      gonderildi: false,
      kritikSayisi: 0,
      aliciYapilandirilmadi: true,
      mesaj: 'Bildirim alıcıları henüz tanımlanmamış',
    }
  }

  const stoklar = await getTumStoklar()
  const kritikler = stoklar.filter((s) => s.durum === 'KRITIK' || s.durum === 'MINIMUM')

  if (kritikler.length === 0) {
    return {
      gonderildi: false,
      kritikSayisi: 0,
      aliciYapilandirilmadi: false,
      mesaj: 'Kritik/minimum seviyede ürün yok. Mail gönderilmedi.',
    }
  }

  const satirlar = kritikler
    .map(
      (s) =>
        `- ${s.urunKodu} ${s.varyantAdi ? '(' + s.varyantAdi + ')' : ''} — Mevcut: ${s.mevcut}, Min: ${s.minStok ?? '-'}, Kritik: ${s.kritikStok ?? '-'} [${s.durum}]`,
    )
    .join('\n')

  const konu = `Kritik Stok Uyarısı — ${kritikler.length} ürün sipariş bekliyor`
  const govde = `Aşağıdaki ürünler kritik veya minimum stok seviyesinin altına düşmüştür. Sipariş açılması önerilir:\n\n${satirlar}\n\nBu bir otomatik envanter bildirimidir.`

  const htmlSatirlar = kritikler
    .map(
      (s) =>
        `<tr><td>${s.urunKodu}</td><td>${s.varyantAdi ?? '-'}</td><td style="text-align:right">${s.mevcut}</td><td style="text-align:right">${s.minStok ?? '-'}</td><td style="text-align:right">${s.kritikStok ?? '-'}</td><td>${s.durum}</td></tr>`,
    )
    .join('')
  const html = `<p>Aşağıdaki ürünler kritik/minimum stok seviyesinin altındadır. Sipariş açılması önerilir:</p>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
<thead><tr><th>Kod</th><th>Varyant</th><th>Mevcut</th><th>Min</th><th>Kritik</th><th>Durum</th></tr></thead>
<tbody>${htmlSatirlar}</tbody></table>
<p style="color:#888;font-size:12px">Bu bir otomatik envanter bildirimidir.</p>`

  const sonuc = await sendEmail(ALICILAR, konu, govde, html)

  return {
    gonderildi: sonuc.success,
    kritikSayisi: kritikler.length,
    aliciYapilandirilmadi: false,
    mesaj: sonuc.success
      ? `${kritikler.length} kritik ürün için bildirim gönderildi.`
      : `Bildirim hazırlandı ancak gönderim başarısız: ${sonuc.error ?? 'bilinmeyen'}.`,
  }
}
