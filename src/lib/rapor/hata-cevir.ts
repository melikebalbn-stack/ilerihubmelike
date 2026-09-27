/**
 * Rapor modülü ham hata metinlerini kullanıcıya anlaşılır Türkçeye çevirir. SAF fonksiyon:
 * DOM/Prisma/fetch/log yok — sunucu yanıtı ve istemci ekranı aynı çeviriyi kullanır.
 *
 * Kural: ham metin KAYBOLMAZ, teknikDetay'da tamamı durur (destek/log için); ekranda
 * başlık + açıklama + çözüm önde, ham metin "Ayrıntı" ile açılır.
 *
 * NOT: IFS YAZMA hataları için lib/ifs/ifs-hata.ts (dostaneIfsHata) ORA koduna bakar; burası
 * OKUMA yolu (OData sorgusu, $metadata, katalog) + Postgres + Claude + Hub uçları içindir.
 */

export type HataAgirlik = 'hata' | 'uyari'

export interface CevrilmisHata {
  baslik: string
  aciklama: string
  /** Kullanıcının/yöneticinin atacağı somut adım. */
  cozum?: string
  /** Ham metnin tamamı — "Ayrıntı" altında gösterilir. */
  teknikDetay: string
  /** 'hata' = çalışmıyor (kırmızı), 'uyari' = dikkat/düzeltilebilir (sarı). */
  agirlik: HataAgirlik
}

export interface HataBaglami {
  /** IFS projeksiyonu (ShopOrderHandling) ya da Hub kaynak adı. */
  kaynakAd?: string
  entity?: string
  entitySet?: string
  alan?: string
  /** Veri setindeki kaynak takma adı (hata hangi kaynakta çıktı). */
  takmaAd?: string
  /**
   * Hatanın geldiği katman. Verilmezse metindeki izlerden bulunur; belirsiz metinlerde
   * (ör. çıplak "fetch failed") doğru katmanı seçmek için çağıran verir.
   */
  kaynakTipi?: 'ifs' | 'postgres' | 'ai' | 'hub'
}

const MAX_DETAY = 4000

/** Ham metinden ilk cümle (bilinmeyen hatanın açıklaması). */
function ilkCumle(ham: string): string {
  const d = ham.replace(/\s+/g, ' ').trim()
  const nokta = d.search(/[.!?](\s|$)/)
  const c = nokta > 0 ? d.slice(0, nokta + 1) : d
  return c.length > 240 ? `${c.slice(0, 237)}…` : c
}

/** "IFS 403 ShopOrderHandling.svc/ShopOrds?$select=…: Insufficient privileges." → parçalar. */
function ifsAyristir(ham: string): { durum: number; yol: string; detay: string } | null {
  const m = /IFS\s+(\d{3})\s+([^:]+):\s*([\s\S]*)/.exec(ham)
  if (!m) return null
  return { durum: Number(m[1]), yol: m[2].trim(), detay: m[3].trim() }
}

/** Yoldan projeksiyon/entitySet çıkar: "ShopOrderHandling.svc/ShopOrds?$select=…". */
function yoldanKaynak(yol: string): { projeksiyon?: string; entitySet?: string } {
  const m = /([A-Za-z0-9_]+)\.svc\/?([A-Za-z0-9_]*)/.exec(yol)
  return m ? { projeksiyon: m[1], entitySet: m[2] || undefined } : {}
}

/** Tekil/çoğul ikizi: ShopOrderHandling ↔ ShopOrdersHandling (IFS'te ikisi de var, farklı setler). */
function ikizProjeksiyon(ad: string): string | null {
  if (/([A-Za-z]+?)sHandling$/.test(ad)) return ad.replace(/sHandling$/, 'Handling')
  if (/Handling$/.test(ad)) return ad.replace(/Handling$/, 'sHandling')
  return null
}

