/**
 * PUT /api/personnel/[id] gövde hazırlığı — BEYAZ LİSTE.
 *
 * Eskiden gövde kara listeyle (delete body.X) temizleniyordu; GET'e her yeni
 * alan eklendiğinde (anaKoltuklar 09.09, jobApplication 08.17) düzenleme ekranı
 * nesnenin tamamını geri gönderdiği için Prisma update patlıyordu. Artık yalnız
 * IZINLI_ALANLAR alınır; tanınmayan anahtar SESSİZCE ATILIR ama `atilanAlanlar`
 * olarak denetim kaydına yazılır — sinsi veri kaybı görünür kalsın.
 *
 * Bu modül route'tan ayrı tutuluyor ki test betiği oturum/HTTP olmadan aynı
 * boru hattını (pick → normalize → tarih/int → FK çözümü) gerçek veriyle
 * koşturabilsin (dryRun).
 */
import type { Prisma } from '@/generated/prisma'
import type { prisma } from '@/lib/prisma'
import { personelFkAlanlariIdOncelikli } from '@/lib/personnel/fk-cozum'
import { degerlendirmeTarihleriniTamamla } from '@/lib/personnel/degerlendirme-tarihleri'

/**
 * Düzenleme ekranının (personnel/[id]/page.tsx) girdi alanı olan ve doğrudan
 * Personnel kolonuna yazılan alanlar. Ölçüm 12.09.2026: GET 58 anahtar döndürüyor,
 * formda 50 girdi var; beden düz alanları nested `beden`e, sorumlu*Id FK
 * çözücüye gidiyor → kolona yazılan 41 alan aşağıda.
 *
 * Buraya alan eklemek = o alanın formdan yazılabilir olması demektir. Sistem
 * alanları (id, createdAt, createdBy, azureAd*, jobApplication*, aktif, exit*)
 * bilerek YOK: aktif PATCH ile, çıkış EmploymentPeriod ile, Azure bağı LDAP
 * senkronuyla yazılır.
 */
export const IZINLI_ALANLAR = [
  'sicilNo', 'sinif', 'cinsiyet', 'adSoyad',
  'yakaRengi', 'yakaDetayi', 'direktEndirekt', 'asansorMekanik',
  'iseGirisTarihi', 'gorev', 'bolumDetay', 'bolum',
  'birimSorumlusu', 'sorumlu2', 'sorumlu3', 'bolumMuduru',
  'masrafMerkezi', 'interKepMail', 'mailAdresi', 'ikametAdresi',
  'denemeDegerlendirme', 'altiAyDegerlendirme',
  'telefon', 'kanGrubu', 'serviceRoute', 'serviceStop',
  'egitimYeri', 'egitimTipi', 'egitimAlani', 'mezuniyetYili',
  'ilkYardimciBelgesi', 'kalfalikBelgesi', 'ustalikBelgesi',
  'forkliftEhliyeti', 'vincEhliyeti', 'mykBelgesiTarihi', 'yanginSertifikasi',
  'eTrans', 'ustaOgreticiBelgesi', 'emekli', 'engelli',
] as const

/**
 * Kolona yazılmayan ama gövdede BEKLENEN yardımcı anahtarlar: `beden` ayrı
 * upsert edilir, sorumlu*Id FK çözücüye girdi olur. Bunlar "atılan" sayılmaz.
 */
export const YARDIMCI_ALANLAR = ['beden', 'sorumlu1Id', 'sorumlu2Id', 'sorumlu3Id'] as const

export const TARIH_ALANLARI = [
  'iseGirisTarihi', 'denemeDegerlendirme', 'altiAyDegerlendirme',
  'ilkYardimciBelgesi', 'kalfalikBelgesi', 'ustalikBelgesi', 'yanginSertifikasi', 'mykBelgesiTarihi',
] as const

export type IzinliAlan = (typeof IZINLI_ALANLAR)[number]

