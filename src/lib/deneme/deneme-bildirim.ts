// IV-FR-27 · Deneme Değerlendirme — form açma, hatırlatma ve eskalasyon.
//
// api/personnel/check-evaluations ucundan çağrılır (günlük 09:45 cron).
// MEVCUT İV MAİLİ KORUNUR — bu modül onun YANINA çalışır, yerine geçmez.
//
// Desen: performance-review-notifications.ts — mail + in-app Notification tek
// yerden, alıcı çözümü ve tekrar-engeli ayrı. Tekrar engeli iki katmanlı:
//   · PersonnelEvaluationEmailLog (tip bazlı, 14 gün) — mevcut uçla aynı tablo
//   · DenemeDegerlendirme.hatirlatmaSeviyesi (0→1→2) — tasks/check-escalation kalıbı

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { denemeZinciriCoz } from '@/lib/deneme/deneme-zincir'
import { adimSahibiRol } from '@/lib/deneme/deneme-yetki'
import { denemeBildirimAcikMi, DENEME_BILDIRIM_ENV } from '@/lib/deneme/deneme-bayrak'
import { sentetikMailMi } from '@/lib/bluecollar-email'
import {
  generateDenemeDegerlendiriciEmail,
  generateDenemeEskalasyonEmail,
  generateDenemeZincirHatasiEmail,
} from '@/lib/email'
import type { DenemeTur, DenemeDurum } from '@/generated/prisma'

export type DenemeCronSonuc = {
  acilan: number
  acilamayan: { sicilNo: string; tur: DenemeTur; sebep: string }[]
  muaf: number
  hatirlatma: number
  eskalasyon: number
  zatenVar: number
  /** Bayrak kapalıyken gönderilmeyen bildirim sayısı. */
  atlananBildirim: number
  /** Sentetik adres yüzünden maili ULAŞMAYAN alıcılar (in-app oluşturuldu). */
  mailUlasmayan: { adSoyad: string; email: string; personel: string }[]
}

type Alici = {
  userId: string
  email: string
  name: string
  /** Sentetik mavi yaka adresi — POSTA KUTUSU DEĞİL, mail adımı atlanır. */
  sentetik?: boolean
}

/** Personnel → User (mail + in-app için). User hesabı yoksa null. */
async function personelinKullanicisi(personnelId: string | null): Promise<Alici | null> {
  if (!personnelId) return null
  const u = await prisma.user.findFirst({
    where: { personnelId, isActive: true },
    select: { id: true, email: true, name: true, personnel: { select: { adSoyad: true } } },
  })
  if (!u?.email) return null
  return {
    userId: u.id,
    email: u.email,
    name: u.name || u.personnel?.adSoyad || u.email,
    sentetik: sentetikMailMi(u.email),
  }
}

/** İV ekibi — hr-notifications'taki ölçütün aynısı (User.department 'insan' içerir). */
async function ivAlicilari(): Promise<Alici[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, department: { contains: 'insan', mode: 'insensitive' } },
    select: { id: true, email: true, name: true },
  })
  return users.filter((u) => !!u.email).map((u) => ({ userId: u.id, email: u.email as string, name: u.name || (u.email as string) }))
}

/** Formun O ANKİ adım sahibi (Personnel id). Durumdan çözülür. */
function adimSahibiPersonelId(form: {
  durum: DenemeDurum
  degerlendirici1Id: string | null
  degerlendirici2Id: string | null
  onaylayanId: string | null
}): string | null {
  switch (adimSahibiRol(form.durum)) {
    case 'TAKIM_LIDERI':
      return form.degerlendirici1Id
    case 'MUDUR_YARDIMCISI':
    case 'MUDUR':
      return form.degerlendirici2Id
    case 'ONAYLAYAN':
      return form.onaylayanId
    default:
      return null // IK aşaması ve terminal durumlar
  }
}

/**
 * Zincirdeki BİR SONRAKİ halka (Personnel id). Form açılırken yazılan alanlardan
 * türetilir — zincir çözücüsü YENİDEN ÇAĞRILMAZ.
 *
 * Eskalasyon bunu da bilgilendirir: form gecikiyorsa yalnız o anki adım sahibini
 * değil, formun DÜŞECEĞİ kişiyi de haberdar etmek gerekir. Örnek: Preshane'de
 * Orhan Çakmak (takım lideri) gönderdiğinde form Bedri Güler'e (müdür yrd.)
 * düşer; eskiden yalnız bölüm müdürü (Samet Taşlı) uyarılıyor, Bedri Güler
 * ATLANIYORDU.
 */
