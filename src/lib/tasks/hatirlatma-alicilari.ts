/**
 * Planlı görev hatırlatması — ALICI LİSTESİ TEK KAYNAĞI (08.10.2026).
 *
 * OLAY: hatırlatma maili `CalibrationNotificationEmail` tablosundan besleniyordu —
 * yani KALİBRASYON bildirim listesi, planlı görev hatırlatması için yeniden
 * kullanılmış. Prod'da o tabloda 6 aktif satır / 3 tekil adres vardı (her adres
 * mükerrer girilmiş), sonuç: görevle ilgisi olmayan üç kişiye, her birine İKİ KEZ
 * yazılmış bir mail. Sorumluya ise AYRI bir "kişisel" mail gidiyordu; iki gönderim
 * birbirinden bağımsızdı ve gövdedeki "Sorumlu:" satırı TO ile tutmuyordu.
 *
 * KURAL (Melih, 08.10.2026):
 *   TO = görevin sorumluları: responsiblePersonEmail ∪ responsiblePersons[].email
 *   CC = YOK. Admin / geliştirici / sistem rolleri ALICI OLAMAZ.
 *   Görevi oluşturan kişi sorumlu değilse alıcı değildir.
 *
 * Bu modül SAF: DB'ye gitmez, rol/izin bilmez, yalnız görev kaydını okur. Admin
 * listesi diye bir girdisi OLMADIĞI için admin kimsenin listeye sızması mümkün
 * değil — kapı burada yapısal.
 *
 * KAPSAM DIŞI BIRAKILANLAR (bilinçli):
 *   · PlannedTask.notificationEmails — kurala göre CC yok; bu alan hatırlatmada
 *     KULLANILMAZ (görev oluşturma bildirimi onu ayrıca kullanıyor).
 *   · responsibleDepartment(s) — bölüme atanmış görevin kişi alıcısı yoktur;
 *     sorumlu çözülemeyen görev sayılır ve özet rapora düşer.
 */

export type HatirlatmaGorevi = {
  responsiblePerson?: string | null
  responsiblePersonEmail?: string | null
  /** JSON metin: [{name, email, sicilNo}] */
  responsiblePersons?: string | null
}

/** Bölüme atanmış görev — kişi sorumlusu yoksa komple bölüm bilgilendirilir. */
export type BolumluGorev = HatirlatmaGorevi & {
  responsibleDepartment?: string | null
  responsibleDepartments?: string[] | null
}

export type GorevAlicisi = { email: string; name: string }

