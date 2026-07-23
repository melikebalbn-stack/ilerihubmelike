/**
 * IPRO PLC Poller — SAF hesap fonksiyonları.
 *
 * PLC/DB/ağ DOKUNMAZ: girdi→çıktı, yan etkisiz. index.ts bunları import eder;
 * testler (hesap.test.ts) canlı PLC olmadan bu dosyayı hedefler.
 *
 * PLC'ye YAZMA YOK (resetAdresi dahil) — poller yalnız okur.
 */

// ── Sayaç ──

// ── Hayalet üretim savunması (22.07.2026 saha olayı) ──
//
// KALICI DERS: **MBRead hata vermemesi verinin GEÇERLİ olduğu anlamına GELMEZ.**
// (IFS'teki "HTTP 500 ≠ yazılmadı" dersinin ikizi.)
//
// OLAY: 12:13–12:15 PANO-3 yarı-kopuk TCP. MBRead hata vermeden 0 döndürdü →
// kod bunu RESET sandı → prevSayac=0 yazdı → bağlantı toparlayınca
// delta = 1146 - 0 = 1146 HAYALET üretim birikti (KH01 hiç üretmediği hâlde).
//
// ÜÇ KATMAN birlikte savunur (biri tek başına yetmez):
//   1) Hata/reconnect sonrası BASELINE TAZELEME — ilk başarılı okuma delta üretmez.
//   2) BLOK-GENELİ SIFIR — bir PLC'de önceden dolu TÜM sayaçlar aynı turda 0 ise
//      okuma geçersizdir (gerçek reset makine bazındadır: CN14 tek başına sıfırlandı).
//   3) SIFIR ŞÜPHESİ — cur<prev ve cur===0 ise prevSayac KORUNUR, delta 0.
//      Sıfır, bozuk okumanın imzasıdır; sıfır-olmayan düşük değer gerçek resettir.
//
// TAKAS (bilinçli): kopma penceresindeki gerçek üretim kaybolabilir.
// Hayalet üretmektense EKSİK saymak yeğdir — Faz 2'de kalıcı delta ile telafi.

// ── Donma tuzağı ve KAÇIŞ KAPISI (23.07.2026) ──
//
// Katman 2 tek başına SONSUZA KADAR reddeder: prev eski değerde donduğu için
// `oncedenDolu` her turda dolu kalır, sıfırlar hep "geçersiz" sayılır. Sayaçlar
// GERÇEKTEN sıfırlandıysa (PLC restart / toplu sıfırlama) poller bir daha
// toparlanamaz — hayaleti kapatırken ters yönde DONMA TUZAĞI kurulmuş olur.
// Saha kanıtı: 22–23.07 gecesi PANO-3'te 104 dk KESİNTİSİZ blok-geçersiz pencere
// (1248 tur). %2 paket kaybı böyle bir pencere üretmez.
//
// KALICI DERS: **SÜRE, GERÇEKLİK KANITI DEĞİLDİR.**
// İlk tasarımda kaçış kapısı süreye bağlanmıştı (60 sn) + 5 dk "sıfır güveni".
// Elimizdeki kanıt bunu çürüttü: 104 DAKİKALIK blok-geçersiz pencerenin sonunda
// sayaçlar ESKİ BÜYÜK DEĞERLERİNE geri döndü → o sıfırlar saatlerce sürmesine
// rağmen SAHTEYDİ. Süreye bağlı kapı, tezgahı ~5 dk sonra `sayacToplam: 0` ile
// `/status`'e sokar; kalan ~99 dk boyunca is-basla `plcSayacBaslangic = 0` yazar ve
// sayaç 1146'ya dönünce İŞ KAYDINDA 1146 hayalet oluşurdu — önlemek istediğimiz şey.
//
// KAÇIŞ KAPISI (kanıta bağlı): sıfır ancak **SIFIRDAN GELEN GERÇEK BİR ARTIŞ**
// görüldüğünde benimsenir — en az bir pinde `0 < cur < prev`. Gerçek PLC restart /
// toplu sıfırlamada sayaçlar sıfırdan yukarı saymaya başlar (0→1→2); bozuk okumada
// sıfırlar inatla 0'da kalır. Artış gelmiyorsa tezgah `/status` DIŞINDA kalır ve
// is-basla 503 verir — süre ne olursa olsun. Süre yalnız TELEMETRİDİR.
//
// SIÇRAMA KORUMASI (kaçış kapısının hayalet riski): sıfırlar aslında bozuksa,
// bağlantı toparlayınca sayaç eski büyük değerine GERİ SIÇRAR ve prev=0 olduğu için
// delta = tüm sayaç kadar hayalet üretirdi. Bu yüzden kaçıştan sonra pin başına
// `kacisEsigi` (kaçış öncesi son güvenilir değer) hatırlanır: sonraki okuma bu
// eşiğe ULAŞIRSA üretim değil GERİ DÖNÜŞ sayılır → delta 0, baseline yeniden kurulur.
// Bedeli: gerçek restart sonrası sayaç eşiği aşarken bir turluk delta kaybı.

