/**
 * FİF (KAL-FR-10) faaliyet termin/gecikme hesapları — SAF, istemci + sunucu ortak.
 *
 * GÜN = İSTANBUL TAKVİM GÜNÜ. Tarih girişleri (date input "YYYY-MM-DD") DB'ye
 * UTC gece yarısı olarak yazılır; "bugün" ise İstanbul'a göre alınır. İkisi
 * aynı anahtara (YYYY-MM-DD) indirgenip gün farkı UTC takviminde sayılır —
 * saat/offset kaymaları sonucu değiştirmez.
 */

type TarihGirdisi = Date | string

const GUN_BICIM = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
})

/** Bir anın İstanbul takvim günü: 'YYYY-MM-DD'. */
export function istanbulGunu(an: TarihGirdisi): string {
  return GUN_BICIM.format(new Date(an))
}

function anahtarUtc(gun: string): number {
  const [y, m, d] = gun.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** b − a (İstanbul günü). Pozitif = b daha sonra. */
export function gunFarki(a: TarihGirdisi, b: TarihGirdisi): number {
  return Math.round((anahtarUtc(istanbulGunu(b)) - anahtarUtc(istanbulGunu(a))) / 86400000)
}

/** İstanbul'daki bugünü DB tarih biçiminde (UTC gece yarısı) döndür — gerçekleşen tarih için. */
export function istanbulBugunTarihi(simdi: Date): Date {
  return new Date(anahtarUtc(istanbulGunu(simdi)))
}

/**
 * Takvim ayı ekle (UTC gün bazında). Ay sonu taşması kırpılır:
 * 30 Kasım + 3 ay = 28/29 Şubat (1–2 Mart'a taşmaz).
 */
export function ayEkle(tarih: Date, ay: number): Date {
  const y = tarih.getUTCFullYear()
  const m = tarih.getUTCMonth() + ay
  const hedefAySonu = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m, Math.min(tarih.getUTCDate(), hedefAySonu)))
}

/** Faaliyet kapatma → etkinlik kontrolü aralığı (ay). */
export const FIF_ETKINLIK_AY = 3

type FaaliyetTermin = {
  hedefTarih: TarihGirdisi | null
  ilkHedefTarih?: TarihGirdisi | null
  gerceklesenTarih: TarihGirdisi | null
  sonuc: string | null
}

/** Satır kapalı mı: KSS "Sonuç Gir" → K (sonuc=K + gerçekleşen tarih). YT satır AÇIKTIR. */
export function faaliyetKapaliMi(f: Pick<FaaliyetTermin, 'sonuc' | 'gerceklesenTarih'>): boolean {
  return f.sonuc === 'K' && !!f.gerceklesenTarih
}

export type TerminEtiketi = { metin: string; ton: 'basari' | 'uyari' | 'tehlike' }

/**
 * Satırın termin rozetleri.
 *  · Kapalı: "Zamanında" | "Hedeften X gün geç"; ilk hedef farklıysa ayrıca
 *    "İlk hedeften X gün geç" (ek terminle kaydırılmış gecikmeyi gizlememek için).
 *  · Açık ve bugün > hedef: "X gün gecikmede".
 */
export function faaliyetTerminEtiketleri(f: FaaliyetTermin, simdi: Date): TerminEtiketi[] {
  if (!f.hedefTarih) return []
  if (faaliyetKapaliMi(f)) {
    const bitis = f.gerceklesenTarih as TarihGirdisi
    const etiketler: TerminEtiketi[] = []
    const gec = gunFarki(f.hedefTarih, bitis)
    etiketler.push(gec > 0 ? { metin: `Hedeften ${gec} gün geç`, ton: 'tehlike' } : { metin: 'Zamanında', ton: 'basari' })
    if (f.ilkHedefTarih && istanbulGunu(f.ilkHedefTarih) !== istanbulGunu(f.hedefTarih)) {
      const ilkGec = gunFarki(f.ilkHedefTarih, bitis)
      if (ilkGec > 0) etiketler.push({ metin: `İlk hedeften ${ilkGec} gün geç`, ton: 'uyari' })
    }
    return etiketler
  }
  const gecikme = gunFarki(f.hedefTarih, simdi)
  return gecikme > 0 ? [{ metin: `${gecikme} gün gecikmede`, ton: 'tehlike' }] : []
}

// ── Paket 3b-2: açık satır filtresi, etkinlik penceresi, "kimde bekliyor" ──

