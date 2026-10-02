/**
 * FİF (KAL-FR-10) durum makinesi — TEK KAYNAK (Faz 2).
 *
 * `gecisYapabilirMi(ctx, fif, hedef)` SAF fonksiyon: yetki + ön koşulu birlikte
 * değerlendirir, {ok, sebep?} döner. UI ve API AYNI fonksiyonu çağırır; kural
 * hiçbir yerde tekrarlanmaz. Rol eşleşmesi fif alanlarından (düz string userId)
 * + ctx'ten hesaplanır; "sorumlu bölüm müdürü" User id'si DB'den çözülüp ctx'e
 * konur (saf fonksiyon DB'ye inmez).
 */
import { FifDurum, FifSonuc } from '@/generated/prisma'

/** Geçiş kararı için gereken bağlam. */
export type FifGecisCtx = {
  userId: string | null
  isManage: boolean
  /** Sorumlu bölümün müdürünün User id'si (DB'den çözülür; yoksa null). */
  sorumluBolumMudurUserId?: string | null
  /** KSS koltuğunda mı (fif-access.isFifKss) — KSS adımlarının kapısı. manage BU ADIMLARDA YETMEZ (FAZ B kararı). */
  isKss?: boolean
}

/** Geçiş kararı için gereken FİF alanları (DB'siz test edilebilir). */
export type FifGecisState = {
  durum: FifDurum
  createdById: string | null
  hazirlayanUserId: string | null
  yayinlayanOnaylayanUserId: string | null
  sorumluOnaylayanUserId: string | null
  izlemeSorumlusuUserId: string | null
  sorumluBolumId: string | null
  /** "Onaya Gönder"de ZORUNLU (Kalite kararı); taslak kaydında değil. */
  yayinlayanBolumId: string | null
  uygunsuzlukTanimi: string | null
  /** KSS kapanış kontrolünde bakılır: "yayılım var" ise açıklama zorunlu. */
  yayilimVarMi?: boolean | null
  yayilimAciklama?: string | null
  tur: string | null
  /**
   * etkinlikPlanTarihi / etkinlikUygun faaliyet bazlı etkinlik akışını belirler
   * (yeniAkisMi). sonuc / gerceklesenTarih / parafUserId "Kapatmaya Gönder" şartı
   * içindir (satirKapatildiMi). Verilmezse ilgili kural "yok" sayar.
   */
  faaliyetler: {
    hedefTarih: Date | string | null
    etkinlikPlanTarihi?: Date | string | null
    etkinlikUygun?: boolean | null
    sonuc?: string | null
    gerceklesenTarih?: Date | string | null
    parafUserId?: string | null
  }[]
  etkinlikler: { madde: string; uygun: boolean | null }[]
}

/**
 * YENİ / ESKİ etkinlik akışı ayrımı. Kalite kararı: 3 aylık etkinlik süresi İLK
 * KAPANIŞ ONAYINDA başlar — KSS_KAPANIS_BEKLIYOR → ETKINLIK geçişi, etkin bulunmamış
 * HER satıra etkinlikPlanTarihi yazar (durum ucu). Bu yüzden ETKINLIK'teki bir FİF'te
 * satırların HEPSİ plan taşıyorsa yeni akış: etkinlik satır bazında KSS kontrolüyle,
 * kapanış "Tamamen Kapat" ile. Plan taşımayan (bu karardan önce ETKINLIK'e girmiş)
 * kayıtlar eski FİF geneli FifEtkinlik (Kapatma + Tekrar Etmeme) yolundan devam eder.
 * Satırsız FİF eski akış sayılır.
 */
export function yeniAkisMi(s: Pick<FifGecisState, 'faaliyetler'>): boolean {
  return s.faaliyetler.length > 0 && s.faaliyetler.every((f) => f.etkinlikPlanTarihi != null)
}

/**
 * Satır kapatılmış mı: sonuç K + gerçekleşen tarih + paraf. (Paket 4: KSS
 * "Sonuç Gir" K ucu üçünü birlikte yazar; elle/eski yoldan K verilmiş ama parafsız satır
 * KAPALI SAYILMAZ.)
 */
