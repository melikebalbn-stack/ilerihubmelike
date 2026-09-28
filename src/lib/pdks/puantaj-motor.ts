/**
 * PDKS Faz 4 — puantaj motoru, SAF ÇEKİRDEK (DB yok; birim testli). Plan §4.
 * DB yükleme / yazma puantaj-servis.ts'te.
 *
 * KURALLAR (Melih, 27.09 — kilitli)
 * - Gün = VARDİYA GÜNÜ: [gün + gunDonumSaat, gün+1 + gunDonumSaat). 21:00→07:00 vardiyasının 07:00
 *   çıkışı başladığı güne yazılır.
 * - Cumartesi ve Pazar normal çalışma günü DEĞİL (HAFTA_SONU). Resmi tatil / yarım gün IproTatil'den
 *   (tek tatil takvimi); IproTatil'in MESAI tipi PDKS'de YOK SAYILIR (üretim anlamı).
 * - Hafta sonu / tatil / akşam mesaisi YALNIZ ONAYLI mesai formundan; hesap FORM esaslı, fiili turnike
 *   süresi yanında gösterilir. Saatsiz tam gün form süresi = vardiya süresi − düşülen molalar.
 * - İlk GİRİŞ / son ÇIKIŞ. Geç / erken: toleransı AŞAN durumda başlangıçtan itibaren TAM dakika
 *   (başlamış dakika sayılır); tam tolerans sınırı geç SAYILMAZ.
 * - Net çalışma (çalışma günü) = [max(ilk giriş, vardiya başı), min(son çıkış, vardiya sonu)] − düşülür
 *   molalar. Vardiya DIŞINDA geçen süre (erken gelme, geç kalma) çalışma SAYILMAZ; ek süre yalnız
 *   onaylı mesai formundan eklenir (form esaslı). fiiliDakika = ham turnike süresi, yanında gösterilir.
 * - Kart okutamama formu YALNIZ onayDurumu=ONAYLANDI VE ivOnaylandi=true ise eksik tarafı tamamlar
 *   (TAM_FORMLA). Cihaz okutması varsa cihaz kazanır, formla çelişki uyarı olur.
 * - pdks_gecis_sensoru_zorunlu=true → yalnız "geçti" sensörüne bağlı okutmalar sayılır.
 * - İzin (İzin Faz 3, kural sürümü 2): onaylı TAM gün izin → IZINLI (gelmedi SAYILMAZ, beklenen saat yok;
 *   izinli günde okutma varsa IZINLI_GUNDE_GECIS uyarısı). YARIM gün izin → beklenen aralık kısalır
 *   (sabah izni: yarım gün bitişi → vardiya sonu; öğleden sonra izni: vardiya başı → yarım gün bitişi), durum
 *   normal hesaplanır, YARIM_GUN_IZINLI uyarısı + izinPay 0,5. İzin kaydı yoksa gelmeyen GELMEDI + IZIN_BILGISI_YOK.
 *   Etiket yalnız "İzinli" gibi PDKS etiketidir — tür adı motora hiç gelmez.
 * - Saatlik izin (İzin Faz 4, kural sürümü 3 — MAZERET): onaylı saat aralığı vardiya BAŞINI kapsıyorsa beklenen
 *   başlangıç aralık sonuna, vardiya SONUNU kapsıyorsa beklenen bitiş aralık başına kayar → geç giriş / erken çıkış
 *   o kadar düşülür. Ortadaki aralık yalnız not. Uyarı MAZERET_DK:<toplam dk> ("Mazeret X sa").
 */

export const KURAL_SURUMU = 3

export type PuantajDurum =
  | 'TAM'
  | 'TAM_FORMLA'
  | 'EKSIK_GIRIS'
  | 'EKSIK_CIKIS'
  | 'GELMEDI'
  | 'TATIL'
  | 'HAFTA_SONU'
  | 'MESAI'
  | 'IZINLI'
  | 'BEKLENMIYOR'

export type TakvimTipi = 'CALISMA' | 'HAFTA_SONU' | 'TATIL' | 'YARIM'

