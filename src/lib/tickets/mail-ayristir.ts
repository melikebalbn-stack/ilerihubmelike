/**
 * Gelen maili ticket alanlarına çeviren SAF katman.
 *
 * Prisma YOK, fetch YOK, Graph çağrısı YOK — girdi/çıktı, hepsi bu. Bu yüzden
 * doğrudan unit test edilebilir; iş mantığı (mail-isle.ts) burayı çağırır.
 */

import type { GraphBaslik, GraphMesaj } from '@/lib/graph/mail'

export const KONUSUZ_BASLIK = '(konusuz talep)'
export const EK_NOTU = '(Bu mailde ek var, ILERIHub\'a aktarilmadi)'

/** Otomatik/sistem gönderici önekleri — küçük harfe indirilmiş adresle karşılaştırılır. */
const SISTEM_ONEKLERI = ['postmaster@', 'mailer-daemon@', 'noreply@', 'no-reply@']

function basliklar(m: Pick<GraphMesaj, 'internetMessageHeaders'>): GraphBaslik[] {
  return m.internetMessageHeaders ?? []
}

/** Başlığı ada göre bulur (HTTP başlıkları büyük/küçük harf duyarsızdır). */
export function baslikDegeri(m: Pick<GraphMesaj, 'internetMessageHeaders'>, ad: string): string | null {
  const hedef = ad.toLowerCase()
  const bulunan = basliklar(m).find((h) => (h?.name ?? '').toLowerCase() === hedef)
  const deger = bulunan?.value?.trim()
  return deger ? deger : null
}

/** Gönderen adresi — küçük harfe indirilmiş, kırpılmış. Yoksa boş string. */
export function gondericiCoz(m: Pick<GraphMesaj, 'from'>): string {
  return (m.from?.emailAddress?.address ?? '').trim().toLowerCase()
}

/** Gönderenin görünen adı (varsa). */
export function gondericiAdi(m: Pick<GraphMesaj, 'from'>): string | null {
  const ad = m.from?.emailAddress?.name?.trim()
  return ad ? ad : null
}

/** Konu — boşsa sabit yer tutucu. */
export function konuCoz(m: Pick<GraphMesaj, 'subject'>): string {
  const konu = (m.subject ?? '').trim()
  return konu ? konu : KONUSUZ_BASLIK
}

/**
 * HTML gövdeyi düz metne çevirir.
 *
 * Repoda hazır bir HTML→metin yardımcısı YOK (email.ts'tekiler tersi yönde,
 * metni HTML'e KAÇIRAN escape fonksiyonları) ve yeni bağımlılık eklenmeyecek.
 * Bu yüzden dar kapsamlı bir temizlik: script/style tamamen atılır, blok
 * etiketleri satır sonuna çevrilir, kalan etiketler silinir, temel HTML
 * varlıkları çözülür.
 */
