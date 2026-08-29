// Tek seferlik, idempotent sandbox referans veri seed'i (ilerihub_dev_elif).
// prisma/ DIŞINDA — bu bir prod migration DEĞİL, Elif'in servis çalışma
// örneği Excel'inden çıkarılmış referans veriyi (referans-veri.json) servis-
// yonetimi tanım tablolarına yükler. TOSB ve İZMİT bu veri setinde YOK,
// bilinçli olarak dokunulmuyor.
//
// Kod şeması notları (gerçek Prisma şemasına göre doğrulandı):
// - ServisGuzergah.yerleskeId ZORUNLU ama kaynak veride yerleşke bilgisi
//   hiç yok → tüm güzergahlar tek bir PLACEHOLDER yerleşkeye bağlanıyor.
// - "kapasite" ServisGuzergah'ta DEĞİL, ServisArac'ta bir alan — JSON'daki
//   güzergah.kapasite değeri o güzergahın aracına yazılıyor.
// - Durak kod'u sentetik: `{GUZERGAHKOD}-{SIRA}`. Global ad bazlı tekilleştirme
//   YAPILMIYOR — aynı ada sahip duraklar (ör. "Garanti Bankası") farklı
//   güzergahlarda coğrafi olarak FARKLI noktalar (bkz. görev talimatı: "aynı
//   isimde durak farklı güzergahlarda tekrarlanabilir"). Ayrıca en az iki
//   güzergahta AYNI durak adı KENDİ İÇİNDE de tekrarlanıyor (USKUDAR'da
//   "Üsküdar" sira 2 ve 4; DARICA'da "Mehmet Akif" sira 3 ve 8) — bunlar
//   muhtemelen aynı fiziksel durağın rotada iki kez geçildiği noktalar, ama
//   @@unique([guzergahId, durakId]) aynı durağın bir güzergahta İKİ KEZ
//   ServisGuzergahDurak satırı almasına izin vermiyor. Bu yüzden sentetik
//   kod her (güzergah, sıra) çiftine kendi ServisDurak kaydını veriyor —
//   şemanın izin verdiği tek doğru temsil bu. Elif ekrandan gerekirse bu iki
//   çiftin isimlerini ayırt edici hale getirebilir (ör. "Üsküdar (2. geçiş)").
// - saatGidis → SABAH_GIDIS dilimiyle ServisGuzergahDurakSaat. saatDonus
//   kaynak veride HER ZAMAN null (not: Excel'de dönüş saati hiç yok) —
//   o satır hiç oluşturulmuyor.
// - ServisGuzergahAracVarsayilan (araç varsayılan ataması) BİLEREK
//   oluşturulmuyor — bu "atama" tabloları, tanım/master veri seed'inin
//   kapsamı dışında (servis-yonetimi modülünde daha önce netleşen sınır).
//
// İdempotency: her tabloda ilgili unique alan (kod/plaka/ad) üzerinden
// önce ara, yoksa oluştur. İkinci çalıştırmada hiçbir yeni kayıt oluşmaz.

import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { normalizeServisAracPlaka } from '@/lib/servis-yonetimi/service'
import referansVeri from './referans-veri.json'

const PLACEHOLDER_YERLESKE_KOD = 'PLACEHOLDER'

type Sayac = { olusturuldu: number; zatenVardi: number }

function yeniSayac(): Sayac {
  return { olusturuldu: 0, zatenVardi: 0 }
}

function sayacYaz(isim: string, s: Sayac) {
  console.log(`${isim}: ${s.olusturuldu} yeni, ${s.zatenVardi} zaten vardı`)
}