export interface MolaTanim {
  tur: 'YEMEK' | 'CAY'
  baslangic: string // "HH:mm"
  bitis: string
  dusulur: boolean
  departmentId: string | null
  aktif?: boolean
}

export interface VardiyaTanim {
  id: string
  kod: string
  girisSaat: string
  cikisSaat: string
  gunDonumSaat: string
  gecToleransDk: number
  erkenToleransDk: number
  molalar: MolaTanim[]
}

export interface GecisGirdi {
  id: string
  zaman: Date
  yon: 'GIRIS' | 'CIKIS' | null
  /** Sensörle bağlı mı ("geçti" olayı bu okutmaya bağlanmış) */
  sensorBagli: boolean
}

export interface KartOkutamamaGirdi {
  id: string
  girisSaati: string | null
  cikisSaati: string | null
  onayDurumu: 'BEKLIYOR' | 'ONAYLANDI' | 'REDDEDILDI'
  ivOnaylandi: boolean
}

export interface MesaiGirdi {
  overtimePersonnelId: string
  isFullDay: boolean
  startTime: string | null
  endTime: string | null
}

export interface PuantajGirdi {
  gun: string // "YYYY-MM-DD" (vardiya günü)
  vardiya: VardiyaTanim
  vardiyaKaynak: 'ATAMA' | 'VARSAYILAN'
  departmentId: string | null
  takvim: TakvimTipi
  /** İşe giriş (yerel gün) — bu günden önceki günler BEKLENMIYOR. */
  iseGiris: string | null
  /** Kişinin geçişleri — yalnız GECERLI_KART, herhangi bir geniş pencere (motor vardiya gününe süzer). */
  gecisler: GecisGirdi[]
  kartFormlari: KartOkutamamaGirdi[]
  mesaiFormlari: MesaiGirdi[]
  ayarlar: { sensorZorunlu: boolean; yarimGunBitis: string }
  /** Onaylı izin günü (İzin modülü). null = izin yok. */
  izin: IzinGunuGirdi | null
  simdi: Date
}

export interface PuantajSonucu {
  durum: PuantajDurum
  vardiyaId: string
  vardiyaKaynak: 'ATAMA' | 'VARSAYILAN'
  beklenenBaslangic: Date | null
  beklenenBitis: Date | null
  ilkGiris: Date | null
  sonCikis: Date | null
  ilkGirisGecisId: string | null
  sonCikisGecisId: string | null
  girisKaynak: 'CIHAZ' | 'FORM' | null
  cikisKaynak: 'CIHAZ' | 'FORM' | null
  kartOkutamamaId: string | null
  gecDakika: number
  erkenCikisDakika: number
  fiiliDakika: number | null
  dusulenMolaDakika: number | null
  calismaDakika: number | null
  onayliMesaiDakika: number | null
  mesaiPersonelId: string | null
  fazlaDakika: number | null
  izinTalepId: string | null
  izinPay: number | null
  izinEtiketi: string | null
  uyarilar: string[]
}

export interface IzinGunuGirdi {
  izinli: boolean
  /** null = tam gün; SABAH = sabah izinli (öğleden sonra çalışır); OGLEDEN_SONRA = öğleden sonra izinli */
  yarim?: 'SABAH' | 'OGLEDEN_SONRA' | null
  talepId?: string
  pay?: number
  /** PDKS etiketi ("İzinli") — tür adı DEĞİL */
  etiket?: string
  /** Faz 4: onaylı SAATLİK izin aralıkları ("HH:mm") — izinli=false olabilir (yalnız saatlik) */
  saatlik?: { bas: string; bit: string; dakika: number }[]
}

// ── Zaman (Europe/Istanbul, +03:00 sabit — Türkiye 2016'dan beri DST yok) ────