/**
 * Prisma where parçası: AÇIK (kapatılmamış) faaliyet satırı — faaliyetKapaliMi'nin
 * tersi, NULL'lar açıkça (SQL'de NOT(sonuc='K' AND …) NULL satırı dışarıda bırakır).
 * Hatırlatma/eskalasyon ve satır kapatma sorguları AYNI tanımı kullanır.
 */
export const ACIK_FAALIYET_WHERE = {
  OR: [{ sonuc: null }, { sonuc: { not: 'K' as const } }, { gerceklesenTarih: null }],
}

/**
 * Termin TAKİBİNDEKİ satır: açık VE onay bekleyen ek termin talebi YOK. Talep
 * KSS'deyken hedef tarih hatırlatması/eskalasyon DURUR (top KSS'de; KSS'ye ayrıca
 * bekleyen talep hatırlatması gider). Karar verilince satır takibe geri döner.
 */
export const TAKIPTEKI_FAALIYET_WHERE = {
  ...ACIK_FAALIYET_WHERE,
  ekTerminler: { none: { durum: 'BEKLIYOR' as const } },
}

/** Etkinlik kontrolü plan tarihinden kaç gün ÖNCE açılır / hatırlatılır. */
export const FIF_ETKINLIK_ERKEN_GUN = 7

/** Etkinlik kontrolü yapılabilir mi: plan dolu ve bugün ≥ plan − 7 gün (İstanbul günü). */
export function etkinlikKontrolAcikMi(plan: TarihGirdisi | null | undefined, simdi: Date): boolean {
  return !!plan && gunFarki(plan, simdi) >= -FIF_ETKINLIK_ERKEN_GUN
}

/** Satırın "kimde bekliyor" rozeti için gereken bilgiler. */
export type SatirDurumGirdi = {
  sonuc: string | null
  gerceklesenTarih: TarihGirdisi | null
  etkinlikPlanTarihi: TarihGirdisi | null
  etkinlikUygun: boolean | null
  bekleyenTalep: boolean
  sorumluAd: string | null
}

const trTarih = (t: TarihGirdisi) =>
  new Date(t).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })

/**
 * Satır durum rozeti — öncelik sırasıyla:
 *   Etkin ✓ · Etkinlik kontrolü bekliyor — {plan} · Kapatıldı (eski akış) ·
 *   Ek termin onayı bekliyor — KSS · Yapılamadı (YT) — {sorumlu} · Açık — {sorumlu}
 * Paket 4: YT (KSS "Sonuç Gir" → yapılamadı) satır açık kalır, ayrı rozetle görünür.
 */
export function faaliyetDurumu(f: SatirDurumGirdi): TerminEtiketi {
  if (faaliyetKapaliMi(f)) {
    if (f.etkinlikUygun === true) return { metin: 'Etkin ✓', ton: 'basari' }
    if (f.etkinlikPlanTarihi) return { metin: `Etkinlik kontrolü bekliyor — ${trTarih(f.etkinlikPlanTarihi)}`, ton: 'uyari' }
    return { metin: 'Kapatıldı', ton: 'basari' }
  }
  if (f.bekleyenTalep) return { metin: 'Ek termin onayı bekliyor — KSS', ton: 'uyari' }
  if (f.sonuc === 'YT') return { metin: `Yapılamadı (YT) — ${f.sorumluAd ?? 'sorumlu atanmamış'}`, ton: 'tehlike' }
  return { metin: `Açık — ${f.sorumluAd ?? 'sorumlu atanmamış'}`, ton: 'uyari' }
}

/** FİF başlığı "kimde bekliyor" girdisi (adlar sunucuda çözülür). */
export type FifBekleyenGirdi = {
  durum: string
  /** Satırların hepsi faaliyet bazlı etkinlik planı taşıyor mu (fif-durum.yeniAkisMi). */
  yeniAkis: boolean
  hazirlayanAd: string | null
  yayinlayanOnaylayanAd: string | null
  /** Paket 4: sorumlu bölüm müdürü (zincir snapshot'ı) — SORUMLU_ATAMA_BEKLIYOR. */
  sorumluOnaylayanAd?: string | null
  /** Paket 4: faaliyet izleme sorumlusu — FAALIYET'te planlamayı müdürle birlikte yapar; boşsa yalnız müdür. */
  izlemeAd?: string | null
  /** Paket 4: kök neden dolu mu (fif-durum.kokNedenDoluMu). Verilmezse kök neden adımı gösterilmez. */
  kokNedenDolu?: boolean
  satirlar: SatirDurumGirdi[]
}

/**
 * FİF'in şu anki adımının KİMDE beklediği — başlıkta gösterilir. Durumun kendisi
 * rozetle ayrıca görünür; burası yalnız "kim / ne bekleniyor" metnini üretir.
 */