async function main() {
  const firmaSayac = yeniSayac()
  const dilimSayac = yeniSayac()
  const guzergahSayac = yeniSayac()
  const aracSayac = yeniSayac()
  const durakSayac = yeniSayac()
  const guzergahDurakSayac = yeniSayac()
  const saatSayac = yeniSayac()

  const mevcutYerleske = await prisma.servisYerleske.findUnique({ where: { kod: PLACEHOLDER_YERLESKE_KOD } })
  const yerleske =
    mevcutYerleske ??
    (await prisma.servisYerleske.create({
      data: { kod: PLACEHOLDER_YERLESKE_KOD, ad: 'Placeholder Yerleşke (PLACEHOLDER - gerçek yerleşke bekleniyor)' },
    }))
  console.log(mevcutYerleske ? `Yerleşke zaten vardı: ${yerleske.kod}` : `Yerleşke oluşturuldu: ${yerleske.kod}`)

  const firmaIdMap = new Map<string, string>()
  for (const [kod, ad] of Object.entries(referansVeri.firmalar_placeholder)) {
    const mevcut = await prisma.servisFirma.findFirst({ where: { ad } })
    if (mevcut) {
      firmaIdMap.set(kod, mevcut.id)
      firmaSayac.zatenVardi++
    } else {
      const yeni = await prisma.servisFirma.create({ data: { ad } })
      firmaIdMap.set(kod, yeni.id)
      firmaSayac.olusturuldu++
    }
  }

  const dilimIdMap = new Map<string, string>()
  for (const d of referansVeri.seferDilimleri) {
    const mevcut = await prisma.servisSeferDilimi.findUnique({ where: { kod: d.kod } })
    if (mevcut) {
      dilimIdMap.set(d.kod, mevcut.id)
      dilimSayac.zatenVardi++
    } else {
      const yeni = await prisma.servisSeferDilimi.create({
        data: {
          kod: d.kod,
          ad: d.ad,
          yon: d.yon as 'GIDIS' | 'DONUS',
          grupKodu: d.grupKodu,
          sira: d.sira,
        },
      })
      dilimIdMap.set(d.kod, yeni.id)
      dilimSayac.olusturuldu++
    }
  }
  const sabahGidisDilimId = dilimIdMap.get('SABAH_GIDIS')
  if (!sabahGidisDilimId) throw new Error('SABAH_GIDIS dilimi bulunamadı.')

  for (const [guzergahKod, g] of Object.entries(referansVeri.guzergahlar)) {
    const mevcutGuzergah = await prisma.servisGuzergah.findUnique({ where: { kod: guzergahKod } })
    const guzergah =
      mevcutGuzergah ??
      (await prisma.servisGuzergah.create({
        data: { kod: guzergahKod, ad: g.ad, yerleskeId: yerleske.id },
      }))
    if (mevcutGuzergah) guzergahSayac.zatenVardi++
    else guzergahSayac.olusturuldu++

    const firmaId = firmaIdMap.get(g.firmaKodu)
    if (!firmaId) throw new Error(`Bilinmeyen firmaKodu: ${g.firmaKodu} (${guzergahKod})`)

    const plaka = normalizeServisAracPlaka(g.plaka)
    const mevcutArac = await prisma.servisArac.findUnique({ where: { plaka } })
    if (mevcutArac) {
      aracSayac.zatenVardi++
    } else {
      await prisma.servisArac.create({ data: { plaka, kapasite: g.kapasite, firmaId } })
      aracSayac.olusturuldu++
    }

    for (const d of g.duraklar) {
      const durakKod = `${guzergahKod}-${String(d.sira).padStart(2, '0')}`
      const mevcutDurak = await prisma.servisDurak.findUnique({ where: { kod: durakKod } })
      const durak = mevcutDurak ?? (await prisma.servisDurak.create({ data: { kod: durakKod, ad: d.ad } }))
      if (mevcutDurak) durakSayac.zatenVardi++
      else durakSayac.olusturuldu++

      const mevcutGuzergahDurak = await prisma.servisGuzergahDurak.findUnique({
        where: { guzergahId_durakId: { guzergahId: guzergah.id, durakId: durak.id } },
      })
      const guzergahDurak =
        mevcutGuzergahDurak ??
        (await prisma.servisGuzergahDurak.create({
          data: { guzergahId: guzergah.id, durakId: durak.id, sira: d.sira },
        }))
      if (mevcutGuzergahDurak) guzergahDurakSayac.zatenVardi++
      else guzergahDurakSayac.olusturuldu++

      if (d.saatGidis) {
        const mevcutSaat = await prisma.servisGuzergahDurakSaat.findUnique({
          where: { guzergahDurakId_dilimId: { guzergahDurakId: guzergahDurak.id, dilimId: sabahGidisDilimId } },
        })
        if (mevcutSaat) {
          saatSayac.zatenVardi++
        } else {
          await prisma.servisGuzergahDurakSaat.create({
            data: { guzergahDurakId: guzergahDurak.id, dilimId: sabahGidisDilimId, saat: d.saatGidis },
          })
          saatSayac.olusturuldu++
        }
      }
      // saatDonus kaynak veride her zaman null — bilinçli olarak atlanıyor.
    }
  }

  console.log('\n--- SONUÇ ---')
  sayacYaz('Firma', firmaSayac)
  sayacYaz('Sefer Dilimi', dilimSayac)
  sayacYaz('Güzergah', guzergahSayac)
  sayacYaz('Araç', aracSayac)
  sayacYaz('Durak', durakSayac)
  sayacYaz('Güzergah-Durak', guzergahDurakSayac)
  sayacYaz('Saat', saatSayac)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