function sonrakiHalkaPersonelId(form: {
  durum: DenemeDurum
  degerlendirici2Id: string | null
  onaylayanId: string | null
}): string | null {
  switch (form.durum) {
    case 'DEGERLENDIRICI1_BEKLIYOR':
      // Mavi yaka: 2. değerlendirici. Gri/beyaz (tek puan): varsa onaylayan.
      return form.degerlendirici2Id ?? form.onaylayanId
    case 'MUDUR_YRD_BEKLIYOR':
      // Müdür yrd. doldurunca bölüm müdürü onaylar.
      return form.onaylayanId
    case 'MUDUR_BEKLIYOR':
    case 'ONAY_BEKLIYOR':
    case 'IK_BEKLIYOR':
      // Sonraki halka İK — İV alıcı listesinde zaten var.
      return null
    default:
      return null
  }
}

/**
 * Mail + in-app birlikte. Biri patlarsa diğeri gitmeye devam eder.
 * Dönüş: mail GERÇEKTEN gitti mi — gönderim işareti buna bakar. Mail patlarsa
 * işaretlemeyiz, yarın tekrar denenir (mevcut uçtaki `if (r.success)` deseni).
 */
async function gonder(
  alici: Alici, konu: string, govde: string, html: string, link: string, inAppBaslik: string,
): Promise<boolean> {
  // SENTETİK ADRES: posta kutusu yok, gönderilse teslim edilmez. Mail adımını
  // ATLA ama in-app bildirimi YİNE OLUŞTUR — kullanıcı sisteme giriyor, orada görür.
  // false döner: "gönderildi" işareti konmaz, İV'ye ulaşmadığı bildirilir.
  if (alici.sentetik) {
    try {
      await prisma.notification.create({
        data: { userId: alici.userId, title: inAppBaslik, message: konu, type: 'INFO', link },
      })
    } catch (e) {
      console.error('[deneme-bildirim] in-app:', e)
    }
    console.warn('[deneme-bildirim] sentetik adres — mail atlandi, in-app olusturuldu:', alici.email)
    return false
  }

  const [mailRes, inAppRes] = await Promise.allSettled([
    sendEmail([{ name: alici.name, email: alici.email }], konu, govde, html),
    prisma.notification.create({
      data: { userId: alici.userId, title: inAppBaslik, message: konu, type: 'INFO', link },
    }),
  ])
  if (inAppRes.status === 'rejected') console.error('[deneme-bildirim] in-app:', inAppRes.reason)
  if (mailRes.status === 'rejected') {
    console.error('[deneme-bildirim] mail:', mailRes.reason)
    return false
  }
  if (!mailRes.value?.success) {
    console.error('[deneme-bildirim] mail gonderilemedi:', mailRes.value?.error)
    return false
  }
  return true
}

/** Aynı kişi+tip için son 14 günde gönderildi mi (mevcut uçla AYNI tablo/ölçüt). */
async function zatenGonderildi(personnelId: string, type: string, dedupSince: Date): Promise<boolean> {
  const log = await prisma.personnelEvaluationEmailLog.findFirst({
    where: { personnelId, type, sentAt: { gte: dedupSince } },
    select: { id: true },
  })
  return !!log
}

async function gonderimiIsaretle(personnelId: string, type: string, alicilar: Alici[], subject: string) {
  await prisma.personnelEvaluationEmailLog.create({
    data: { personnelId, type, recipientEmails: alicilar.map((a) => a.email).join(', '), subject },
  })
}

/** Zinciri çözülemeyen kişi bildirimi — kişi bazında 14 gün dedup. */
const ZINCIR_HATASI_TIPI = 'ZINCIR_HATASI'

const TUR_ETIKET: Record<DenemeTur, string> = {
  DENEME_2AY: 'Deneme Süresi (2 Ay)',
  ALTI_AY: 'İlk 6 Ay',
}

/**
 * Cron gövdesi. `kuruCalistirma: true` ise HİÇBİR yazma yapılmaz — yalnız ne
 * olacağını sayar (simülasyon).
 */