export type SayacOlay =
  | 'ilk' // baseline kuruldu (ilk okuma)
  | 'normal' // cur >= prev, düz artış
  | 'baseline-tazelendi' // katman 1: hata/reconnect sonrası ilk okuma
  | 'blok-gecersiz' // katman 2: PLC'de toplu sıfır → okuma geçersiz
  | 'sifir-suphesi' // katman 3: cur===0 & cur<prev → prev korunur
  | 'reset-kabul' // gerçek reset (0 < cur < prev)
  | 'kacis-kapisi' // sıfırdan artış KANITI → sıfır gerçek kabul, baseline 0
  | 'kacis-geri-donus' // kaçış sonrası eski değere sıçrama → üretim DEĞİL, delta 0

export interface SayacGirdi {
  prev: number | undefined
  cur: number
  /** Katman 1: bu PLC'de hata/reconnect oldu → bu okuma yalnız baseline tazeler. */
  baselineTazele: boolean
  /** Katman 2: bu turda PLC blok-geneli sıfır tespit edildi → okuma geçersiz. */
  blokGecersiz: boolean
  /**
   * Kaçış kapısı bu turda açıldı → HÂLÂ SIFIR okuyan pinlerde sıfır GERÇEK kabul
   * edilir (baseline 0, delta yok). Kanıtı sağlayan pin (cur > 0) normal akışa girer
   * ve 'reset-kabul' ile gerçek deltasını üretir.
   */
  kacisKapisi?: boolean
  /** Sıçrama koruması: kaçış öncesi son güvenilir değer (yoksa undefined). */
  kacisEsigi?: number
}

export interface SayacIsleSonuc {
  delta: number
  /** prevSayac'ın yeni değeri (korunuyorsa eski değerin aynısı). */
  yeniPrev: number | undefined
  olay: SayacOlay
}

/**
 * Tek pin için sayaç kararı — üç katman burada birleşir. SAF: yan etkisiz.
 *
 * Sıra önemlidir: geçersiz okuma (katman 2) her şeyden önce elenir, sonra
 * baseline tazeleme (katman 1), sonra normal/şüphe/reset ayrımı (katman 3).
 */