/** Mesajdaki tırnaklı/serbest alan adını yakala (EXPRESSION_PROPERTY_NOT_IN_TYPE için). */
function mesajdakiAlan(detay: string): string | undefined {
  return (
    /property\s+'?"?([A-Za-z0-9_]+)"?'?\s+(?:is\s+)?not\s+(?:found|defined|in)/i.exec(detay)?.[1] ??
    /'([A-Za-z0-9_]+)'\s*(?:alanı|property)/i.exec(detay)?.[1] ??
    /PROPERTY[_ ]?NOT[_ ]?IN[_ ]?TYPE[^A-Za-z0-9]+([A-Za-z0-9_]+)/i.exec(detay)?.[1]
  )
}

// ── IFS / OData ──────────────────────────────────────────────────────────

function ifsCevir(ham: string, b: HataBaglami): CevrilmisHata | null {
  const p = ifsAyristir(ham)
  // "IFS n yol: detay" kalıbı yoksa da metin IFS'i işaret edebilir (token/sertifika).
  const detay = p?.detay ?? ham
  const yolBilgi = p ? yoldanKaynak(p.yol) : {}
  const projeksiyon = b.kaynakAd ?? yolBilgi.projeksiyon
  const entitySet = b.entitySet ?? yolBilgi.entitySet
  const nerede = b.takmaAd ? ` (veri setindeki '${b.takmaAd}' kaynağı)` : ''
  const temel = { teknikDetay: ham.slice(0, MAX_DETAY), agirlik: 'hata' as const }

  // Sertifika — token alınamadan da patlayabilir.
  if (/UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT|CERT_HAS_EXPIRED|DEPTH_ZERO_SELF_SIGNED/i.test(ham)) {
    return {
      ...temel,
      baslik: 'IFS sertifikası doğrulanamadı',
      aciklama: 'Sunucu, IFS adresinin sertifika zincirini doğrulayamadı; bağlantı güvenlik nedeniyle kesildi.',
      cozum: 'Yönetici: kurum kök sertifikası sunucuya tanıtılmalı (NODE_EXTRA_CA_CERTS ortam değişkeni, ör. public/hub-ilerigroup.crt). Sertifika doğrulamasını KAPATMAK çözüm değildir.',
    }
  }
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|socket hang up|fetch failed|network|zaman aşımı|timed? ?out/i.test(ham) && !p) {
    return {
      ...temel,
      baslik: "IFS'e ulaşılamadı",
      aciklama: 'IFS sunucusuna bağlanılamadı ya da bağlantı zaman aşımına uğradı.',
      cozum: 'Ağ/VPN bağlantısını ve IFS adresinin (IFS_BASE_URL) erişilebilirliğini kontrol edin; IFS bakımda olabilir. Birkaç dakika sonra tekrar deneyin.',
    }
  }
  if (/IFS token alınamadı|access_token yok|IFS env eksik/i.test(ham)) {
    return {
      ...temel,
      baslik: 'IFS oturumu alınamadı',
      aciklama: 'IFS kimlik doğrulaması başarısız: erişim jetonu (token) alınamadı.',
      cozum: 'Yönetici: IFS_CLIENT_ID / IFS_CLIENT_SECRET / IFS_USER bilgilerini ve servis kullanıcısının kilitli olup olmadığını kontrol edin.',
    }
  }
  if (!p) return null

  switch (p.durum) {
    case 401:
      return {
        ...temel,
        baslik: 'IFS oturumu geçersiz',
        aciklama: 'IFS isteği kimlik doğrulamadan geçemedi (401).',
        cozum: 'Yönetici: IFS servis kullanıcısının parolası/jetonu yenilenmeli. Sorun sürerse IFS tarafında hesabın kilitli olmadığını doğrulayın.',
      }
    case 403:
      return {
        ...temel,
        baslik: 'Bu IFS verisine okuma yetkisi yok',
        aciklama: `IFS, ${projeksiyon ?? 'bu projeksiyon'} üzerinden veri okumayı reddetti (403)${nerede}. Metadata (alan listesi) okunabiliyor ama veri okunamıyor — bu bir yetki (grant) eksiğidir, veri seti tanımı hatalı değildir.`,
        cozum: `${projeksiyon ?? 'İlgili projeksiyon'} için okuma yetkisi gerekiyor. IFS yöneticisinden (Egeria) bu projeksiyona${entitySet ? ` / ${entitySet} setine` : ''} erişim isteyin.`,
      }
    case 404:
      if (/MI_METADATA_NOTFOUND|metadata.*not.*found/i.test(p.detay) || /\$metadata/i.test(p.yol)) {
        const ikiz = projeksiyon ? ikizProjeksiyon(projeksiyon) : null
        return {
          ...temel,
          baslik: 'IFS projeksiyonu bulunamadı',
          aciklama: `${projeksiyon ?? 'Projeksiyon'} adında bir IFS projeksiyonu yok (veya bu ortamda yayınlanmamış).`,
          cozum: `Ad yazımını kontrol edin — IFS'te tekil/çoğul ikizler vardır${ikiz ? `: '${projeksiyon}' yerine '${ikiz}' olabilir` : ' (ör. ShopOrderHandling ↔ ShopOrdersHandling)'}. Doğru adı katalog ekranındaki projeksiyon listesinden seçin.`,
        }
      }
      return {
        ...temel,
        baslik: 'IFS kaydı/adresi bulunamadı',
        aciklama: `IFS istenen adresi bulamadı (404): ${p.yol.slice(0, 160)}`,
        cozum: entitySet
          ? `'${entitySet}' set adının bu projeksiyonda geçerli olduğunu katalogdan doğrulayın (EntitySet adları $metadata'dan gelir).`
          : 'Projeksiyon ve set adlarını katalogdan doğrulayın.',
      }
    case 408:
    case 504:
      return {
        ...temel,
        baslik: 'IFS zaman aşımına uğradı',
        aciklama: 'IFS sorguyu verilen sürede tamamlayamadı.',
        cozum: 'Filtreyi daraltın (ör. tarih aralığı ekleyin) ya da $top değerini düşürün; çok satırlı çekimlerde IFS yavaşlayabilir.',
      }
    case 429:
      return {
        ...temel,
        baslik: 'IFS istek sınırına takıldı',
        aciklama: 'Kısa sürede çok fazla IFS isteği gönderildi (429).',
        cozum: 'Birkaç dakika bekleyip tekrar deneyin; toplu katalog yüklemelerini aynı anda çalıştırmayın.',
      }
    default:
      break
  }

  // Durum kodundan bağımsız IFS gövde kodları
  if (/EXPRESSION_PROPERTY_NOT_IN_TYPE|property .* not (found|defined)|could not be resolved/i.test(p.detay)) {
    const alan = b.alan ?? mesajdakiAlan(p.detay)
    const hedef = b.entity ?? entitySet ?? projeksiyon ?? 'bu entity'
    return {
      ...temel,
      baslik: alan ? `'${alan}' alanı ${hedef} içinde yok` : `İstenen alan ${hedef} içinde yok`,
      aciklama: `IFS, sorgudaki alanı bu entity'de tanımıyor${nerede}. Alan başka bir entity'de olabilir ya da adı farklı yazılmış olabilir.`,
      cozum: `Veri seti tasarım ekranındaki katalog aramasında ${alan ? `'${alan}'` : 'alanı'} arayın ve doğru entity'den seçin; kaynak kartındaki alan listesinden seçilen alanlar her zaman geçerlidir.`,
    }
  }
  if (/ODP_UNSUPPORTED_URL|Malformed Request|Bad Request.*\$filter|syntax error at position/i.test(p.detay) || /ODP_/.test(p.detay)) {
    const parca = /position\s+(\d+)/i.exec(p.detay)?.[1]
    return {
      ...temel,
      agirlik: 'uyari',
      baslik: 'IFS sorgu biçimi hatalı',
      aciklama: `IFS bu sorguyu ayrıştıramadı${parca ? ` (konum ${parca})` : ''}: filtre ya da sıralama ifadesi OData sözdizimine uymuyor.`,
      cozum: "Filtre örneği: Contract eq 'ILER2' and RevisedDueDate ge 2026-09-01 — metin değerleri TEK TIRNAK içinde, tarih tırnaksız ISO; alan adları $metadata'daki gibi büyük/küçük harf duyarlıdır. Parametre kullanıyorsanız {p.ad} biçimini koruyun.",
    }
  }
  if (p.durum >= 500) {
    return {
      ...temel,
      baslik: 'IFS tarafında hata',
      aciklama: `IFS isteği ${p.durum} ile sonuçlandı: ${ilkCumle(p.detay)}`,
      cozum: 'Geçici olabilir — tekrar deneyin. Sürerse teknik detayı IFS yöneticisine iletin.',
    }
  }
  return {
    ...temel,
    baslik: `IFS isteği reddedildi (${p.durum})`,
    aciklama: ilkCumle(p.detay) || 'IFS isteği tamamlanamadı.',
    cozum: 'Kaynak tanımını (projeksiyon, set, alanlar, filtre) kontrol edin; teknik detay IFS yöneticisi için yeterlidir.',
  }
}