export async function denemeFormlariniIsle(args: {
  bugun: Date
  pencereSonu: Date // [bugun, pencereSonu) — telafili 7 gün
  dedupSince: Date
  kuruCalistirma?: boolean
  baseUrl?: string
}): Promise<DenemeCronSonuc> {
  const kuru = !!args.kuruCalistirma
  const base = args.baseUrl ?? process.env.NEXTAUTH_URL ?? 'https://hub.ilerigroup.com'
  const sonuc: DenemeCronSonuc = { acilan: 0, acilamayan: [], muaf: 0, hatirlatma: 0, eskalasyon: 0, zatenVar: 0, atlananBildirim: 0, mailUlasmayan: [] }
  // Bayrak KAPALI → form açma çalışır, bildirim tarafı tamamen susar.
  const bildirimAcik = denemeBildirimAcikMi()

  const [ikiAy, altiAy] = await Promise.all([
    prisma.personnel.findMany({
      where: { aktif: true, denemeDegerlendirme: { gte: args.bugun, lt: args.pencereSonu } },
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true, denemeDegerlendirme: true },
    }),
    prisma.personnel.findMany({
      where: { aktif: true, altiAyDegerlendirme: { gte: args.bugun, lt: args.pencereSonu } },
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true, altiAyDegerlendirme: true },
    }),
  ])

  // İki listenin select'i farklı tarih alanı taşıyor — ortak dar tip.
  type IsKisi = { id: string; sicilNo: string | null; adSoyad: string; bolum: string; gorev: string }
  const isler: { kisi: IsKisi; tur: DenemeTur; hedefTarih: Date }[] = [
    ...ikiAy.map((k) => ({ kisi: k, tur: 'DENEME_2AY' as DenemeTur, hedefTarih: k.denemeDegerlendirme! })),
    ...altiAy.map((k) => ({ kisi: k, tur: 'ALTI_AY' as DenemeTur, hedefTarih: k.altiAyDegerlendirme! })),
  ]

  const zincirHatalari: { personnelId: string; sicilNo: string; adSoyad: string; tur: string; sebep: string }[] = []

  for (const is of isler) {
    const { kisi, tur, hedefTarih } = is

    let form = await prisma.denemeDegerlendirme.findUnique({
      where: { personnelId_tur: { personnelId: kisi.id, tur } },
      select: {
        id: true, durum: true, tur: true, hedefTarih: true, kriterRevizyon: true,
        degerlendirici1Id: true, degerlendirici2Id: true, onaylayanId: true,
        hatirlatmaSeviyesi: true, personnelId: true,
      },
    })

    // ── 1) FORM AÇMA ──
    if (!form) {
      const zincir = await denemeZinciriCoz(prisma, kisi.id)
      if (!zincir.ok) {
        // MUAF: sessizce atla, log kirletme.
        if (zincir.muaf) { sonuc.muaf++; continue }
        // Çözülemedi: kimse fark etmeden tıkanmasın — logla, İV'ye bildir.
        sonuc.acilamayan.push({ sicilNo: kisi.sicilNo ?? kisi.id, tur, sebep: zincir.sebep })
        console.warn('[deneme-cron] zincir çözülemedi:', { sicilNo: kisi.sicilNo, tur, sebep: zincir.sebep })
        // İV bildirimi KİŞİ BAZINDA dedup'lanır (toplu mail bazında DEĞİL): aynı kişi
        // için 14 günde bir bildirilir, ama zinciri yeni kırılan biri beklemeden girer.
        if (bildirimAcik && !(await zatenGonderildi(kisi.id, ZINCIR_HATASI_TIPI, args.dedupSince))) {
          zincirHatalari.push({
            personnelId: kisi.id, sicilNo: kisi.sicilNo ?? '(?)', adSoyad: kisi.adSoyad,
            tur: TUR_ETIKET[tur], sebep: zincir.sebep,
          })
        }
        continue
      }

      sonuc.acilan++
      if (kuru) {
        form = {
          id: '(kuru)', durum: zincir.baslangicDurumu, tur, hedefTarih, kriterRevizyon: '(kuru)',
          degerlendirici1Id: zincir.degerlendirici1.personnelId,
          degerlendirici2Id: zincir.degerlendirici2?.personnelId ?? null,
          onaylayanId: zincir.onaylayan?.personnelId ?? null,
          hatirlatmaSeviyesi: 0, personnelId: kisi.id,
        }
      } else {
        const aktifKriter = await prisma.denemeKriter.findFirst({
          where: { aktif: true }, orderBy: [{ revizyon: 'desc' }, { sira: 'asc' }], select: { revizyon: true },
        })
        if (!aktifKriter) { console.error('[deneme-cron] kriter kataloğu boş — form açılamadı'); continue }

        form = await prisma.$transaction(async (tx) => {
          const f = await tx.denemeDegerlendirme.create({
            data: {
              personnelId: kisi.id, tur, hedefTarih, yakaRengi: zincir.yakaRengi,
              kriterRevizyon: aktifKriter.revizyon, durum: zincir.baslangicDurumu,
              degerlendirici1Id: zincir.degerlendirici1.personnelId,
              degerlendirici1Rol: zincir.degerlendirici1.rol,
              degerlendirici2Id: zincir.degerlendirici2?.personnelId ?? null,
              degerlendirici2Rol: zincir.degerlendirici2?.rol ?? null,
              onaylayanId: zincir.onaylayan?.personnelId ?? null,
              createdBy: '(cron)',
            },
            select: {
              id: true, durum: true, tur: true, hedefTarih: true, kriterRevizyon: true,
              degerlendirici1Id: true, degerlendirici2Id: true, onaylayanId: true,
              hatirlatmaSeviyesi: true, personnelId: true,
            },
          })
          await tx.denemeDegerlendirmeLog.create({
            data: {
              degerlendirmeId: f.id, eskiDurum: null, yeniDurum: zincir.baslangicDurumu, aktorId: null,
              aciklama: `Cron açtı (${zincir.departmentAdi}, ${zincir.yakaRengi})${zincir.atlananlar.length ? ' · ' + zincir.atlananlar.join(' · ') : ''}`,
            },
          })
          return f
        })
      }
    } else {
      sonuc.zatenVar++
      if (form.durum === 'TAMAMLANDI' || form.durum === 'IPTAL') continue
    }

    // ── 2/3) HATIRLATMA ve ESKALASYON ──
    const gunKala = Math.round((hedefTarih.getTime() - args.bugun.getTime()) / 86400000)
    const sahipPid = adimSahibiPersonelId(form)
    const link = `${base}/deneme/${form.id}`
    const etiket = TUR_ETIKET[tur]

    // 3 gün kala eskalasyon — seviye 2. Form hâlâ TAMAMLANDI değil.
    if (gunKala <= 3 && form.hatirlatmaSeviyesi < 2) {
      // Bayrak kapalı: sayacı say, hatirlatmaSeviyesi'ne DOKUNMA — Faz 4'te
      // açıldığında doğru seviyeden (0) başlasın.
      if (!bildirimAcik) { sonuc.atlananBildirim++; continue }
      const tip = `${tur === 'DENEME_2AY' ? 'TWO_MONTH' : 'SIX_MONTH'}_ESKALASYON`
      if (!(await zatenGonderildi(kisi.id, tip, args.dedupSince))) {
        const sahip = await personelinKullanicisi(sahipPid)
        // ZİNCİRDEN türetilen sonraki halka — formun düşeceği kişi de uyarılır.
        const sonraki = await personelinKullanicisi(sonrakiHalkaPersonelId(form))
        const dept = await prisma.personnel.findUnique({
          where: { id: kisi.id }, select: { department: { select: { mudurId: true } } },
        })
        const mudur = await personelinKullanicisi(dept?.department?.mudurId ?? null)
        const iv = await ivAlicilari()
        const alicilar = [sahip, sonraki, mudur, ...iv].filter((a): a is Alici => !!a)
        const benzersiz = [...new Map(alicilar.map((a) => [a.userId, a])).values()]
        sonuc.eskalasyon++
        if (!kuru && benzersiz.length) {
          const { subject, body, html } = generateDenemeEskalasyonEmail({
            adSoyad: kisi.adSoyad, sicilNo: kisi.sicilNo, bolum: kisi.bolum, gorev: kisi.gorev,
            tur: etiket, hedefTarih, gunKala, durum: form.durum, link,
          })
          let enAzBirGitti = false
          for (const a of benzersiz) {
            if (a.sentetik) {
              sonuc.mailUlasmayan.push({ adSoyad: a.name, email: a.email, personel: `${kisi.adSoyad} (${kisi.sicilNo})` })
            }
            if (await gonder(a, subject, body, html, link, `${etiket} değerlendirmesi gecikiyor`)) enAzBirGitti = true
          }
          // Hiçbiri gitmediyse İŞARETLEME — yarın tekrar denensin.
          if (enAzBirGitti) {
            await gonderimiIsaretle(kisi.id, tip, benzersiz, subject)
            await prisma.denemeDegerlendirme.update({
              where: { id: form.id }, data: { hatirlatmaSeviyesi: 2, sonHatirlatmaAt: new Date() },
            })
          }
        }
      }
      continue // eskalasyon gittiyse aynı gün ayrıca hatırlatma atma
    }

    // 7 gün kala hatırlatma — seviye 1. Adım sahibine mail + in-app.
    if (form.hatirlatmaSeviyesi < 1) {
      if (!bildirimAcik) { sonuc.atlananBildirim++; continue }
      const tip = `${tur === 'DENEME_2AY' ? 'TWO_MONTH' : 'SIX_MONTH'}_DEGERLENDIRICI`
      if (!(await zatenGonderildi(kisi.id, tip, args.dedupSince))) {
        const sahip = await personelinKullanicisi(sahipPid)
        sonuc.hatirlatma++
        if (!kuru && sahip) {
          const { subject, body, html } = generateDenemeDegerlendiriciEmail({
            adSoyad: kisi.adSoyad, sicilNo: kisi.sicilNo, bolum: kisi.bolum, gorev: kisi.gorev,
            tur: etiket, hedefTarih, gunKala, link,
          })
          if (sahip.sentetik) {
            sonuc.mailUlasmayan.push({ adSoyad: sahip.name, email: sahip.email, personel: `${kisi.adSoyad} (${kisi.sicilNo})` })
          }
          if (await gonder(sahip, subject, body, html, link, `${etiket} değerlendirmesi sizde`)) {
            await gonderimiIsaretle(kisi.id, tip, [sahip], subject)
            await prisma.denemeDegerlendirme.update({
              where: { id: form.id }, data: { hatirlatmaSeviyesi: 1, sonHatirlatmaAt: new Date() },
            })
          }
        }
      }
    }
  }

  // Zincir çözülemeyenleri İV'ye TEK mailde bildir — kimse fark etmeden tıkanmasın.
  // Sentetik adres yüzünden ulaşılamayanlar İV'ye bildirilir — kimse "haberi var"
  // sanmasın. in-app bildirim oluşturuldu, mail gitmedi.
  if (!kuru && bildirimAcik && sonuc.mailUlasmayan.length) {
    const iv = await ivAlicilari()
    const satirlar = sonuc.mailUlasmayan
      .map((m, i) => `${i + 1}. ${m.adSoyad} (${m.email}) — ${m.personel}`)
      .join('\n')
    const konu = `ℹ️ Deneme değerlendirme: ${sonuc.mailUlasmayan.length} değerlendiriciye e-posta ULAŞMADI`
    const govde = `Aşağıdaki değerlendiricilerin sistem hesabı gerçek bir posta kutusuna bağlı değil
(mavi yaka giriş adresi). E-posta GÖNDERİLMEDİ; uygulama içi bildirim oluşturuldu.

${satirlar}

Bu kişiler ILERIHub'a giriş yaptıklarında bildirimi göreceklerdir. Kalıcı çözüm için
kurumsal e-posta hesabı açılması gerekir.

--
ILERIHub İnsan Varlıkları Yönetim Sistemi`
    for (const a of iv) {
      await gonder(a, konu, govde, govde.replace(/\n/g, '<br>'), `${base}/deneme`, 'Bildirim e-postası ulaşmadı')
    }
  }

  if (!kuru && bildirimAcik && zincirHatalari.length) {
    const iv = await ivAlicilari()
    if (iv.length) {
      const { subject, body, html } = generateDenemeZincirHatasiEmail(zincirHatalari)
      let gitti = false
      for (const a of iv) {
        if (await gonder(a, subject, body, html, `${base}/personnel`, 'Deneme değerlendirme zinciri kurulamadı')) gitti = true
      }
      // Mail gittiyse HER KİŞİ için ayrı işaret — 14 gün boyunca o kişi tekrar
      // listeye girmez, ama başka biri kırılırsa ertesi gün mail yine çıkar.
      if (gitti) {
        for (const h of zincirHatalari) await gonderimiIsaretle(h.personnelId, ZINCIR_HATASI_TIPI, iv, subject)
      }
    }
  }

  if (sonuc.mailUlasmayan.length) {
    console.warn(
      `[deneme-cron] ${sonuc.mailUlasmayan.length} aliciya mail ULASMADI (sentetik adres), ` +
        `in-app bildirim olusturuldu: ${sonuc.mailUlasmayan.map((m) => m.email).join(', ')}`,
    )
  }

  if (!bildirimAcik && (sonuc.atlananBildirim > 0 || sonuc.acilamayan.length > 0)) {
    console.log(
      `[deneme-cron] bildirim bayragi KAPALI (${DENEME_BILDIRIM_ENV}) — ` +
        `${sonuc.atlananBildirim} bildirim atlandi, ${sonuc.acilamayan.length} zincir hatasi bildirilmedi. ` +
        `Form acma calisti: ${sonuc.acilan} yeni, ${sonuc.zatenVar} mevcut.`,
    )
  }

  return sonuc
}
