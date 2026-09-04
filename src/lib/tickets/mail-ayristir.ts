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
 * İMZA + GİZLİLİK METNİ KIRPMA.
 *
 * alintiKirp yalnız ALINTILANAN YANIT GEÇMİŞİNİ atıyordu; ilk mailde imza ve
 * kurumsal disclaimer olduğu gibi açıklamaya giriyordu (ölçüm: TKT-2026-0043
 * açıklamasının ~%90'ı iki dilli gizlilik metniydi, gerçek içerik tek satır).
 *
 * KURAL: MUHAFAZAKÂR. Şüphede kesmez. Her aday kesim noktası için iki koşul:
 *   1) Desen yeterince ayırt edici olmalı (tek kelimelik selamlama YOK —
 *      "Teşekkürler" tek başına gövde olabilir, onu kesmek içeriği yok eder)
 *   2) Kesimden ÖNCE en az bir dolu satır kalmalı — aksi halde o aday atlanır
 * En ERKEN geçerli aday kullanılır; hiçbiri yoksa metin olduğu gibi döner.
 *
 * Kırpma sonrası boş kalırsa (beklenmedik durum) ORİJİNAL metin döner —
 * alintiKirp ile aynı emniyet.
 */
export function imzaKirp(metin: string, gondericiAd?: string | null): string {
  const satirlar = metin.split('\n')

  const sonrakiDolu = (i: number): number => {
    for (let j = i + 1; j < satirlar.length; j++) {
      if (satirlar[j].trim()) return j
    }
    return -1
  }

  // RFC 3676 imza ayracı: TEK BAŞINA "--" veya "-- ".
  const imzaAyraci = /^\s*--\s*$/
  // Kapanış kalıpları — YALNIZ tek başına satırda ve yalnız ayırt edici
  // olanlar. "Teşekkürler" BİLEREK yok: gövdenin tamamı o olabilir.
  const kapanis =
    /^\s*(sayg[ıi]lar[ıi]mla|iyi çal[ıi]şmalar|iyi calismalar|best regards|kind regards|warm regards|sincerely|yours (sincerely|faithfully))\s*[,.!]?\s*$/i
  // Kurumsal gizlilik metinleri (TR + EN) — çok ayırt edici, güvenle kesilir.
  const disclaimer =
    /(bu e-?posta\s*\(ve ekleri\)|bu e-?posta(n[ıi]n)?.{0,40}gizli bilgi|the contents of this e-?mail|this e-?mail (message )?(and any attachments )?(is|are) (intended|confidential))/i
  // Şirket künye satırı (bu kurulumda tüm imzalarda var).
  const sirketSatiri = /^\s*[İI]LER[İI][\s,.]*(A\.?\s*Ş\.?|GROUP)\s*$/i

  /** İletişim satırı: telefon, tek başına e-posta veya tek başına URL. */
  const iletisimSatiri = (satir: string): boolean => {
    const t = satir.trim()
    if (!t) return false
    if (/^([GDTFMEPgdtfmep]|tel|gsm|cep|phone|mobile|fax|faks)?\s*[:.]?\s*\+?\d[\d\s().\-/]{7,}$/.test(t)) return true
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return true
    if (/^(https?:\/\/|www\.)\S+$/i.test(t)) return true
    return false
  }

  const ad = (gondericiAd ?? '').trim().toLowerCase()

  let kesim = -1
  for (let i = 0; i < satirlar.length; i++) {
    const satir = satirlar[i]
    const t = satir.trim()
    if (!t) continue

    // Kesimden önce dolu satır kalmıyorsa bu aday geçersiz (gövdeyi yok eder).
    let oncesiDolu = false
    for (let k = 0; k < i; k++) if (satirlar[k].trim()) { oncesiDolu = true; break }
    if (!oncesiDolu) continue

    if (imzaAyraci.test(satir) || kapanis.test(satir) || disclaimer.test(t) || sirketSatiri.test(satir)) {
      kesim = i
      break
    }

    // İletişim BLOĞU: tek telefon satırı kesmez (gövdede numara verilmiş
    // olabilir), ARDIŞIK iki iletişim satırı imza sayılır.
    if (iletisimSatiri(satir)) {
      const j = sonrakiDolu(i)
      if (j !== -1 && iletisimSatiri(satirlar[j])) {
        kesim = i
        break
      }
    }

    // Gönderenin KENDİ adı tek başına bir satırda: imzanın başlangıcı.
    // İlk dolu satır olamaz (yukarıdaki oncesiDolu kontrolü onu eliyor).
    if (ad && t.toLowerCase() === ad) {
      kesim = i
      break
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
  // İmza/disclaimer kırpma BURADA, govdeCoz'da DEĞİL: govdeCoz'un çıktısı
  // yoksayilmaliMi'nin "gövde boş mu" kararında da kullanılıyor; oraya
  // koysaydık yalnızca imzadan oluşan bir mail sessizce yoksayılır hâle
  // gelirdi. Bu fonksiyon ise yalnız KAYDEDİLEN metni üretiyor (yeni talebin
  // açıklaması ve yanıt yorumunun gövdesi).
  const govde = imzaKirp(govdeCoz(m), gondericiAdi(m))
  const taban = govde || '(Mail gövdesi boş)'
  return m.hasAttachments ? `${taban}\n\n${EK_NOTU}` : taban
}