export function satirKapatildiMi(f: FifGecisState['faaliyetler'][number]): boolean {
  return f.sonuc === 'K' && !!f.gerceklesenTarih && !!f.parafUserId
}

/**
 * Paket 4 — "önce kök neden, sonra faaliyet": kök neden analizi dolu mu. Üç
 * kaynaktan EN AZ BİRİ yeter: özet metin, Ek-1 balık kılçığı (boş olmayan
 * kategori notu), 5 Neden satırı. TEK KAYNAK: durum ucu, form PUT, faaliyet ucu
 * ve detay sayfası (faaliyet bölümü pasif + uyarı) aynı fonksiyonu çağırır.
 */
export function kokNedenDoluMu(k: {
  kokNedenAnalizi: string | null | undefined
  kokNedenler: readonly { aciklama: string | null }[]
  besNedenler: readonly unknown[]
}): boolean {
  return (
    !!k.kokNedenAnalizi?.trim() ||
    k.kokNedenler.some((x) => !!x.aciklama?.trim()) ||
    k.besNedenler.length > 0
  )
}

/**
 * Paket 4: ek termin geçmişi (onay/red/iptal dahil) olan faaliyet satırı silinemez —
 * form PUT senkronu ve faaliyet DELETE ucu aynı metinle 400; DB'de FifEkTermin →
 * FifFaaliyet FK'si RESTRICT (ikinci bekçi).
 */
export const EK_TERMINLI_SILINEMEZ = 'Ek termin geçmişi olan faaliyet silinemez.'

/** Kök neden boşken faaliyet eklenmeye çalışılırsa — UI uyarısı ve API 400 aynı metin. */
export const KOK_NEDEN_ONCE = 'Önce kök neden analizini doldurun'

/**
 * Paket 4: FAALİYET PLANLAMA — satır EKLEME, satıra uygulama SORUMLUSU atama ve
 * FAALIYET'te hedef tarih girme kimde. Yalnız FAALIYET'te (sorumlu bölüm onayından
 * sonra); sorumlu bölüm müdürü (zincir snapshot'ı sorumluOnaylayanUserId — koltuk
 * omurgasından çözülen), faaliyet izleme sorumlusu veya manage. Kapanış reddinden
 * (→ FAALIYET) sonra eklenen yeni satır da onlarda.
 * Döner: null = izinli; aksi hâlde {sebep, status} (yetki 403, durum 400).
 */
export const FAALIYET_PLANLAMA_DURUMLARI: readonly FifDurum[] = [FifDurum.FAALIYET]

export function faaliyetPlanlamaYetkisi(
  ctx: Pick<FifGecisCtx, 'userId' | 'isManage'>,
  s: Pick<FifGecisState, 'durum' | 'sorumluOnaylayanUserId' | 'izlemeSorumlusuUserId'>,
): { sebep: string; status: 400 | 403 } | null {
  if (!FAALIYET_PLANLAMA_DURUMLARI.includes(s.durum)) {
    return { sebep: 'Faaliyet satırı yalnız faaliyet aşamasında (Sorumlu Bölüm Onayı\'ndan sonra) eklenir / sorumlusu atanır', status: 400 }
  }
  if (ctx.isManage) return null
  if (ctx.userId && (ctx.userId === s.sorumluOnaylayanUserId || ctx.userId === s.izlemeSorumlusuUserId)) return null
  return {
    sebep: 'Faaliyet planlaması (satır ekleme, hedef tarih, sorumlu atama) yalnız izleme sorumlusu ve sorumlu bölüm müdürü tarafından yapılır',
    status: 403,
  }
}

/**
 * Geçiş kararı. Red türü: `yetki` (kim) → API 403; `kosul` (ön koşul) ve
 * `gecersiz` (böyle geçiş yok) → API 400.
 */
export type GecisSonuc = { ok: true } | { ok: false; sebep: string; tur: 'yetki' | 'kosul' | 'gecersiz' }

const OK: GecisSonuc = { ok: true }
const no = (sebep: string, tur: 'yetki' | 'kosul' | 'gecersiz' = 'kosul'): GecisSonuc => ({ ok: false, sebep, tur })