// ── Postgres / SQL kaynağı ───────────────────────────────────────────────

function postgresCevir(ham: string, b: HataBaglami): CevrilmisHata | null {
  const temel = { teknikDetay: ham.slice(0, MAX_DETAY), agirlik: 'hata' as const }
  const nerede = b.takmaAd ? ` ('${b.takmaAd}' kaynağı)` : ''

  if (/statement timeout|canceling statement due to statement timeout|57014/i.test(ham)) {
    return {
      ...temel,
      agirlik: 'uyari',
      baslik: 'Sorgu 30 saniyeyi aştı',
      aciklama: `SQL kaynağı${nerede} 30 saniyelik güvenlik sınırında durduruldu.`,
      cozum: 'Filtreyi daraltın (tarih aralığı, site), gereksiz JOIN/ORDER BY kaldırın veya sonucu LIMIT ile sınırlayın. Ağır sorgular için özet (ozet) kullanmayı düşünün.',
    }
  }
  if (/read-only transaction|25006/i.test(ham)) {
    return {
      ...temel,
      baslik: 'Yalnız okuma: veri değiştiren sorgu çalıştırılamaz',
      aciklama: 'Rapor kaynakları salt okunur bir işlemde çalışır; INSERT/UPDATE/DELETE veya veri değiştiren CTE reddedilir.',
      cozum: 'Sorguyu yalnız SELECT / WITH … SELECT olacak biçimde yazın.',
    }
  }
  const tablo = /relation "([^"]+)" does not exist/i.exec(ham)?.[1]
  if (tablo || /42P01/.test(ham)) {
    return {
      ...temel,
      baslik: tablo ? `Tablo bulunamadı: ${tablo}` : 'Tablo bulunamadı',
      aciklama: `Sorgudaki tablo veritabanında yok${nerede}. Ad yanlış yazılmış ya da tablo başka bir şemada olabilir.`,
      cozum: 'Hub tabloları listesinden (sol panel) doğru tabloyu seçin; tablo adları küçük harf ve tırnaksızdır.',
    }
  }
  const kolon = /column "([^"]+)" does not exist/i.exec(ham)?.[1] ?? /column ([A-Za-z0-9_.]+) does not exist/i.exec(ham)?.[1]
  if (kolon || /42703/.test(ham)) {
    return {
      ...temel,
      baslik: kolon ? `Kolon bulunamadı: ${kolon}` : 'Kolon bulunamadı',
      aciklama: `Sorguda geçen kolon tabloda yok${nerede}. Prisma tabloları çift tırnaklı camelCase kolon kullanır ("ifsOrderNo" gibi).`,
      cozum: 'Kolon adını tablo kolon listesinden kopyalayın; büyük harf içeren kolonları çift tırnak içinde yazın.',
    }
  }
  const sozdizimi = /syntax error at or near "([^"]+)"/i.exec(ham)?.[1]
  if (sozdizimi || /42601|syntax error/i.test(ham)) {
    const konum = /Position:\s*(\d+)|at position (\d+)/i.exec(ham)
    return {
      ...temel,
      agirlik: 'uyari',
      baslik: 'SQL sözdizimi hatası',
      aciklama: `Sorgu ayrıştırılamadı${sozdizimi ? `: "${sozdizimi}" yakınında` : ''}${konum ? ` (konum ${konum[1] ?? konum[2]})` : ''}.`,
      cozum: '"Sorguyu dene" ile küçük parçalar hâlinde çalıştırıp hatalı kısmı daraltın.',
    }
  }
  if (/yalnız SELECT\/WITH|noktalı virgülle birden fazla|SQL sorgusu boş/i.test(ham)) {
    return {
      ...temel,
      agirlik: 'uyari',
      baslik: 'Sorgu kabul edilmedi',
      aciklama: ilkCumle(ham.replace(/^SQL:\s*/, '')),
      cozum: 'Tek bir SELECT (veya WITH … SELECT) yazın; noktalı virgülle birden çok ifade çalıştırılamaz.',
    }
  }
  if (/permission denied for (table|relation|schema)/i.test(ham)) {
    return {
      ...temel,
      baslik: 'Veritabanı izni yok',
      aciklama: 'Uygulama kullanıcısının bu tabloyu okuma izni yok.',
      cozum: 'Yönetici: ilgili tabloya SELECT izni verilmeli.',
    }
  }
  const param = /bind message supplies (\d+) parameters, but prepared statement .* requires (\d+)/i.exec(ham)
  if (param || /could not determine data type of parameter/i.test(ham)) {
    return {
      ...temel,
      agirlik: 'uyari',
      baslik: 'Parametre sayısı uyuşmuyor',
      aciklama: param
        ? `Sorgu ${param[2]} parametre bekliyor ama ${param[1]} değer gönderildi.`
        : 'Sorgudaki $1, $2 … parametrelerinin tipi belirlenemedi.',
      cozum: 'Kaynak kartındaki parametre listesiyle sorgudaki $1, $2 … sırasının aynı olduğundan emin olun; gerekirse $1::text gibi tip belirtin.',
    }
  }
  return null
}