const OFSET_MS = 3 * 3600_000
const dk = (hhmm: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!m) throw new Error(`saat "HH:mm" olmalı: ${hhmm}`)
  return Number(m[1]) * 60 + Number(m[2])
}
/** "YYYY-MM-DD" + "HH:mm" (+ gün ekle) → UTC Date */
export function yerel(gun: string, hhmm: string, gunEkle = 0): Date {
  const [y, a, g] = gun.split('-').map(Number)
  return new Date(Date.UTC(y, a - 1, g + gunEkle) + dk(hhmm) * 60_000 - OFSET_MS)
}
/** Vardiya gününe ait saat: gün dönümünden ÖNCEKİ saatler ertesi takvim gününe düşer. */
function vardiyaSaati(gun: string, hhmm: string, gunDonum: string): Date {
  return yerel(gun, hhmm, dk(hhmm) < dk(gunDonum) ? 1 : 0)
}
const dakikaFark = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 60_000)
const baslamisDakika = (a: Date, b: Date) => Math.ceil((b.getTime() - a.getTime()) / 60_000)

/** Vardiya günü penceresi [bas, bit). */
export function vardiyaGunuPenceresi(gun: string, v: Pick<VardiyaTanim, 'gunDonumSaat'>): { bas: Date; bit: Date } {
  return { bas: yerel(gun, v.gunDonumSaat), bit: yerel(gun, v.gunDonumSaat, 1) }
}

/** Beklenen başlangıç/bitiş (çıkış girişten küçük/eşitse ertesi güne taşar). */
export function beklenenAralik(gun: string, v: VardiyaTanim): { bas: Date; bit: Date } {
  const bas = vardiyaSaati(gun, v.girisSaat, v.gunDonumSaat)
  let bit = vardiyaSaati(gun, v.cikisSaat, v.gunDonumSaat)
  if (bit <= bas) bit = new Date(bit.getTime() + 24 * 3600_000)
  return { bas, bit }
}

/** Kişiye uygulanan molalar: bir türde kişinin BÖLÜMÜNE özel satır varsa genel satırı ezer. */
export function uygulananMolalar(molalar: MolaTanim[], departmentId: string | null): MolaTanim[] {
  const aktif = molalar.filter((m) => m.aktif !== false)
  const sonuc: MolaTanim[] = []
  for (const tur of ['YEMEK', 'CAY'] as const) {
    const ozel = aktif.filter((m) => m.tur === tur && departmentId !== null && m.departmentId === departmentId)
    sonuc.push(...(ozel.length ? ozel : aktif.filter((m) => m.tur === tur && m.departmentId === null)))
  }
  return sonuc
}

/** [a, b) ile vardiya günündeki düşülür molaların kesişimi (dakika). */
export function dusulenMola(gun: string, v: VardiyaTanim, molalar: MolaTanim[], a: Date, b: Date): number {
  let top = 0
  for (const m of molalar) {
    if (!m.dusulur) continue
    const mb = vardiyaSaati(gun, m.baslangic, v.gunDonumSaat)
    let me = vardiyaSaati(gun, m.bitis, v.gunDonumSaat)
    if (me <= mb) me = new Date(me.getTime() + 24 * 3600_000)
    const s = Math.max(a.getTime(), mb.getTime())
    const e = Math.min(b.getTime(), me.getTime())
    if (e > s) top += Math.floor((e - s) / 60_000)
  }
  return top
}

export const kartFormuOnayliMi = (f: KartOkutamamaGirdi) => f.onayDurumu === 'ONAYLANDI' && f.ivOnaylandi

// ── Hesap ────────────────────────────────────────────────────────────────────