/** Kullanıcı bu FİF'te belirli bir "rol" tutuyor mu (userId eşleşmesi + manage). */
function esitVeyaManage(ctx: FifGecisCtx, userId: string | null): boolean {
  if (ctx.isManage) return true
  return !!ctx.userId && ctx.userId === userId
}
function hazirlayanMi(ctx: FifGecisCtx, s: FifGecisState): boolean {
  return esitVeyaManage(ctx, s.createdById) || esitVeyaManage(ctx, s.hazirlayanUserId)
}

/**
 * KSS adımının sahibi mi. KSS koltuklarında oturan HERHANGİ bir kullanıcı —
 * biri onaylasa yeterli; kayda snapshot'lanmış kişi yetkiyi KISITLAMAZ (kssUserId
 * artık "işlemi yapan KSS" kaydıdır, yetki kaynağı değil). FAZ B kararı korunur:
 * `fif.manage` (Kalite ekibi) KSS yerine GEÇMEZ.
 */
function kssMi(ctx: FifGecisCtx): boolean {
  return !!ctx.isKss
}

/** Bir geçişin izin + ön koşul kuralı. */
type GecisKural = {
  from: FifDurum
  to: FifDurum
  /** Kısa etiket (UI buton metni) — akışa göre değişebilir. */
  etiket: string | ((s: FifGecisState) => string)
  izinli: (ctx: FifGecisCtx, s: FifGecisState) => boolean
  onKosul?: (s: FifGecisState) => GecisSonuc
  /**
   * Yetkili kullanıcıya ön koşul sağlanmasa da buton PASİF + sebep olarak
   * gösterilsin (aksi hâlde buton hiç görünmez).
   */
  pasifGoster?: boolean
  /**
   * Geçişle BİRLİKTE seçilen alan (Paket 4: "Sorumlu Bölüm Onayı"nda faaliyet izleme
   * sorumlusu). UI butonu yetkiliye her zaman gösterir ve seçimi ister; uç seçimi
   * state'e katıp ön koşulu öyle değerlendirir.
   */
  secim?: 'izlemeSorumlusu'
}

/** Zorunlu alanlar (validator ile TEK kaynak — fif-validators FIF_ZORUNLU_ALANLAR). */
function zorunluAlanlarTam(s: FifGecisState): GecisSonuc {
  if (!s.tur) return no('Tür zorunlu')
  if (!s.sorumluBolumId) return no('Sorumlu bölüm zorunlu')
  if (!s.yayinlayanBolumId) return no('Yayınlayan bölüm zorunlu')
  if (!s.uygunsuzlukTanimi || !s.uygunsuzlukTanimi.trim()) return no('Tespit (uygunsuzluk tanımı) zorunlu')
  return OK
}