export function sayacIsle(g: SayacGirdi): SayacIsleSonuc {
  // KAÇIŞ KAPISI — yalnız HÂLÂ SIFIR okuyan pinler için: donmuş prev bırakılır,
  // baseline 0'a kurulur, delta ÜRETİLMEZ. Kanıt pini (cur > 0) buradan geçmez;
  // aşağıda 'reset-kabul' dalına düşüp gerçek deltasını üretir.
  if (g.kacisKapisi && g.cur === 0) return { delta: 0, yeniPrev: 0, olay: 'kacis-kapisi' }

  // KATMAN 2 — okuma geçersiz: hiçbir şey güncellenmez, prev KORUNUR.
  if (g.blokGecersiz) return { delta: 0, yeniPrev: g.prev, olay: 'blok-gecersiz' }

  // KATMAN 1 — hata/reconnect sonrası: yalnız baseline tazelenir, delta ÜRETİLMEZ.
  if (g.baselineTazele) {
    // ANCAK bozuk bir sıfır baseline olarak BENİMSENMEZ. Katman 2 yalnız EN AZ İKİ
    // dolu sayaç varken ateşlenir; tek dolu sayaçlı PLC/vardiya başında bozuk 0
    // buraya kadar gelebilir. Benimsenirse prev=0 olur ve sonraki gerçek okumada
    // delta = tüm sayaç kadar HAYALET üretilir (17:47 epizodunun varyantı).
    // Sıfır reddedilir, bayrak çağıran tarafta tüketilmez → sonraki tura devreder.
    if (g.cur === 0 && g.prev !== undefined && g.prev > 0) {
      return { delta: 0, yeniPrev: g.prev, olay: 'sifir-suphesi' }
    }
    return { delta: 0, yeniPrev: g.cur, olay: 'baseline-tazelendi' }
  }

  // İlk okuma: baseline kurulur (birikmiş sayaç üretim sayılmaz).
  if (g.prev === undefined) return { delta: 0, yeniPrev: g.cur, olay: 'ilk' }

  // SIÇRAMA KORUMASI — kaçış sonrası eski değere geri dönüş. 'normal' dalından
  // ÖNCE gelmeli: cur(1146) >= prev(0) olduğu için aksi hâlde hayalet üretirdi.
  if (g.kacisEsigi !== undefined && g.cur > 0 && g.cur >= g.kacisEsigi) {
    return { delta: 0, yeniPrev: g.cur, olay: 'kacis-geri-donus' }
  }

  // Düz artış.
  if (g.cur >= g.prev) return { delta: g.cur - g.prev, yeniPrev: g.cur, olay: 'normal' }

  // KATMAN 3 — cur < prev.
  // cur === 0: bozuk okumanın imzası. prev KORUNUR, delta yok. Kaç tur sürerse
  // sürsün korunur; değer geri dönerse 'normal' dalında delta ≈ 0 çıkar (hayalet yok).
  if (g.cur === 0) return { delta: 0, yeniPrev: g.prev, olay: 'sifir-suphesi' }

  // 0 < cur < prev: gerçek reset. Sıfırlamadan bu yana üretilen adet = cur.
  return { delta: g.cur, yeniPrev: g.cur, olay: 'reset-kabul' }
}

/**
 * KATMAN 2 — blok-geneli sıfır tespiti (PLC turu bazında).
 *
 * Bir PLC'de önceden SIFIR OLMAYAN sayaçların TAMAMI aynı turda 0 dönüyorsa okuma
 * geçersizdir. Gerçek reset makine bazındadır — saha kanıtı: CN14 tek başına
 * sıfırlandı, komşuları etkilenmedi. Buna karşılık 22.07 olayında PANO-3'te
 * 1146/1425/2053 AYNI turda 0 döndü (üçü birden sıfırlanamaz).
 *
 * En az 2 dolu sayaç aranır: tek dolu sayaçta toplu-sıfır ile gerçek reset
 * ayırt edilemez, o durum katman 3'e bırakılır.
 */
export function blokGecersizMi(okumalar: Array<{ prev: number | undefined; cur: number }>): boolean {
  const oncedenDolu = okumalar.filter((o) => o.prev !== undefined && o.prev > 0)
  if (oncedenDolu.length < 2) return false
  return oncedenDolu.every((o) => o.cur === 0)
}

export interface KacisKapisiGirdi {
  /** Bu turda blok-geçersizlik var mı (varsa kanıt aranmaz — sıfırlar sürüyor). */
  blokGecersiz: boolean
  /** Süregelen bir blok-geçersiz dizi var mı (ardArdaBlokGecersizTur > 0). */
  blokGecersizDizisiVar: boolean
  /** Bu turun pin okumaları. */
  okumalar: Array<{ prev: number | undefined; cur: number }>
}

export interface KacisKapisiSonuc {
  /** Bu turda kaçış kapısı açıldı mı. */
  kacisKapisi: boolean
  /** Kanıtı sağlayan pinin index'i (log/telemetri için; yoksa null). */
  kanitIndex: number | null
}