export function fifKimdeBekliyor(f: FifBekleyenGirdi, simdi: Date): string {
  const acik = f.satirlar.filter((s) => !faaliyetKapaliMi(s))
  const kapali = f.satirlar.filter((s) => faaliyetKapaliMi(s))
  const etkinlikBekleyen = kapali.filter((s) => s.etkinlikPlanTarihi && s.etkinlikUygun !== true)
  const benzersiz = (adlar: (string | null)[]) => [...new Set(adlar.map((a) => a ?? 'sorumlu atanmamış'))].join(', ')

  switch (f.durum) {
    case 'TASLAK':
      return `Hazırlayan — ${f.hazirlayanAd ?? '—'} (Onaya Gönder)`
    case 'ONAY_BEKLIYOR':
    case 'KAPATMA_BEKLIYOR':
      return `Yayınlayan bölüm müdürü — ${f.yayinlayanOnaylayanAd ?? 'tanımsız'}`
    case 'KSS_KAYIT_BEKLIYOR':
      return 'KSS — kayda alma'
    case 'SORUMLU_ATAMA_BEKLIYOR':
      return `Sorumlu bölüm müdürü — ${f.sorumluOnaylayanAd ?? 'tanımsız'} (izleme sorumlusu seçimi + Sorumlu Bölüm Onayı)`
    case 'KSS_KAPANIS_BEKLIYOR':
      return 'KSS — kapanış kontrolü'
    case 'FAALIYET': {
      const parcalar: string[] = []
      // Paket 4: planlama (kök neden → satırlar → uygulama sorumlusu) izleme sorumlusu
      // ve sorumlu bölüm müdüründe. İzleme sorumlusu boşsa (onay sonrası boşaltılabilir)
      // yalnız sorumlu bölüm müdürü gösterilir.
      const planlayan = f.izlemeAd
        ? `İzleme sorumlusu (${f.izlemeAd}) / sorumlu bölüm müdürü`
        : `Sorumlu bölüm müdürü${f.sorumluOnaylayanAd ? ` (${f.sorumluOnaylayanAd})` : ''}`
      if (f.kokNedenDolu === false) parcalar.push(`${planlayan} — kök neden analizi`)
      else if (f.kokNedenDolu === true && f.satirlar.length === 0) parcalar.push(`${planlayan} — faaliyet planı`)
      const talepli = acik.filter((s) => s.bekleyenTalep)
      const talepsiz = acik.filter((s) => !s.bekleyenTalep)
      // Paket 4: sorumlusuz açık satır planlayanda; atanmış açık satır uygulama
      // sorumlusunda, sonucunu KSS girer.
      const atanmamis = talepsiz.filter((s) => !s.sorumluAd)
      const atanmis = talepsiz.filter((s) => s.sorumluAd)
      if (atanmamis.length) parcalar.push(`${planlayan} — ${atanmamis.length} satıra sorumlu ataması`)
      if (atanmis.length) parcalar.push(`Satır sorumluları — ${benzersiz(atanmis.map((s) => s.sorumluAd))} (sonucu KSS girer)`)
      if (talepli.length) parcalar.push(`KSS — ${talepli.length} ek termin onayı`)
      // Kapanış zinciri (hub/main): satırlar bitince "Kapatmaya Gönder" izleme
      // sorumlusunda / sorumlu bölüm müdüründe.
      if (f.satirlar.length > 0 && acik.length === 0) parcalar.push(`${planlayan} — Kapatmaya Gönder`)
      const kontrolAcik = etkinlikBekleyen.filter((s) => etkinlikKontrolAcikMi(s.etkinlikPlanTarihi, simdi))
      if (kontrolAcik.length) parcalar.push(`KSS — ${kontrolAcik.length} etkinlik kontrolü`)
      return parcalar.length ? parcalar.join(' · ') : 'Faaliyet satırı bekleniyor'
    }
    case 'ETKINLIK': {
      if (!f.yeniAkis) return 'KSS — etkinlik değerlendirmesi (FİF geneli)'
      if (etkinlikBekleyen.length === 0) return 'KSS — Tamamen Kapat'
      const enYakin = etkinlikBekleyen
        .map((s) => new Date(s.etkinlikPlanTarihi as TarihGirdisi))
        .sort((a, b) => a.getTime() - b.getTime())[0]
      return `KSS — ${etkinlikBekleyen.length} etkinlik kontrolü (en yakın: ${trTarih(enYakin)})`
    }
    default:
      return '—'
  }
}