// ── Claude (AI) ──────────────────────────────────────────────────────────

function aiCevir(ham: string, _b: HataBaglami): CevrilmisHata | null {
  const temel = { teknikDetay: ham.slice(0, MAX_DETAY), agirlik: 'hata' as const }
  if (/ANTHROPIC_API_KEY tanımlı değil|yapılandırılmamış/i.test(ham)) {
    return {
      ...temel,
      baslik: 'AI özelliği yapılandırılmamış',
      aciklama: 'Bu sunucuda yapay zekâ anahtarı tanımlı değil.',
      cozum: 'Yönetici: ANTHROPIC_API_KEY ortam değişkenini tanımlayıp uygulamayı yeniden başlatın.',
    }
  }
  const m = /Anthropic\s+(\d{3})/i.exec(ham)
  if (!m && !/Yapay zekâ|anthropic/i.test(ham)) return null
  const durum = m ? Number(m[1]) : 0
  if (durum === 401 || durum === 403) {
    return { ...temel, baslik: 'AI anahtarı geçersiz', aciklama: 'Yapay zekâ servisi anahtarı kabul etmedi.', cozum: 'Yönetici: ANTHROPIC_API_KEY değerini yenileyin.' }
  }
  if (durum === 429) {
    return { ...temel, agirlik: 'uyari', baslik: 'AI kullanım limiti doldu', aciklama: 'Yapay zekâ servisi istek sınırına ulaşıldı.', cozum: 'Birkaç dakika bekleyip tekrar deneyin; yoğun saatlerde istekleri seyreltin.' }
  }
  if (durum === 529 || durum >= 500) {
    return { ...temel, baslik: 'AI servisi şu an yanıt vermiyor', aciklama: `Yapay zekâ servisi geçici olarak hizmet veremiyor (${durum}).`, cozum: 'Birkaç dakika sonra tekrar deneyin. Görünümü elle de düzenleyebilirsiniz.' }
  }
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|network/i.test(ham)) {
    return { ...temel, baslik: 'AI servisine ulaşılamadı', aciklama: 'Sunucu api.anthropic.com adresine bağlanamadı.', cozum: 'Sunucunun dış ağ/proxy erişimini kontrol edin (ağ engeli veya VPN). Bu arada görünümü elle düzenleyebilirsiniz.' }
  }
  if (/saniyede yanıt vermedi|AbortError/i.test(ham)) {
    return { ...temel, agirlik: 'uyari', baslik: 'AI yanıt vermedi', aciklama: 'Yapay zekâ isteği zaman aşımına uğradı.', cozum: 'İsteği kısaltıp tekrar deneyin.' }
  }
  return null
}