export const FIF_GECISLER: GecisKural[] = [
  {
    // Paket 2: MÜDÜR ONAYI KALKTI — "Onaya Gönder" doğrudan KSS kaydına düşer.
    // Açan kişinin bölüm müdürüne yalnız BİLGİ bildirimi gider (fif-bildirim).
    from: FifDurum.TASLAK, to: FifDurum.KSS_KAYIT_BEKLIYOR, etiket: 'Onaya Gönder',
    izinli: (c, s) => hazirlayanMi(c, s),
    onKosul: zorunluAlanlarTam,
  },
  {
    // ESKİ AKIŞ (Paket 2 öncesi ONAY_BEKLIYOR'a girmiş kayıtlar takılı kalmasın):
    // yeni kayıt bu duruma GİRMEZ; mevcutlar yayınlayan müdür onayıyla ilerler.
    from: FifDurum.ONAY_BEKLIYOR, to: FifDurum.KSS_KAYIT_BEKLIYOR, etiket: 'Onayla',
    izinli: (c, s) => esitVeyaManage(c, s.yayinlayanOnaylayanUserId),
  },
  {
    // ESKİ AKIŞ — bkz. üstteki kural. redNedeni API tarafında zorunlu (aciklama).
    from: FifDurum.ONAY_BEKLIYOR, to: FifDurum.TASLAK, etiket: 'Reddet',
    izinli: (c, s) => esitVeyaManage(c, s.yayinlayanOnaylayanUserId),
  },
  {
    // ADIM 3 (Paket 4): KSS kaydı alır (numara bu anda verilir) ve sorumlu bölüm
    // müdürüne yönlendirir → müdür izleme sorumlusunu seçip bölüm onayını verir.
    // FAIL-CLOSED: müdür (zincir snapshot'ı) yoksa yönlendirilemez.
    from: FifDurum.KSS_KAYIT_BEKLIYOR, to: FifDurum.SORUMLU_ATAMA_BEKLIYOR, etiket: 'Kayda Al ve Yönlendir',
    izinli: (c) => kssMi(c),
    onKosul: (s) => {
      if (!s.sorumluBolumId) return no('Sorumlu bölüm atanmadan kayda alınamaz')
      if (!s.sorumluOnaylayanUserId) return no('Sorumlu bölüm müdürü bulunamadı — kayda alınamaz')
      return OK
    },
  },
  {
    // KSS eksik/yanlış bilgi görürse forma geri gönderir (red gerekçesi zorunlu — uçta).
    from: FifDurum.KSS_KAYIT_BEKLIYOR, to: FifDurum.TASLAK, etiket: 'Reddet (eksik bilgi)',
    izinli: (c) => kssMi(c),
  },
  {
    // Paket 4: "Sorumlu Bölüm Onayı" — sorumlu bölüm müdürü (snapshot) veya manage,
    // faaliyet izleme sorumlusunu SEÇER ve onaylar → FAALIYET. Kök neden ve faaliyet
    // planlaması FAALIYET'te (izleme sorumlusu + müdür). Müdür reddi/iadesi YOK.
    from: FifDurum.SORUMLU_ATAMA_BEKLIYOR, to: FifDurum.FAALIYET, etiket: 'Sorumlu Bölüm Onayı',
    izinli: (c, s) => esitVeyaManage(c, s.sorumluOnaylayanUserId),
    onKosul: (s) => (s.izlemeSorumlusuUserId ? OK : no('Faaliyet izleme sorumlusu seçilmeli')),
    secim: 'izlemeSorumlusu',
  },
  {
    // KAPANIŞ ZİNCİRİ: FAALIYET → KAPATMA_BEKLIYOR → KSS_KAPANIS_BEKLIYOR → ETKINLIK.
    // Kim gönderir: hub/main gibi (izleme sorumlusu / sorumlu bölüm müdürü / manage).
    // Kalite kararı: en az bir satır ve TÜM satırlar kapatılmış olmalı (Paket 4:
    // KSS "Sonuç Gir" → K). Red sonrası kapalı satırlar kapalı kalır; sonradan eklenen satır da
    // kapatılmadan tekrar gönderilemez. Açık satırda buton PASİF + sebep görünür.
    from: FifDurum.FAALIYET, to: FifDurum.KAPATMA_BEKLIYOR, etiket: 'Kapatmaya Gönder',
    izinli: (c, s) =>
      esitVeyaManage(c, s.izlemeSorumlusuUserId) ||
      (!!c.sorumluBolumMudurUserId && esitVeyaManage(c, c.sorumluBolumMudurUserId)) ||
      c.isManage,
    onKosul: (s) => {
      if (s.faaliyetler.length === 0) return no('En az bir faaliyet satırı gerekli')
      if (!s.faaliyetler.every(satirKapatildiMi)) return no('Tüm faaliyetler kapatılmalı')
      return OK
    },
    pasifGoster: true,
  },
  {
    // ADIM 10 (FAZ B kararı): kapatmayı UYGUNSUZLUĞU AÇAN taraf onaylar.
    // Eskiden sorumlu bölüm müdüründeydi; FAALIYET→KAPATMA_BEKLIYOR geçişini de
    // sorumlu taraf yaptığı için iki adım aynı elde toplanıyor, bağımsız
    // doğrulama kalmıyordu. sorumluOnaylayan "faaliyet tamamlandı" adımında kalır.
    from: FifDurum.KAPATMA_BEKLIYOR, to: FifDurum.KSS_KAPANIS_BEKLIYOR, etiket: 'Kapatmayı Onayla',
    izinli: (c, s) => esitVeyaManage(c, s.yayinlayanOnaylayanUserId),
  },
  {
    from: FifDurum.KAPATMA_BEKLIYOR, to: FifDurum.FAALIYET, etiket: 'Reddet',
    izinli: (c, s) => esitVeyaManage(c, s.yayinlayanOnaylayanUserId),
  },
  {
    // ADIM 9: KSS kapanış kontrolü — yayılım + KYS/risk kararı girildikten sonra
    // etkinlik izlemeye geçer.
    from: FifDurum.KSS_KAPANIS_BEKLIYOR, to: FifDurum.ETKINLIK, etiket: 'Kapanışı Onayla',
    izinli: (c) => kssMi(c),
    onKosul: (s) =>
      s.yayilimVarMi && !(s.yayilimAciklama ?? '').trim()
        ? no('Yayılım "var" işaretli — açıklama zorunlu')
        : OK,
  },
  {
    from: FifDurum.KSS_KAPANIS_BEKLIYOR, to: FifDurum.FAALIYET, etiket: 'Reddet (yeniden faaliyet)',
    izinli: (c) => kssMi(c),
  },
  {
    // YENİ AKIŞ: "Tamamen Kapat" — SADECE KSS; her satır etkinlik kontrolünden
    // "uygun" geçmiş olmalı. Yayılım/KYS kararı bu adımda DEĞİL, KSS kapanış
    // kontrolünde (KSS_KAPANIS_BEKLIYOR → ETKINLIK) verilir — hub/main gibi.
    // ESKİ AKIŞ: FİF geneli iki etkinlik maddesi uygun; KSS veya manage (Paket 2).
    from: FifDurum.ETKINLIK, to: FifDurum.KAPANDI,
    etiket: (s) => (yeniAkisMi(s) ? 'Tamamen Kapat' : 'Kapat (Etkin)'),
    izinli: (c, s) => (yeniAkisMi(s) ? kssMi(c) : kssMi(c) || c.isManage),
    onKosul: (s) => {
      if (yeniAkisMi(s)) {
        return s.faaliyetler.every((f) => f.etkinlikUygun === true)
          ? OK
          : no('Tüm faaliyet satırlarının etkinlik kontrolü "uygun" olmalı')
      }
      const kap = s.etkinlikler.find((e) => e.madde === 'KAPATMA')
      const tek = s.etkinlikler.find((e) => e.madde === 'TEKRAR_ETMEME')
      if (!kap || !tek) return no('İki etkinlik satırı (Kapatma + Tekrar Etmeme) gerekli')
      if (kap.uygun !== true || tek.uygun !== true) return no('Her iki etkinlik de "uygun" olmalı')
      return OK
    },
  },
  {
    // YALNIZ ESKİ AKIŞ (tüm satırlar YT). Yeni akışta "etkin değil" kararı satır
    // bazında verilir (faaliyet etkinlik ucu satırı yeniden açar, FİF'i FAALIYET'e alır).
    from: FifDurum.ETKINLIK, to: FifDurum.FAALIYET, etiket: 'Etkin Değil (Yeniden Aç)',
    izinli: (c, s) => !yeniAkisMi(s) && (kssMi(c) || c.isManage),
    // uygun=false → yeniden açılır; API faaliyet sonuc=YT işaretler.
  },
]