/**
 * KAÇIŞ KAPISI kararı — KANITA dayalı, SÜREYE DEĞİL.
 *
 * Donmuş bir blok-geçersiz dizinin ardından, önceden dolu bir pin `0 < cur < prev`
 * okuyorsa bu **sıfırdan gelen gerçek artıştır**: PLC gerçekten sıfırlanmış ve
 * yukarı saymaya başlamıştır. O anda hâlâ 0 okuyan kardeş pinlerin donmuş baseline'ı
 * da 0'a çekilir (tüm PLC tutarlı hâle gelir).
 *
 * Bozuk okumada sıfırlar 0'da kalır → kanıt hiç gelmez → kapı hiç açılmaz →
 * tezgah `/status` dışında kalır. Bu, süre ne olursa olsun geçerlidir.
 *
 * Kanıt eşiği `cur < prev` bilinçli: bağlantı toparlayıp sayaç ESKİ değerine
 * dönerse (`cur >= prev`) bu artış değil GERİ DÖNÜŞtür, kanıt sayılmaz.
 */
export function kacisKapisiKarari(g: KacisKapisiGirdi): KacisKapisiSonuc {
  if (g.blokGecersiz || !g.blokGecersizDizisiVar) return { kacisKapisi: false, kanitIndex: null }
  const i = g.okumalar.findIndex((o) => o.prev !== undefined && o.prev > 0 && o.cur > 0 && o.cur < o.prev)
  return i >= 0 ? { kacisKapisi: true, kanitIndex: i } : { kacisKapisi: false, kanitIndex: null }
}

// ── Yeniden bağlanma disiplini ──

export interface OkumaHatasiKarar {
  /** Güncellenmiş ard arda hata sayacı. */
  ardArdaHata: number
  /** Oturum ZORLA koparılmalı mı (Connected() ne derse desin). */
  zorlaKop: boolean
}

/**
 * Okuma hatası sonrası karar.
 *
 * NEDEN EŞİK (her hatada değil): 22.07 saha gözlemi — poller epizodlarda HİÇ reconnect
 * etmediği hâlde okumalar kendiliğinden geri geldi. Demek ki **TCP oturumu ölmemişti**;
 * PLC 30–90 sn yanıt vermedi. Her tek timeout'ta Disconnect çağırmak, slotu kıt bir
 * PLC'de (S7-300: 8–16 eşzamanlı bağlantı) gereksiz bağlantı churn'ü yaratır ve
 * sorunu BÜYÜTÜR. Bu yüzden yalnız ARD ARDA `esik` hatada oturum koparılır.
 *
 * Karar YALNIZ bu sayaca dayanır — `Connected()`'ın döndürdüğü değere GÜVENİLMEZ
 * (oturum sessizce ölse de true dönebiliyor; asıl kusur buydu).
 */
export function okumaHatasiKarari(oncekiArdArda: number, esik: number): OkumaHatasiKarar {
  const ardArdaHata = oncekiArdArda + 1
  return { ardArdaHata, zorlaKop: ardArdaHata >= esik }
}

// ── Duruş ──

export type DurusGecis = 'basladi' | 'bitti' | null

/**
 * Duruş bitinin (durusAdresi byte'ının 0. biti) tur-arası geçişi.
 * İlk turda (prev undefined) geçiş ÜRETİLMEZ — baseline sayılır.
 */
export function durusGecis(prevBit: boolean | undefined, curBit: boolean): DurusGecis {
  if (prevBit === undefined) return null
  if (!prevBit && curBit) return 'basladi'
  if (prevBit && !curBit) return 'bitti'
  return null
}

// ── Tazelik (fail-safe) ──