// ── Hub (uygulama) uçları ────────────────────────────────────────────────

/** HTTP durum kodundan Hub mesajı — istemcideki api.ts ile TEK kaynak. */
export function durumCevir(durum: number, ham = '', b: HataBaglami = {}): CevrilmisHata | null {
  const temel = { teknikDetay: (ham || `HTTP ${durum}`).slice(0, MAX_DETAY), agirlik: 'hata' as const }
  switch (durum) {
    case 0:
      return { ...temel, baslik: 'Sunucuya bağlanılamadı', aciklama: 'İstek gönderilemedi; bağlantı koptu ya da sunucu kapalı.', cozum: 'İnternet/VPN bağlantınızı kontrol edip sayfayı yenileyin.' }
    case 401:
      return { ...temel, baslik: 'Oturum doğrulanamadı', aciklama: 'Oturumunuz sona ermiş görünüyor.', cozum: 'Sayfayı yenileyip tekrar giriş yapın.' }
    case 403: {
      const izin = /rapor\.[a-z]+/.exec(ham)?.[0] ?? b.kaynakAd
      return {
        ...temel,
        baslik: 'Yetkiniz yok',
        aciklama: izin ? `Bu işlem için '${izin}' izni gerekiyor.` : 'Bu işlem için gerekli izne sahip değilsiniz.',
        cozum: `BT'den ${izin ? `'${izin}'` : 'ilgili rapor'} yetkisini isteyin (veri seti/şablon tasarımı rapor.tasarla, katalog yükleme rapor.katalog ister).`,
      }
    }
    case 404:
      return { ...temel, baslik: 'Kayıt bulunamadı', aciklama: 'Aradığınız kayıt silinmiş ya da adres değişmiş olabilir.', cozum: 'Listeye dönüp kaydı yeniden açın.' }
    case 405:
      return { ...temel, baslik: 'Bu işlem sunucuda tanımlı değil', aciklama: 'Ekran, sunucuda karşılığı olmayan bir işlem çağırdı (uç eksik).', cozum: 'BT ekibine iletin — sunucu tarafında ilgili uç eklenmeli. Ayrıntıdaki adresi paylaşın.' }
    case 409:
      return { ...temel, agirlik: 'uyari', baslik: 'Çakışma', aciklama: ilkCumle(ham) || 'Kayıt başkası tarafından kullanılıyor ya da aynı adda bir kayıt var.', cozum: 'Adı değiştirin ya da bağlı kayıtları önce düzenleyin.' }
    case 413:
      return { ...temel, agirlik: 'uyari', baslik: 'Gönderilen içerik çok büyük', aciklama: 'İstek gövdesi sunucu sınırını aştı.', cozum: 'Daha küçük bir dosya/tasarım ile deneyin.' }
    case 429:
      return { ...temel, agirlik: 'uyari', baslik: 'Çok fazla istek', aciklama: ilkCumle(ham) || 'Kısa sürede çok fazla istek gönderildi.', cozum: 'Birkaç dakika bekleyip tekrar deneyin.' }
    case 502:
    case 503:
    case 504:
      return { ...temel, baslik: 'Sunucuya ulaşılamadı', aciklama: `Sunucu geçici olarak yanıt veremiyor (${durum}).`, cozum: 'Birkaç dakika sonra tekrar deneyin; sürerse BT ekibine bildirin.' }
    case 500:
      return { ...temel, baslik: 'Sunucu hatası', aciklama: ilkCumle(ham) || 'Beklenmeyen bir sunucu hatası oluştu.', cozum: 'Tekrar deneyin; sürerse ayrıntıyı BT ekibine iletin.' }
    default:
      return null
  }
}