/** En yalın e-posta biçim kontrolü — boşluksuz, tek @, noktalı alan adı. */
function epostaGecerliMi(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

type HamSorumlu = { name: string; email: string | null }

/**
 * `responsiblePersons` metnini güvenli çözer. Bozuk JSON'da BOŞ liste döner —
 * patlamaz; görev "sorumlusu çözülemedi" kovasına düşer ve özet rapora girer.
 * (lib/tasks/atama-bildirimi.ts · sorumlulariCoz ile aynı savunma, bu modül
 * prisma'ya bağımlı olmasın diye ayrı tutuldu.)
 */
function diziyiCoz(raw: string | null | undefined): HamSorumlu[] {
  if (!raw) return []
  try {
    const p: unknown = JSON.parse(raw)
    if (!Array.isArray(p)) return []
    return p
      .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
      .map((x) => ({
        name: typeof x.name === 'string' ? x.name.trim() : '',
        email: typeof x.email === 'string' && x.email.trim() ? x.email.trim() : null,
      }))
  } catch {
    return []
  }
}

/**
 * Görevin hatırlatma alıcıları — küçük harfe indirilmiş, TEKİL e-posta listesi.
 * Sıra: tek-alan sorumlusu önce, sonra dizideki sorumlular (ekranda "Sorumlu:"
 * satırı da bu sırayı kullanır).
 */
export function gorevHatirlatmaAlicilari(gorev: HatirlatmaGorevi): string[] {
  const hepsi = [gorev.responsiblePersonEmail, ...diziyiCoz(gorev.responsiblePersons).map((s) => s.email)]
  const tekil: string[] = []
  for (const ham of hepsi) {
    if (!ham) continue
    const e = ham.trim().toLowerCase()
    if (!epostaGecerliMi(e)) continue
    if (!tekil.includes(e)) tekil.push(e)
  }
  return tekil
}

/**
 * Aynı liste, mail başlığında görünecek adlarla. Ad bulunamazsa e-posta
 * kullanılır. `gorevHatirlatmaAlicilari` ile AYNI sıra ve AYNI kümedir —
 * gövdedeki "Sorumlu:" satırı TO ile tutarsız kalmasın.
 */
export function gorevHatirlatmaAlicilariAdli(gorev: HatirlatmaGorevi): GorevAlicisi[] {
  const adHaritasi = new Map<string, string>()
  const tekAlan = gorev.responsiblePersonEmail?.trim().toLowerCase()
  if (tekAlan && gorev.responsiblePerson?.trim()) adHaritasi.set(tekAlan, gorev.responsiblePerson.trim())
  for (const s of diziyiCoz(gorev.responsiblePersons)) {
    const e = s.email?.toLowerCase()
    if (e && s.name && !adHaritasi.has(e)) adHaritasi.set(e, s.name)
  }
  return gorevHatirlatmaAlicilari(gorev).map((e) => ({ email: e, name: adHaritasi.get(e) ?? e }))
}

/** Gövdedeki "Sorumlu:" satırı — TO listesiyle BİREBİR aynı kişiler. */
export function sorumluSatiri(gorev: HatirlatmaGorevi): string {
  const alicilar = gorevHatirlatmaAlicilariAdli(gorev)
  if (alicilar.length === 0) return ''
  return alicilar.map((a) => (a.name === a.email ? a.email : `${a.name} <${a.email}>`)).join(', ')
}

/** Mail gönderilebilir mi — alıcı yoksa gönderim YAPILMAZ, özet rapora düşer. */
export function hatirlatmaGonderilebilirMi(gorev: HatirlatmaGorevi): boolean {
  return gorevHatirlatmaAlicilari(gorev).length > 0
}

// ── BÖLÜME ATANMIŞ GÖREVLER (08.10.2026) ────────────────────────────────────
//
// Kişi sorumlusu olmayan ama bir bölüme atanmış görevler eskiden HİÇ mail
// almıyordu: hatırlatma yalnız kişi adresine bakıyordu, bölüm alanı hiç
// okunmuyordu. Prod'da aktif 43 görevin 11'i bu durumdaydı (2'si OVERDUE).
//
// Bu görev "senin görevin" değil; bölümün tamamına BİLGİ olarak gider.

/** Görevin bölüm adları — çoklu alan ∪ tek alan, trim + tekil, sırası korunur. */
export function gorevBolumleri(gorev: BolumluGorev): string[] {
  const hepsi = [...(gorev.responsibleDepartments ?? []), gorev.responsibleDepartment]
  const tekil: string[] = []
  for (const ham of hepsi) {
    const b = ham?.trim()
    if (!b) continue
    if (!tekil.some((x) => x.toLocaleLowerCase('tr') === b.toLocaleLowerCase('tr'))) tekil.push(b)
  }
  return tekil
}

/** Kişi sorumlusu yok ama bölümü var → bölüm bilgi maili gönderilecek görev. */
export function bolumBilgisiGerekirMi(gorev: BolumluGorev): boolean {
  return gorevHatirlatmaAlicilari(gorev).length === 0 && gorevBolumleri(gorev).length > 0
}

/**
 * KURUMSAL adres süzgeci. Bölüm maili şirket içi bir bilgilendirmedir; kişisel
 * adreslere (hotmail/gmail) bölümün tamamının görev listesi gönderilmez.
 * Tekilleştirme + küçük harf, kişi listesiyle aynı kural.
 */
export const KURUMSAL_ALAN = '@ilerigroup.com'

export function kurumsalAlicilar(
  kisiler: { email: string | null | undefined; ad?: string | null }[],
): GorevAlicisi[] {
  const sonuc: GorevAlicisi[] = []
  for (const k of kisiler) {
    const e = k.email?.trim().toLowerCase()
    if (!e || !epostaGecerliMi(e) || !e.endsWith(KURUMSAL_ALAN)) continue
    if (sonuc.some((x) => x.email === e)) continue
    sonuc.push({ email: e, name: k.ad?.trim() || e })
  }
  return sonuc
}

/** Gövdedeki "Sorumlu:" satırı — bölüme atanmış görevde kişi adı değil bölüm adı. */
export function bolumSorumluSatiri(gorev: BolumluGorev): string {
  const bolumler = gorevBolumleri(gorev)
  if (bolumler.length === 0) return ''
  return `${bolumler.join(', ')} (bölüme atanmış görev)`
}