/** IPTAL her durumdan: TASLAK'ta hazırlayan, aksi hâlde yalnız manage. */
function iptalIzinli(ctx: FifGecisCtx, s: FifGecisState): boolean {
  if (ctx.isManage) return true
  if (s.durum === FifDurum.TASLAK) return hazirlayanMi(ctx, s)
  return false
}

/** Ana karar. */
export function gecisYapabilirMi(ctx: FifGecisCtx, s: FifGecisState, hedef: FifDurum): GecisSonuc {
  if (hedef === FifDurum.IPTAL) {
    if (s.durum === FifDurum.KAPANDI) return no('Kapanmış FİF iptal edilemez', 'gecersiz')
    if (s.durum === FifDurum.IPTAL) return no('Zaten iptal', 'gecersiz')
    return iptalIzinli(ctx, s) ? OK : no('İptal yetkiniz yok', 'yetki')
  }
  const kural = FIF_GECISLER.find((g) => g.from === s.durum && g.to === hedef)
  if (!kural) return no(`Geçersiz geçiş: ${s.durum} → ${hedef}`, 'gecersiz')
  if (!kural.izinli(ctx, s)) return no('Bu geçiş için yetkiniz yok', 'yetki')
  if (kural.onKosul) {
    const k = kural.onKosul(s)
    if (!k.ok) return k
  }
  return OK
}