export interface HazirGovde {
  /** prisma.personnel.update({ data }) için hazır gövde (FK alanları dahil). */
  data: Record<string, unknown>
  /** Gövdede gelen ama ne izinli ne yardımcı olan anahtarlar — denetim kaydına yazılır. */
  atilanAlanlar: string[]
  /** Nested beden girdisi (ham; normalizeBeden çağıran tarafta). */
  bedenInput: unknown
}

export async function personelPutGovdesiniHazirla(
  db: Prisma.TransactionClient | typeof prisma,
  ham: Record<string, unknown>,
  personnelId: string,
): Promise<HazirGovde> {
  const izinli = new Set<string>(IZINLI_ALANLAR)
  const yardimci = new Set<string>(YARDIMCI_ALANLAR)

  // pick: yalnız izinli anahtarlar, yalnız gövdede GERÇEKTEN olanlar
  // (kısmi güncelleme: gönderilmeyen alan dokunulmaz).
  const body: Record<string, unknown> = {}
  for (const k of IZINLI_ALANLAR) {
    if (Object.prototype.hasOwnProperty.call(ham, k)) body[k] = ham[k]
  }
  const atilanAlanlar = Object.keys(ham).filter((k) => !izinli.has(k) && !yardimci.has(k)).sort()

  // Boş stringleri null'a çevir (Prisma enum/date/int hataları için)
  for (const key of Object.keys(body)) {
    if (body[key] === '') body[key] = null
  }

  // Tarih alanları (null atlanır)
  for (const field of TARIH_ALANLARI) {
    if (body[field]) body[field] = new Date(body[field] as string)
  }

  // DEĞERLENDİRME TARİHLERİ — giriş tarihi gövdede geldiyse tamamlanır.
  // Açıkça DOLU gelen değer korunur (İK elle girmiş olabilir); boş gelirse
  // hesaplanır. İstemci formu bu alanları her kayıtta gönderiyor ama kullanıcı
  // giriş tarihine dokunmadıysa BOŞ gönderiyordu — o yüzden boş = "hesapla".
  if (body.iseGirisTarihi) {
    const hesap = degerlendirmeTarihleriniTamamla(body.iseGirisTarihi as Date, {
      denemeDegerlendirme: body.denemeDegerlendirme as Date | null | undefined,
      altiAyDegerlendirme: body.altiAyDegerlendirme as Date | null | undefined,
    })
    if (hesap) {
      body.denemeDegerlendirme = hesap.denemeDegerlendirme
      body.altiAyDegerlendirme = hesap.altiAyDegerlendirme
    }
  }

  if (body.mezuniyetYili) {
    body.mezuniyetYili = parseInt(String(body.mezuniyetYili)) || null
  }

  // FAZ 1 · ÇİFT YAZIM: metin alanları AYNEN güncellenir, yanlarına FK yazılır.
  // Yalnız GÖNDERİLEN alanlar için anahtar üretilir — dokunulmayan alanın FK'sı
  // sıfırlanmaz. SORUMLU-FK-YAZMA: gövdeden gelen sorumlu*Id ÖNCELİKLİ (var mı ·
  // aktif mi · kendisi değil mi diye doğrulanır); geçersizse ad çözümüne düşülür.
  // Ham id'ler update'e doğrudan GİTMEZ — yalnız çözücüye girdi olur.
  const govdeIdler = {
    sorumlu1Id: ham.sorumlu1Id as string | null | undefined,
    sorumlu2Id: ham.sorumlu2Id as string | null | undefined,
    sorumlu3Id: ham.sorumlu3Id as string | null | undefined,
  }
  Object.assign(
    body,
    await personelFkAlanlariIdOncelikli(
      db,
      {
        ...(body.bolum !== undefined ? { bolum: body.bolum as string | null } : {}),
        ...(body.birimSorumlusu !== undefined ? { birimSorumlusu: body.birimSorumlusu as string | null } : {}),
        ...(body.sorumlu2 !== undefined ? { sorumlu2: body.sorumlu2 as string | null } : {}),
        ...(body.sorumlu3 !== undefined ? { sorumlu3: body.sorumlu3 as string | null } : {}),
      },
      govdeIdler,
      personnelId,
    ),
  )

  return { data: body, atilanAlanlar, bedenInput: ham.beden }
}