export function htmlToMetin(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Alıntılanan yanıt geçmişini kırpar.
 *
 * SAF ve ayrı: govdeCoz onu çağırır ama tek başına test edilebilir.
 * İlk ayraç bulunduğunda GERİSİ atılır — alıntı bloğu her zaman gövdenin
 * sonuna kadar sürer.
 *
 * ⚠ VERİ KAYBETMEME KURALI: kırpma sonrası gövde boş kalıyorsa kırpma
 * UYGULANMAZ, orijinal metin döner. Bazı istemciler kullanıcının yazdığını
 * alıntının ALTINA koyuyor; körü körüne kırpmak o mesajı yok ederdi.
 *
 * İMZA kırpma YAPILMIYOR: "-- " ayracı güvenilir değil ve Türkçe imzalarda
 * çoğu zaman hiç yok. Ayrı iş.
 */
export function alintiKirp(metin: string): string {
  const satirlar = metin.split('\n')

  /** Sonraki BOŞ OLMAYAN satırın indeksi (yoksa -1). */
  const sonrakiDolu = (i: number): number => {
    for (let j = i + 1; j < satirlar.length; j++) {
      if (satirlar[j].trim()) return j
    }
    return -1
  }

  const baslikSatiri = /^\s*(from|gönderen|gonderen)\s*:/i
  const izleyenBaslik = /^\s*(sent|gönderildi|gonderildi|to|kime|subject|konu)\s*:/i
  const orijinalMesaj = /^\s*-{2,}\s*(orijinal mesaj|original message)\s*-{2,}\s*$/i
  const altCizgiBlogu = /^_{10,}\s*$/
  const yazdiSatiri = /^\s*(on\b.*\bwrote\s*:|.*\btarihinde\b.*\byazd[ıi]\s*:)\s*$/i

  let kesim = -1
  for (let i = 0; i < satirlar.length; i++) {
    const satir = satirlar[i]

    if (orijinalMesaj.test(satir) || altCizgiBlogu.test(satir) || yazdiSatiri.test(satir)) {
      kesim = i
      break
    }

    // "From:"/"Gönderen:" TEK BAŞINA kesmez — normal bir cümlede de geçebilir.
    // Ardından "Sent:/Gönderildi:/To:/Kime:" gelmesi aranır.
    if (baslikSatiri.test(satir)) {
      const j = sonrakiDolu(i)
      if (j !== -1 && izleyenBaslik.test(satirlar[j])) {
        kesim = i
        break
      }
    }

    // Klasik alıntı: ARDIŞIK en az iki ">" satırı. Tek bir ">" satırı
    // (ör. bir ok işareti) yüzünden gövde kesilmesin.
    if (/^\s*>/.test(satir)) {
      const j = sonrakiDolu(i)
      if (j !== -1 && /^\s*>/.test(satirlar[j])) {
        kesim = i
        break
      }
    }
  }

  if (kesim === -1) return metin

  const kirpilmis = satirlar.slice(0, kesim).join('\n').trim()
  return kirpilmis ? kirpilmis : metin
}

/**
 * Gövde metni. contentType 'html' ise düz metne çevrilir, sonra alıntılanan
 * yanıt geçmişi kırpılır.
 * body boşsa bodyPreview'a düşülür (Graph bazı mesajlarda yalnız onu verir).
 */
export function govdeCoz(m: Pick<GraphMesaj, 'body' | 'bodyPreview'>): string {
  const ham = (m.body?.content ?? '').trim()
  if (!ham) return alintiKirp((m.bodyPreview ?? '').trim())
  const tip = (m.body?.contentType ?? '').toLowerCase()
  return alintiKirp(tip === 'html' ? htmlToMetin(ham) : ham)
}

export interface YoksaymaKarari {
  yoksay: boolean
  /** Yoksayılıyorsa sebep; değilse null. Log'a yazılır. */
  sebep: string | null
}

/**
 * Ticket açılmaması gereken mailler.
 *
 * Amaç otomatik yanıt/bounce döngüsünü kesmek: bir "ofis dışındayım" yanıtına
 * ticket açılırsa kuyruk çöple dolar.
 */
export function yoksayilmaliMi(m: GraphMesaj, izlenenKutu: string): YoksaymaKarari {
  // DÖNGÜ KORUMASI — yalnız `from`. Kutunun KENDİSİNDEN gelen mail işlenmez:
  // ILERIHub bu kutudan bildirim göndermeye başladığında kendi mailini geri
  // emmesin.
  //
  // ⚠ YALNIZ `from` bakılır. `toRecipients` ya da `replyTo` KONTROL EDİLMEZ:
  // kullanıcının destek@'e yazdığı NORMAL mailde `to` zaten destek@'tir;
  // onu yoksaymak kanalı tümüyle kapatırdı.
  const kutu = (izlenenKutu ?? '').trim().toLowerCase()
  if (kutu && gondericiCoz(m) === kutu) {
    return { yoksay: true, sebep: 'Kendi kutumuzdan gelen mail (döngü koruması)' }
  }

  const autoSubmitted = baslikDegeri(m, 'Auto-Submitted')
  if (autoSubmitted && autoSubmitted.toLowerCase() !== 'no') {
    return { yoksay: true, sebep: `Auto-Submitted: ${autoSubmitted}` }
  }

  const suppress = baslikDegeri(m, 'X-Auto-Response-Suppress')
  if (suppress) {
    return { yoksay: true, sebep: `X-Auto-Response-Suppress: ${suppress}` }
  }

  const gonderici = gondericiCoz(m)
  const onek = SISTEM_ONEKLERI.find((o) => gonderici.startsWith(o))
  if (onek) {
    return { yoksay: true, sebep: `Sistem göndericisi (${onek})` }
  }

  const konuBos = !(m.subject ?? '').trim()
  const govdeBos = !govdeCoz(m)
  if (konuBos && govdeBos) {
    return { yoksay: true, sebep: 'Konu ve gövde boş' }
  }

  return { yoksay: false, sebep: null }
}

/**
 * In-Reply-To ve References başlıklarındaki mesaj id'leri.
 *
 * References boşluk ayrılmış birden çok id taşır; In-Reply-To normalde tek id.
 * Açılı parantezler korunur — internetMessageId de Graph'ta "<...>" biçiminde
 * geliyor, eşleşmenin tutması için iki taraf da aynı biçimde olmalı.
 * Sıra: In-Reply-To önce (en yakın ata), sonra References tersten (yakından
 * uzağa) — ilk eşleşen en alakalı ticket olsun.
 */
export function yanitMi(m: Pick<GraphMesaj, 'internetMessageHeaders'>): string[] {
  const cikar = (deger: string | null): string[] =>
    (deger ?? '')
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith('<') && s.endsWith('>') && s.length > 2)

  const inReplyTo = cikar(baslikDegeri(m, 'In-Reply-To'))
  const references = cikar(baslikDegeri(m, 'References')).reverse()

  const gorulen = new Set<string>()
  return [...inReplyTo, ...references].filter((id) => {
    if (gorulen.has(id)) return false
    gorulen.add(id)
    return true
  })
}

/** Ticket açıklaması: gövde + (varsa) ek uyarısı. */
export function aciklamaCoz(m: GraphMesaj): string {
  const govde = govdeCoz(m)
  const taban = govde || '(Mail gövdesi boş)'
  return m.hasAttachments ? `${taban}\n\n${EK_NOTU}` : taban
}