/**
 * Bir okumanın TAZE olup olmadığı.
 *
 * NEDEN: `/status`'ü yalnız gerçek ve taze okumayla beslemek için. İki pencere
 * kapanır:
 *   1) SOĞUK AÇILIŞ — poller ayağa kalkar, `/status` yayına girer ama ilk PLC
 *      okuması henüz yapılmamıştır (sonOkuma = null). Filtresiz kalırsa
 *      `sayacToplam: 0` sunulur; o anda iş başlatan operatör YANLIŞ (sıfır)
 *      plcSayacBaslangic alır ve bu prod kaydı geri alınamaz.
 *   2) BAĞLANTI KOPMASI — PLC koparsa son bilinen değerler bellekte kalır ve
 *      sunulmaya devam eder (backoff 60 sn'ye kadar çıkabilir) → BAYAT baseline.
 *
 * FAIL-SAFE YÖN: şüphede kalınca tezgah `/status`'te YER ALMAZ → is-basla
 * bugünkü 503 dalına düşer → iş AÇILMAZ. Yanlış kayıt yerine açılmamış iş.
 *
 * @param sonOkuma ISO zaman damgası; null ise hiç okuma yapılmamıştır
 * @param simdi    şimdiki zaman (ms epoch)
 * @param esikMs   bayatlık eşiği; yaş bunu AŞARSA bayat (eşiğe eşit hâlâ taze)
 */
export function taze(sonOkuma: string | null, simdi: number, esikMs: number): boolean {
  if (!sonOkuma) return false // hiç okuma yok → asla taze sayılmaz
  const t = Date.parse(sonOkuma)
  if (Number.isNaN(t)) return false // bozuk damga → güvenli tarafta kal
  const yas = simdi - t
  if (yas < 0) return true // saat kayması: gelecekten damga → taze say
  return yas <= esikMs
}

export interface TazelikDamgasiGirdi {
  /** MBRead hatasız döndü mü. */
  okumaBasarili: boolean
  /** Bu tur blok-geçersiz mi (MBRead başarılı olsa bile veri ÇÖP). */
  blokGecersiz: boolean
}

/**
 * TAZELİK YALNIZ GEÇERLİ OKUMADAN.
 *
 * 23.07 bulgusu: `markRead()` blok-geçersizlik tespitinden ÖNCE çağrılıyordu.
 * MBRead hata vermediği için çöp okuma da damgayı tazeliyor, tezgah saatlerce
 * TAZE görünüyor ve `/status` DONMUŞ sayaç sunuyordu — fail-safe filtresi bu
 * yoldan atlanıyordu. Damga artık yalnız veriye GÜVENİLEN turda ilerler.
 *
 * Blok-geçersizlik SÜRESİ bir çıkış yolu DEĞİLDİR: sıfırlar kanıtlanana kadar
 * (bkz. kacisKapisiKarari) tezgah bayat kalır — 5 dk da sürse 2 saat de.
 */
export function tazelikDamgasiGuncellensinMi(g: TazelikDamgasiGirdi): boolean {
  return g.okumaBasarili && !g.blokGecersiz
}

// ── Tezgah toplama ──

export interface PinOzet {
  /** Tezgaha bağlı değilse null — toplamaya GİRMEZ. */
  tezgahKod: string | null
  curSayac: number
  lastDelta: number
  durusBit: boolean
}

export interface TezgahToplam {
  /** Tezgahın tüm pinlerinin ham sayaç toplamı (is-basla sözleşmesi bunu okur). */
  sayacToplam: number
  /** Bu turdaki delta toplamı. */
  sonDelta: number
  /** Herhangi bir pini duruş sinyali veriyorsa tezgah duruşta sayılır. */
  durusta: boolean
}

/**
 * Pin durumlarını tezgah bazında toplar. Bir tezgahın birden çok pini olabilir
 * (üretim = TÜM pinlerinin deltaları toplamı).
 */
export function aggregateTezgah(pins: PinOzet[]): Map<string, TezgahToplam> {
  const sonuc = new Map<string, TezgahToplam>()
  for (const p of pins) {
    if (!p.tezgahKod) continue // tezgaha bağlı olmayan pin toplamaya girmez
    const t = sonuc.get(p.tezgahKod) ?? { sayacToplam: 0, sonDelta: 0, durusta: false }
    t.sayacToplam += p.curSayac
    t.sonDelta += p.lastDelta
    if (p.durusBit) t.durusta = true
    sonuc.set(p.tezgahKod, t)
  }
  return sonuc
}