// ── Giriş noktası ────────────────────────────────────────────────────────

/**
 * Katman izleri — "statement timeout" hem Postgres hem ağ gibi okunabildiği için önce
 * metnin hangi katmandan geldiği saptanır, çeviri o katmanla BAŞLAR (yanlış dala düşmesin).
 */
const IFS_IZI = /IFS\s+\d{3}\s|IFS token|IFS env|\.svc\/|MI_METADATA|ODP_|EXPRESSION_PROPERTY|UNABLE_TO_VERIFY_LEAF_SIGNATURE|odata/i
const AI_IZI = /Anthropic|ANTHROPIC_API_KEY|Yapay zekâ/i
const PG_IZI = /Raw query failed|prisma\.\$queryRaw|\b(42P01|42703|42601|57014|25006)\b|relation "|column "|statement timeout|read-only transaction|^SQL:/im

const CEVIRICILER = { ifs: ifsCevir, postgres: postgresCevir, ai: aiCevir } as const

/**
 * Ham hata metnini çevirir. Tanınmayan metinde bile ASLA boş dönmez:
 * başlık "Beklenmeyen hata", açıklama ilk cümle, teknikDetay tamamı.
 */
export function hataCevir(ham: string, baglam: HataBaglami = {}): CevrilmisHata {
  const metin = (ham ?? '').toString().trim()
  if (!metin) {
    return { baslik: 'Beklenmeyen hata', aciklama: 'Hata ayrıntısı alınamadı.', teknikDetay: '(boş hata metni)', agirlik: 'hata' }
  }
  const tip = (baglam.kaynakTipi !== 'hub' ? baglam.kaynakTipi : undefined)
    ?? (IFS_IZI.test(metin) ? 'ifs' : AI_IZI.test(metin) ? 'ai' : PG_IZI.test(metin) ? 'postgres' : undefined)
  const sira: (keyof typeof CEVIRICILER)[] = tip ? [tip, ...(['ifs', 'postgres', 'ai'] as const).filter((k) => k !== tip)] : ['ifs', 'postgres', 'ai']
  for (const k of sira) {
    const c = CEVIRICILER[k](metin, baglam)
    if (c) return c
  }
  return {
    baslik: 'Beklenmeyen hata',
    aciklama: ilkCumle(metin),
    cozum: 'Tekrar deneyin; sürerse "Ayrıntı" altındaki metni BT ekibine iletin.',
    teknikDetay: metin.slice(0, MAX_DETAY),
    agirlik: 'hata' as const,
  }
}

/** Error | string | unknown → çeviri (sunucu catch bloklarında kullanılır). */
export function hataCevirNesne(e: unknown, baglam: HataBaglami = {}): CevrilmisHata {
  const ham = e instanceof Error ? (e.stack && e.message.length < 200 ? e.message : e.message) : String(e)
  return hataCevir(ham, baglam)
}

/** Tek satırlık özet — log ve geriye dönük `error` alanı için. */
export const hataOzeti = (h: CevrilmisHata) => `${h.baslik}: ${h.aciklama}`