export function puantajHesapla(g: PuantajGirdi): PuantajSonucu {
  const v = g.vardiya
  const uyarilar: string[] = []
  const pencere = vardiyaGunuPenceresi(g.gun, v)
  const molalar = uygulananMolalar(v.molalar, g.departmentId)
  const bos: PuantajSonucu = {
    durum: 'BEKLENMIYOR', vardiyaId: v.id, vardiyaKaynak: g.vardiyaKaynak, beklenenBaslangic: null, beklenenBitis: null,
    ilkGiris: null, sonCikis: null, ilkGirisGecisId: null, sonCikisGecisId: null, girisKaynak: null, cikisKaynak: null,
    kartOkutamamaId: null, gecDakika: 0, erkenCikisDakika: 0, fiiliDakika: null, dusulenMolaDakika: null, calismaDakika: null,
    onayliMesaiDakika: null, mesaiPersonelId: null, fazlaDakika: null, izinTalepId: null, izinPay: null, izinEtiketi: null, uyarilar,
  }
  if (g.iseGiris && g.gun < g.iseGiris) return { ...bos, uyarilar: ['ISE_GIRIS_ONCESI'] }

  // 1. Geçişler — vardiya günü penceresi + sensör kuralı
  const gecerli = g.gecisler
    .filter((x) => x.zaman >= pencere.bas && x.zaman < pencere.bit)
    .filter((x) => !g.ayarlar.sensorZorunlu || x.sensorBagli)
    .sort((a, b) => a.zaman.getTime() - b.zaman.getTime())
  if (g.ayarlar.sensorZorunlu) {
    const atilan = g.gecisler.filter((x) => x.zaman >= pencere.bas && x.zaman < pencere.bit && !x.sensorBagli).length
    if (atilan) uyarilar.push(`SENSORSUZ_OKUTMA_SAYILMADI:${atilan}`)
  }
  const ilkG = gecerli.find((x) => x.yon === 'GIRIS') ?? null
  const cikislar = gecerli.filter((x) => x.yon === 'CIKIS' && (!ilkG || x.zaman > ilkG.zaman))
  const sonC = cikislar.at(-1) ?? null

  let ilkGiris = ilkG?.zaman ?? null
  let sonCikis = sonC?.zaman ?? null
  let girisKaynak: PuantajSonucu['girisKaynak'] = ilkG ? 'CIHAZ' : null
  let cikisKaynak: PuantajSonucu['cikisKaynak'] = sonC ? 'CIHAZ' : null
  let kartOkutamamaId: string | null = null

  // 2. Kart okutamama formu — yalnız TAM onaylı (müdür + İV) eksik tarafı tamamlar
  const onayli = g.kartFormlari.find(kartFormuOnayliMi)
  const onaysiz = g.kartFormlari.filter((f) => !kartFormuOnayliMi(f) && f.onayDurumu !== 'REDDEDILDI')
  if (onayli) {
    if (!ilkGiris && onayli.girisSaati) {
      ilkGiris = vardiyaSaati(g.gun, onayli.girisSaati, v.gunDonumSaat)
      girisKaynak = 'FORM'
      kartOkutamamaId = onayli.id
    } else if (ilkGiris && onayli.girisSaati) uyarilar.push('FORM_CIHAZ_CELISKI_GIRIS')
    if (!sonCikis && onayli.cikisSaati) {
      sonCikis = vardiyaSaati(g.gun, onayli.cikisSaati, v.gunDonumSaat)
      cikisKaynak = 'FORM'
      kartOkutamamaId = onayli.id
    } else if (sonCikis && onayli.cikisSaati) uyarilar.push('FORM_CIHAZ_CELISKI_CIKIS')
  }
  if (onaysiz.length && (!ilkGiris || !sonCikis)) uyarilar.push('KART_OKUTAMAMA_ONAY_BEKLIYOR')

  // 3. Süreler
  const fiiliDakika = ilkGiris && sonCikis && sonCikis > ilkGiris ? dakikaFark(ilkGiris, sonCikis) : null
  const dusulenMolaDakika = fiiliDakika !== null ? dusulenMola(g.gun, v, molalar, ilkGiris!, sonCikis!) : null
  const netDakika = fiiliDakika !== null ? fiiliDakika - (dusulenMolaDakika ?? 0) : null

  const ortak = {
    ...bos, ilkGiris, sonCikis, ilkGirisGecisId: girisKaynak === 'CIHAZ' ? ilkG!.id : null,
    sonCikisGecisId: cikisKaynak === 'CIHAZ' ? sonC!.id : null, girisKaynak, cikisKaynak, kartOkutamamaId,
    fiiliDakika, dusulenMolaDakika,
  }

  // 4. Onaylı mesai formu süresi (form esaslı)
  const form = g.mesaiFormlari[0] ?? null
  if (g.mesaiFormlari.length > 1) uyarilar.push('BIRDEN_FAZLA_MESAI_FORMU')
  let formDakika: number | null = null
  if (form) {
    let fa: Date
    let fb: Date
    if (form.startTime && form.endTime) {
      fa = vardiyaSaati(g.gun, form.startTime, v.gunDonumSaat)
      fb = vardiyaSaati(g.gun, form.endTime, v.gunDonumSaat)
      if (fb <= fa) fb = new Date(fb.getTime() + 24 * 3600_000)
    } else {
      const b = beklenenAralik(g.gun, v) // saatsiz tam gün = kişinin vardiyası
      fa = b.bas
      fb = b.bit
    }
    formDakika = dakikaFark(fa, fb) - dusulenMola(g.gun, v, molalar, fa, fb)
  }

  // 5. Çalışılmayan gün (hafta sonu / tatil): yalnız onaylı mesai formu çalışma sayılır
  if (g.takvim === 'HAFTA_SONU' || g.takvim === 'TATIL') {
    if (form) {
      return { ...ortak, durum: 'MESAI', onayliMesaiDakika: formDakika, calismaDakika: formDakika, mesaiPersonelId: form.overtimePersonnelId,
        uyarilar: fiiliDakika === null ? [...uyarilar, 'MESAI_FORMU_VAR_TURNIKE_YOK'] : uyarilar }
    }
    if (gecerli.length) uyarilar.push('ONAYSIZ_GUNDE_GECIS')
    return { ...ortak, durum: g.takvim, calismaDakika: null, uyarilar }
  }

  // 6. Çalışma günü (ya da yarım gün)
  const beklenen = beklenenAralik(g.gun, v)
  const yb = vardiyaSaati(g.gun, g.ayarlar.yarimGunBitis, v.gunDonumSaat)
  const ybIcinde = yb > beklenen.bas && yb < beklenen.bit
  if (g.takvim === 'YARIM' && ybIcinde) beklenen.bit = yb
  // 6a. Onaylı izin: yarım gün beklenen aralığı kısaltır; beklenen aralık kalmazsa (tam gün ya da yarım
  // tatil gününün sabahı) gün IZINLI olur.
  const izin = g.izin?.izinli ? g.izin : null
  const izinAlanlari = izin
    ? { izinTalepId: izin.talepId ?? null, izinPay: izin.pay ?? (izin.yarim ? 0.5 : 1), izinEtiketi: izin.etiket ?? 'İzinli' }
    : {}
  let tamIzin = !!izin && !izin.yarim
  if (izin?.yarim && ybIcinde) {
    if (izin.yarim === 'SABAH') beklenen.bas = yb
    else beklenen.bit = yb
    if (beklenen.bit <= beklenen.bas) tamIzin = true
  } else if (izin?.yarim && g.takvim === 'YARIM' && izin.yarim === 'SABAH') tamIzin = true
  if (tamIzin) {
    return {
      ...ortak, ...izinAlanlari, durum: 'IZINLI', calismaDakika: null,
      uyarilar: gecerli.length ? [...uyarilar, 'IZINLI_GUNDE_GECIS'] : uyarilar,
    }
  }
  if (izin?.yarim) uyarilar.push('YARIM_GUN_IZINLI')
  // 6b. Saatlik izin (MAZERET): vardiya başını / sonunu kapsayan aralık beklenen aralığı kısaltır.
  const saatlik = g.izin?.saatlik ?? []
  if (saatlik.length) {
    for (const a of saatlik) {
      const ab = vardiyaSaati(g.gun, a.bas, v.gunDonumSaat)
      const at = vardiyaSaati(g.gun, a.bit, v.gunDonumSaat)
      if (ab <= beklenen.bas && at > beklenen.bas && at < beklenen.bit) beklenen.bas = at
      else if (at >= beklenen.bit && ab > beklenen.bas && ab < beklenen.bit) beklenen.bit = ab
    }
    uyarilar.push(`MAZERET_DK:${saatlik.reduce((t, a) => t + a.dakika, 0)}`)
  }
  // Normal çalışma vardiya penceresine kırpılır — vardiya dışı süre yalnız mesai formuyla sayılır.
  let normalNet: number | null = null
  if (ilkGiris && sonCikis && sonCikis > ilkGiris) {
    const a = ilkGiris > beklenen.bas ? ilkGiris : beklenen.bas
    const b = sonCikis < beklenen.bit ? sonCikis : beklenen.bit
    normalNet = b > a ? dakikaFark(a, b) - dusulenMola(g.gun, v, molalar, a, b) : 0
  }
  const sonuc: PuantajSonucu = {
    ...ortak, ...izinAlanlari, beklenenBaslangic: beklenen.bas, beklenenBitis: beklenen.bit, calismaDakika: normalNet,
    onayliMesaiDakika: formDakika, mesaiPersonelId: form?.overtimePersonnelId ?? null, durum: 'GELMEDI',
  }
  if (form) sonuc.calismaDakika = (normalNet ?? 0) + (formDakika ?? 0) // akşam mesaisi: normal (kırpılmış) + form süresi

  if (ilkGiris && ilkGiris.getTime() - beklenen.bas.getTime() > v.gecToleransDk * 60_000) {
    sonuc.gecDakika = baslamisDakika(beklenen.bas, ilkGiris)
  }
  // Onaylı akşam mesaisi varsa normal bitiş sonrası çıkış doğal; erken çıkış yine vardiya bitişine göre.
  if (sonCikis && beklenen.bit.getTime() - sonCikis.getTime() > v.erkenToleransDk * 60_000) {
    sonuc.erkenCikisDakika = baslamisDakika(sonCikis, beklenen.bit)
  }
  if (sonCikis && sonCikis > beklenen.bit) {
    sonuc.fazlaDakika = dakikaFark(beklenen.bit, sonCikis)
    if (!form && sonuc.fazlaDakika > 30) uyarilar.push('ONAYSIZ_FAZLA')
  }
  if (form && fiiliDakika === null) uyarilar.push('MESAI_FORMU_VAR_TURNIKE_YOK')

  const gunSuruyor = g.simdi < pencere.bit
  if (ilkGiris && sonCikis) sonuc.durum = girisKaynak === 'FORM' || cikisKaynak === 'FORM' ? 'TAM_FORMLA' : 'TAM'
  else if (ilkGiris) {
    sonuc.durum = 'EKSIK_CIKIS'
    if (gunSuruyor) uyarilar.push('GUN_SURUYOR')
  } else if (sonCikis) sonuc.durum = 'EKSIK_GIRIS'
  else {
    sonuc.durum = 'GELMEDI'
    if (!izin) uyarilar.push('IZIN_BILGISI_YOK')
    if (gunSuruyor) uyarilar.push('GUN_SURUYOR')
  }
  if (sonuc.durum === 'EKSIK_GIRIS' || sonuc.durum === 'EKSIK_CIKIS') sonuc.calismaDakika = form ? formDakika : null
  return sonuc
}

// ── Takvim ───────────────────────────────────────────────────────────────────

/** PDKS takvimi: IproTatil istisnası (TATIL / YARIM; MESAI tipi YOK SAYILIR) + Cumartesi/Pazar hafta sonu. */
export function pdksTakvimTipi(gun: string, iproTatilTip: string | null): TakvimTipi {
  if (iproTatilTip === 'TATIL') return 'TATIL'
  const hg = new Date(`${gun}T12:00:00Z`).getUTCDay() // 0 Pazar, 6 Cumartesi
  if (hg === 0 || hg === 6) return 'HAFTA_SONU'
  if (iproTatilTip === 'YARIM') return 'YARIM'
  return 'CALISMA'
}

/** İzin kaynağı arayüzü — uygulaması src/lib/izin/pdks-izin-kaynagi.ts (onaylı IzinTalepGun). */
export interface IzinKaynagi {
  izinDurumlari(personnelIdleri: string[], gun: string): Promise<Map<string, IzinGunuGirdi>>
}
export const bosIzinKaynagi: IzinKaynagi = { izinDurumlari: async () => new Map() }
