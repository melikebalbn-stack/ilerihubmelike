import {
  ARACLAR,
  GUZERGAH_ARAC_ANA_ATAMA,
  SEFER_DILIMLERI,
  TEYIT_BEKLIYOR,
  TUM_GUZERGAHLAR,
} from './servis-tanim-verisi'
import {
  SAYIM_ANAHTARLARI,
  TanimHatasi,
  cliCoz,
  placeholderKontrol,
  planSayimi,
  planla,
  uygula as gercekUygula,
  type TanimPrisma,
} from './servis-tanim-seed-mantigi'

// prisma/seed-servis-tanim.ts'in akışı. Seed dosyası modül seviyesinde
// çalıştığı için testten import edilemez; akış burada, bağımlılıkları
// (DB bağlantısı, çıktı, veri) dışarıdan alarak test edilir.
//
// 🔴 ÇIKIŞ KODU SÖZLEŞMESİ: calistir() 0 (başarı) ya da 1 (her türlü hata)
// döner. Prod komut zinciri `&&` ile ilerlediği için hata ASLA 0 dönmemeli.
// Hata mesajı stderr'e (deps.err), başarı çıktısı stdout'a (deps.log) gider.

export type Baglanti = {
  prisma: TanimPrisma
  aktifVeritabani: () => Promise<string>
  kapat: () => Promise<void>
}

export type CalistirBagimliliklari = {
  baglan: () => Baglanti
  log: (mesaj: string) => void
  err: (mesaj: string) => void
  /** Testler için: varsayılan gerçek veri ve gerçek uygula(). */
  veri?: Partial<{
    guzergahlar: typeof TUM_GUZERGAHLAR
    araclar: typeof ARACLAR
    dilimler: typeof SEFER_DILIMLERI
  }>
  uygula?: typeof gercekUygula
}

const hataMetni = (e: unknown) =>
  e instanceof TanimHatasi ? `❌ ${e.message}` : e instanceof Error ? (e.stack ?? e.message) : String(e)

export async function calistir(args: string[], deps: CalistirBagimliliklari): Promise<0 | 1> {
  const { log, err } = deps
  const guzergahlar = deps.veri?.guzergahlar ?? TUM_GUZERGAHLAR
  const araclar = deps.veri?.araclar ?? ARACLAR
  const dilimler = deps.veri?.dilimler ?? SEFER_DILIMLERI
  const uygula = deps.uygula ?? gercekUygula

  let kod: 0 | 1 = 0
  let baglanti: Baglanti | null = null
  try {
    // DB'ye dokunmadan ÖNCE: parametreler (yerleşke dahil, dry-run'da da) ve
    // araç/firma verisinde yer tutucu kontrolü.
    const { db, yerleskeKod, yerleskeAd, apply } = cliCoz(args)
    placeholderKontrol(araclar)

    baglanti = deps.baglan()
    const gercekDb = await baglanti.aktifVeritabani()
    if (gercekDb !== db) {
      throw new TanimHatasi(`Bağlanılan veritabanı ("${gercekDb}") --db ile verilen ("${db}") ile UYUŞMUYOR. Durduruldu.`)
    }
    log(`✅ Veritabanı doğrulandı: ${gercekDb}${apply ? ' — APPLY MODU' : ' — DRY-RUN'}\n`)

    // PLAN (yalnız okur; dry-run ve apply için ORTAK)
    const plan = await planla(baglanti.prisma, { yerleskeKod, yerleskeAd, guzergahlar, araclar, dilimler })
    const { olusturulacak, mevcut } = planSayimi(plan)

    log('═══ PLAN ═══')
    for (const k of SAYIM_ANAHTARLARI) {
      log(`  ${k.padEnd(10)} oluşturulacak: ${String(olusturulacak[k]).padStart(4)} · mevcut korundu: ${mevcut[k]}`)
    }

    if (apply) {
      const yazilan = await uygula(baglanti.prisma, plan)
      log('\n═══ UYGULANDI ═══')
      for (const k of SAYIM_ANAHTARLARI) log(`  ${k.padEnd(10)} yazılan: ${String(yazilan[k]).padStart(4)}`)
      const fark = SAYIM_ANAHTARLARI.filter((k) => yazilan[k] !== olusturulacak[k])
      if (fark.length > 0) throw new Error(`Plan ile uygulama sayıları FARKLI: ${fark.join(', ')}`)
    } else {
      log('\n(DRY-RUN — hiçbir şey yazılmadı. --apply ile gerçek yazım yapılır.)')
    }

    // Güzergâh → araç ANA varsayılan ataması: liste ayrıca gelecek, BOŞ.
    // Seed burada hiçbir create() ÇAĞIRMAZ, yalnız durumu raporlar.
    log(`\n(Güzergâh→araç ANA atama: ${GUZERGAH_ARAC_ANA_ATAMA.length} kayıt — liste bekleniyor, seed yazmadı.)`)

    // ServisDurak'ta not alanı YOK: bu liste DB'ye yazılmaz, yalnız konsola
    // basılır. Kalıcı takip TEYIT_BEKLIYOR sabitinde.
    log(`\n═══ TEYIT BEKLİYOR (${TEYIT_BEKLIYOR.length} madde — DB'ye yazılmadı, yalnız bu raporda) ═══`)
    for (const t of TEYIT_BEKLIYOR) {
      log(`  ${t.madde.padEnd(4)} ${t.guzergah.padEnd(22)} ${t.durum.padEnd(28)} ${t.konu}`)
    }
  } catch (e) {
    err(hataMetni(e))
    kod = 1
  } finally {
    // Disconnect hatası ASIL hatayı yutmaz: asıl hata varsa zaten kod=1 ve
    // mesajı yazıldı; disconnect hatası ek satır olarak yazılır. Asıl hata
    // yoksa disconnect hatası da başarısızlıktır (kod=1).
    if (baglanti) {
      try {
        await baglanti.kapat()
      } catch (e) {
        err(`${kod === 1 ? '(ek) ' : ''}Bağlantı kapatılamadı: ${hataMetni(e)}`)
        kod = 1
      }
    }
  }
  return kod
}

/** Yakalanmamış hata ve unhandled rejection de exit 1 ile bitsin. */
export function hataKodlariniKur(
  proc: { on: (olay: string, f: (e: unknown) => void) => unknown; exit: (kod: number) => unknown },
  err: (mesaj: string) => void,
): void {
  proc.on('unhandledRejection', (e) => {
    err(`❌ Yakalanmamış promise reddi: ${hataMetni(e)}`)
    proc.exit(1)
  })
  proc.on('uncaughtException', (e) => {
    err(`❌ Yakalanmamış hata: ${hataMetni(e)}`)
    proc.exit(1)
  })
}