export type UygunGecis = {
  hedef: FifDurum
  etiket: string
  /** Doluysa buton PASİF, sebep gösterilir. */
  pasifSebep?: string
  /** Doluysa buton geçişle birlikte bu seçimi ister (GecisKural.secim). */
  secim?: 'izlemeSorumlusu'
}

/**
 * UI için: bu kullanıcının şu an yapabileceği geçişler (IPTAL dahil). `pasifGoster`
 * kurallarında yetkili kullanıcıya ön koşul eksikken de buton (pasif + sebep) döner.
 */
export function uygunGecisler(ctx: FifGecisCtx, s: FifGecisState): UygunGecis[] {
  const list: UygunGecis[] = []
  for (const g of FIF_GECISLER) {
    if (g.from !== s.durum) continue
    const etiket = typeof g.etiket === 'function' ? g.etiket(s) : g.etiket
    // Seçim isteyen geçiş: yetkiliye her zaman (seçim pencerede yapılır; ön koşulu uç denetler).
    if (g.secim) {
      if (g.izinli(ctx, s)) list.push({ hedef: g.to, etiket, secim: g.secim })
      continue
    }
    const k = gecisYapabilirMi(ctx, s, g.to)
    if (k.ok) list.push({ hedef: g.to, etiket })
    else if (g.pasifGoster && k.tur === 'kosul') list.push({ hedef: g.to, etiket, pasifSebep: k.sebep })
  }
  if (gecisYapabilirMi(ctx, s, FifDurum.IPTAL).ok) list.push({ hedef: FifDurum.IPTAL, etiket: 'İptal Et' })
  return list
}

/** Faaliyet/etkinlik düzenleme kilidi: KAPANDI/IPTAL kilitli; manage her zaman. */
export function altKayitDuzenlenebilir(ctx: FifGecisCtx, durum: FifDurum): boolean {
  if (ctx.isManage) return true
  return durum !== FifDurum.KAPANDI && durum !== FifDurum.IPTAL
}

/** ES (ek süre) faaliyet güncellemesi: FAALIYET durumunda sonuc=ES ise ekTerminNedeni zorunlu. */
export function esKuraliGecerli(durum: FifDurum, sonuc: FifSonuc | null | undefined, ekTerminNedeni: string | null | undefined): GecisSonuc {
  if (sonuc === FifSonuc.ES) {
    if (durum !== FifDurum.FAALIYET) return no('Ek süre (ES) yalnız FAALIYET durumunda verilebilir')
    if (!ekTerminNedeni || !ekTerminNedeni.trim()) return no('Ek süre için ek termin nedeni zorunlu')
  }
  return OK
}


/** ES (ek süre) geçmiş açıklaması — FifGecmis.aciklama için TEK KAYNAK biçim. */
export function esGecmisAciklamasi(eskiTarih: string | null, yeniTarih: string, neden: string): string {
  return `ES: ${eskiTarih ?? '—'} → ${yeniTarih}, neden: ${neden}`
}


/** TASLAK + alt kaydı YOK ise hard delete edilebilir (aksi hâlde IPTAL akışı). */
export function hardDeleteEdilebilir(durum: FifDurum, altKayitVar: boolean): boolean {
  return durum === FifDurum.TASLAK && !altKayitVar
}
