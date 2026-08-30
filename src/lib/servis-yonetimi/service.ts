import { prisma } from '@/lib/prisma'
import {
  validateServisFirmaForm,
  validateServisAracForm,
  validateServisDurakForm,
  validateServisGuzergahForm,
  validateServisYerleskeForm,
  validateServisSoforForm,
  normalizeServisSoforTelefon,
  validateServisSeferDilimiForm,
  validateServisGuzergahDurakForm,
  validateServisGuzergahDurakSaatForm,
  validateServisGuzergahAracVarsayilanForm,
  validateServisGuzergahSoforVarsayilanForm,
  validateServisSorumlusuForm,
  validateServisPersonelDurumForm,
  validateServisPersonelAtamaForm,
  type ServisFirmaForm,
  type ServisAracForm,
  type ServisDurakForm,
  type ServisGuzergahForm,
  type ServisYerleskeForm,
  type ServisSoforForm,
  type ServisSeferDilimiForm,
  type ServisGuzergahDurakForm,
  type ServisGuzergahDurakSaatForm,
  type ServisGuzergahAracVarsayilanForm,
  type ServisGuzergahSoforVarsayilanForm,
  type ServisSorumlusuForm,
  type ServisPersonelDurumForm,
  type ServisPersonelAtamaForm,
} from './validation'
import { kaydetIslemGecmisi, degisenAlanlar } from './audit'

// ============================================================================
// ServisFirma
// ============================================================================

export async function listServisFirmalar(filtre?: { aktif?: boolean }) {
  return prisma.servisFirma.findMany({
    where: filtre?.aktif !== undefined ? { aktif: filtre.aktif } : undefined,
    orderBy: { ad: 'asc' },
  })
}

export async function createServisFirma(form: ServisFirmaForm, yapanId?: string | null) {
  const { valid, errors } = validateServisFirmaForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const data = {
    ad: form.ad.trim(),
    yetkiliAdi: form.yetkiliAdi?.trim() || null,
    telefon: form.telefon?.trim() || null,
    eposta: form.eposta?.trim() || null,
    adres: form.adres?.trim() || null,
  }

  return prisma.$transaction(async (tx) => {
    const firma = await tx.servisFirma.create({ data })
    await kaydetIslemGecmisi({ tx, hedefTipi: 'FIRMA', hedefId: firma.id, islem: 'OLUSTURMA', yapanId, yeniDeger: data })
    return firma
  })
}

export async function updateServisFirma(id: string, form: ServisFirmaForm, yapanId?: string | null) {
  const { valid, errors } = validateServisFirmaForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const existing = await prisma.servisFirma.findUnique({ where: { id } })
  if (!existing) throw new Error('Firma bulunamadı.')

  const data = {
    ad: form.ad.trim(),
    yetkiliAdi: form.yetkiliAdi?.trim() || null,
    telefon: form.telefon?.trim() || null,
    eposta: form.eposta?.trim() || null,
    adres: form.adres?.trim() || null,
  }
  const fark = degisenAlanlar(existing, data, ['ad', 'yetkiliAdi', 'telefon', 'eposta', 'adres'])

  return prisma.$transaction(async (tx) => {
    const guncel = await tx.servisFirma.update({ where: { id }, data })
    if (fark) {
      await kaydetIslemGecmisi({ tx, hedefTipi: 'FIRMA', hedefId: id, islem: 'GUNCELLEME', yapanId, ...fark })
    }
    return guncel
  })
}

export async function pasiflestirServisFirma(id: string, yapanId?: string | null) {
  const existing = await prisma.servisFirma.findUnique({ where: { id } })
  if (!existing) throw new Error('Firma bulunamadı.')
  if (!existing.aktif) throw new Error('Firma zaten pasif.')

  return prisma.$transaction(async (tx) => {
    const guncel = await tx.servisFirma.update({ where: { id }, data: { aktif: false } })
    await kaydetIslemGecmisi({
      tx, hedefTipi: 'FIRMA', hedefId: id, islem: 'PASIFLESTIRME', yapanId,
      oncekiDeger: { aktif: true }, yeniDeger: { aktif: false },
    })
    return guncel
  })
}

export async function geriAlServisFirma(id: string, yapanId?: string | null) {
  const existing = await prisma.servisFirma.findUnique({ where: { id } })
  if (!existing) throw new Error('Firma bulunamadı.')
  if (existing.aktif) throw new Error('Firma zaten aktif.')

  return prisma.$transaction(async (tx) => {
    const guncel = await tx.servisFirma.update({ where: { id }, data: { aktif: true } })
    await kaydetIslemGecmisi({
      tx, hedefTipi: 'FIRMA', hedefId: id, islem: 'AKTIFLESTIRME', yapanId,
      oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
    })
    return guncel
  })
}

// ============================================================================
// ServisYerleske
// ============================================================================

export async function listServisYerleskeler(filtre?: { aktif?: boolean }) {
  return prisma.servisYerleske.findMany({
    where: filtre?.aktif !== undefined ? { aktif: filtre.aktif } : undefined,
    orderBy: { ad: 'asc' },
  })
}

export async function createServisYerleske(form: ServisYerleskeForm) {
  const { valid, errors } = validateServisYerleskeForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const kod = form.kod.trim().toUpperCase()
  const existing = await prisma.servisYerleske.findUnique({ where: { kod } })
  if (existing) throw new Error(`"${kod}" kodu zaten kullanılıyor.`)

  return prisma.servisYerleske.create({
    data: {
      kod,
      ad: form.ad.trim(),
      adres: form.adres?.trim() || null,
      enlem: form.enlem ?? null,
      boylam: form.boylam ?? null,
    },
  })
}

export async function updateServisYerleske(id: string, form: ServisYerleskeForm) {
  const { valid, errors } = validateServisYerleskeForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const existing = await prisma.servisYerleske.findUnique({ where: { id } })
  if (!existing) throw new Error('Yerleşke bulunamadı.')

  const kod = form.kod.trim().toUpperCase()
  if (kod !== existing.kod) {
    const kodCakismasi = await prisma.servisYerleske.findUnique({ where: { kod } })
    if (kodCakismasi) throw new Error(`"${kod}" kodu zaten kullanılıyor.`)
  }

  return prisma.servisYerleske.update({
    where: { id },
    data: {
      kod,
      ad: form.ad.trim(),
      adres: form.adres?.trim() || null,
      enlem: form.enlem ?? null,
      boylam: form.boylam ?? null,
    },
  })
}

export async function pasiflestirServisYerleske(id: string) {
  const existing = await prisma.servisYerleske.findUnique({ where: { id } })
  if (!existing) throw new Error('Yerleşke bulunamadı.')
  if (!existing.aktif) throw new Error('Yerleşke zaten pasif.')

  return prisma.servisYerleske.update({ where: { id }, data: { aktif: false } })
}

export async function geriAlServisYerleske(id: string) {
  const existing = await prisma.servisYerleske.findUnique({ where: { id } })
  if (!existing) throw new Error('Yerleşke bulunamadı.')
  if (existing.aktif) throw new Error('Yerleşke zaten aktif.')

  return prisma.servisYerleske.update({ where: { id }, data: { aktif: true } })
}

// ============================================================================
// ServisGuzergah
// ============================================================================

function dateOnlyOrNull(value?: string | null): Date | null {
  return value?.trim() ? new Date(`${value.trim()}T00:00:00.000Z`) : null
}

export async function listServisGuzergahlar(filtre?: { aktif?: boolean }) {
  return prisma.servisGuzergah.findMany({
    where: filtre?.aktif !== undefined ? { aktif: filtre.aktif } : undefined,
    include: { yerleske: { select: { id: true, kod: true, ad: true } } },
    orderBy: [{ kod: 'asc' }, { ad: 'asc' }],
  })
}

export async function createServisGuzergah(form: ServisGuzergahForm) {
  const { valid, errors } = validateServisGuzergahForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const kod = form.kod.trim().toUpperCase()
  const [kodCakismasi, yerleske] = await Promise.all([
    prisma.servisGuzergah.findUnique({ where: { kod } }),
    prisma.servisYerleske.findUnique({ where: { id: form.yerleskeId.trim() } }),
  ])
  if (kodCakismasi) throw new Error(`"${kod}" kodu zaten kullanılıyor.`)
  if (!yerleske) throw new Error('Yerleşke bulunamadı.')

  return prisma.servisGuzergah.create({
    data: {
      kod,
      ad: form.ad.trim(),
      aciklama: form.aciklama?.trim() || null,
      bolge: form.bolge?.trim() || null,
      yerleskeId: form.yerleskeId.trim(),
      gecerlilikBaslangici: dateOnlyOrNull(form.gecerlilikBaslangici),
      gecerlilikBitisi: dateOnlyOrNull(form.gecerlilikBitisi),
    },
    include: { yerleske: { select: { id: true, kod: true, ad: true } } },
  })
}

export async function updateServisGuzergah(id: string, form: ServisGuzergahForm) {
  const { valid, errors } = validateServisGuzergahForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const existing = await prisma.servisGuzergah.findUnique({ where: { id } })
  if (!existing) throw new Error('Güzergâh bulunamadı.')

  const kod = form.kod.trim().toUpperCase()
  const [kodCakismasi, yerleske] = await Promise.all([
    kod !== existing.kod ? prisma.servisGuzergah.findUnique({ where: { kod } }) : Promise.resolve(null),
    prisma.servisYerleske.findUnique({ where: { id: form.yerleskeId.trim() } }),
  ])
  if (kodCakismasi) throw new Error(`"${kod}" kodu zaten kullanılıyor.`)
  if (!yerleske) throw new Error('Yerleşke bulunamadı.')

  return prisma.servisGuzergah.update({
    where: { id },
    data: {
      kod,
      ad: form.ad.trim(),
      aciklama: form.aciklama?.trim() || null,
      bolge: form.bolge?.trim() || null,
      yerleskeId: form.yerleskeId.trim(),
      gecerlilikBaslangici: dateOnlyOrNull(form.gecerlilikBaslangici),
      gecerlilikBitisi: dateOnlyOrNull(form.gecerlilikBitisi),
    },
    include: { yerleske: { select: { id: true, kod: true, ad: true } } },
  })
}

export async function pasiflestirServisGuzergah(id: string) {
  const existing = await prisma.servisGuzergah.findUnique({ where: { id } })
  if (!existing) throw new Error('Güzergâh bulunamadı.')
  if (!existing.aktif) throw new Error('Güzergâh zaten pasif.')

  return prisma.servisGuzergah.update({ where: { id }, data: { aktif: false } })
}

export async function geriAlServisGuzergah(id: string) {
  const existing = await prisma.servisGuzergah.findUnique({ where: { id } })
  if (!existing) throw new Error('Güzergâh bulunamadı.')
  if (existing.aktif) throw new Error('Güzergâh zaten aktif.')

  return prisma.servisGuzergah.update({ where: { id }, data: { aktif: true } })
}

// ============================================================================
// ServisDurak
// ============================================================================

export async function listServisDuraklar(filtre?: { aktif?: boolean }) {
  return prisma.servisDurak.findMany({
    where: filtre?.aktif !== undefined ? { aktif: filtre.aktif } : undefined,
    orderBy: [{ kod: 'asc' }, { ad: 'asc' }],
  })
}

function servisDurakData(form: ServisDurakForm) {
  return {
    kod: form.kod.trim().toUpperCase(),
    ad: form.ad.trim(),
    adresEtiketi: form.adresEtiketi?.trim() || null,
    il: form.il?.trim() || null,
    ilce: form.ilce?.trim() || null,
    mahalle: form.mahalle?.trim() || null,
    enlem: form.enlem ?? null,
    boylam: form.boylam ?? null,
  }
}

export async function createServisDurak(form: ServisDurakForm) {
  const { valid, errors } = validateServisDurakForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const data = servisDurakData(form)
  const existing = await prisma.servisDurak.findUnique({ where: { kod: data.kod } })
  if (existing) throw new Error(`"${data.kod}" kodu zaten kullanılıyor.`)

  return prisma.servisDurak.create({ data })
}

export async function updateServisDurak(id: string, form: ServisDurakForm) {
  const { valid, errors } = validateServisDurakForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const existing = await prisma.servisDurak.findUnique({ where: { id } })
  if (!existing) throw new Error('Durak bulunamadı.')

  const data = servisDurakData(form)
  if (data.kod !== existing.kod) {
    const kodCakismasi = await prisma.servisDurak.findUnique({ where: { kod: data.kod } })
    if (kodCakismasi) throw new Error(`"${data.kod}" kodu zaten kullanılıyor.`)
  }

  return prisma.servisDurak.update({ where: { id }, data })
}

export async function pasiflestirServisDurak(id: string) {
  const existing = await prisma.servisDurak.findUnique({ where: { id } })
  if (!existing) throw new Error('Durak bulunamadı.')
  if (!existing.aktif) throw new Error('Durak zaten pasif.')

  return prisma.servisDurak.update({ where: { id }, data: { aktif: false } })
}

export async function geriAlServisDurak(id: string) {
  const existing = await prisma.servisDurak.findUnique({ where: { id } })
  if (!existing) throw new Error('Durak bulunamadı.')
  if (existing.aktif) throw new Error('Durak zaten aktif.')

  return prisma.servisDurak.update({ where: { id }, data: { aktif: true } })
}

// ============================================================================
// ServisArac — yalnız taşeron araç master kaydı
// ============================================================================

export function normalizeServisAracPlaka(plaka: string): string {
  return plaka.replace(/\s+/g, '').toLocaleUpperCase('tr-TR')
}

export async function listServisAraclar(filtre?: { aktif?: boolean }) {
  return prisma.servisArac.findMany({
    where: filtre?.aktif !== undefined ? { aktif: filtre.aktif } : undefined,
    include: { firma: { select: { id: true, ad: true, aktif: true } } },
    orderBy: { plaka: 'asc' },
  })
}

function servisAracData(form: ServisAracForm) {
  return {
    plaka: normalizeServisAracPlaka(form.plaka),
    kapasite: form.kapasite,
    firmaId: form.firmaId.trim(),
    aracTipi: form.aracTipi?.trim() || null,
    gecerlilikBaslangici: dateOnlyOrNull(form.gecerlilikBaslangici),
    gecerlilikBitisi: dateOnlyOrNull(form.gecerlilikBitisi),
  }
}

export async function createServisArac(form: ServisAracForm) {
  const { valid, errors } = validateServisAracForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const data = servisAracData(form)
  const [plakaCakismasi, firma] = await Promise.all([
    prisma.servisArac.findUnique({ where: { plaka: data.plaka } }),
    prisma.servisFirma.findUnique({ where: { id: data.firmaId } }),
  ])
  if (plakaCakismasi) throw new Error(`"${data.plaka}" plakası zaten kullanılıyor.`)
  if (!firma) throw new Error('Firma bulunamadı.')
  if (!firma.aktif) throw new Error('Pasif firmaya araç bağlanamaz.')

  return prisma.servisArac.create({
    data,
    include: { firma: { select: { id: true, ad: true, aktif: true } } },
  })
}

export async function updateServisArac(id: string, form: ServisAracForm) {
  const { valid, errors } = validateServisAracForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const existing = await prisma.servisArac.findUnique({ where: { id } })
  if (!existing) throw new Error('Araç bulunamadı.')

  const data = servisAracData(form)
  const [plakaCakismasi, firma] = await Promise.all([
    data.plaka !== existing.plaka
      ? prisma.servisArac.findUnique({ where: { plaka: data.plaka } })
      : Promise.resolve(null),
    prisma.servisFirma.findUnique({ where: { id: data.firmaId } }),
  ])
  if (plakaCakismasi) throw new Error(`"${data.plaka}" plakası zaten kullanılıyor.`)
  if (!firma) throw new Error('Firma bulunamadı.')
  if (!firma.aktif) throw new Error('Pasif firmaya araç bağlanamaz.')

  return prisma.servisArac.update({
    where: { id },
    data,
    include: { firma: { select: { id: true, ad: true, aktif: true } } },
  })
}

export async function pasiflestirServisArac(id: string) {
  const existing = await prisma.servisArac.findUnique({ where: { id } })
  if (!existing) throw new Error('Araç bulunamadı.')
  if (!existing.aktif) throw new Error('Araç zaten pasif.')

  return prisma.servisArac.update({ where: { id }, data: { aktif: false } })
}

export async function geriAlServisArac(id: string) {
  const existing = await prisma.servisArac.findUnique({ where: { id } })
  if (!existing) throw new Error('Araç bulunamadı.')
  if (existing.aktif) throw new Error('Araç zaten aktif.')

  return prisma.servisArac.update({ where: { id }, data: { aktif: true } })
}

// ============================================================================
// ServisSofor — dış firma şoförü ya da dahili personel şoförü master kaydı
// ============================================================================

const servisSoforInclude = {
  firma: { select: { id: true, ad: true, aktif: true } },
  personnel: { select: { id: true, adSoyad: true, sicilNo: true, aktif: true } },
} as const

export async function listServisSoforler(filtre?: { aktif?: boolean }) {
  return prisma.servisSofor.findMany({
    where: filtre?.aktif !== undefined ? { aktif: filtre.aktif } : undefined,
    include: servisSoforInclude,
    orderBy: { adSoyad: 'asc' },
  })
}

function servisSoforKimlikData(
  form: ServisSoforForm,
  kimlik: { mevcutDisFirmaSoforKodu?: string | null },
) {
  const firmaId = form.firmaId?.trim() || null
  if (firmaId) {
    return {
      firmaId,
      personnelId: null,
      disFirmaSoforKodu: kimlik.mevcutDisFirmaSoforKodu || `DIS-${crypto.randomUUID().toUpperCase()}`,
    }
  }
  return {
    firmaId: null,
    personnelId: form.personnelId!.trim(),
    disFirmaSoforKodu: null,
  }
}

async function dogrulaServisSoforKimlik(
  kimlik: { firmaId: string | null; personnelId: string | null },
  existingId?: string,
) {
  if (kimlik.firmaId) {
    const firma = await prisma.servisFirma.findUnique({ where: { id: kimlik.firmaId } })
    if (!firma) throw new Error('Firma bulunamadı.')
    if (!firma.aktif) throw new Error('Pasif firmaya şoför bağlanamaz.')
    return
  }

  const personnel = await prisma.personnel.findUnique({ where: { id: kimlik.personnelId! } })
  if (!personnel) throw new Error('Personel bulunamadı.')
  if (!personnel.aktif) throw new Error('Pasif personel şoför olarak atanamaz.')

  const baskaSofor = await prisma.servisSofor.findUnique({ where: { personnelId: kimlik.personnelId! } })
  if (baskaSofor && baskaSofor.id !== existingId) {
    throw new Error('Bu personel zaten bir şoför kaydına bağlı.')
  }
}

export async function createServisSofor(form: ServisSoforForm) {
  const { valid, errors } = validateServisSoforForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const kimlik = servisSoforKimlikData(form, {})
  await dogrulaServisSoforKimlik(kimlik)

  return prisma.servisSofor.create({
    data: {
      adSoyad: form.adSoyad.trim(),
      telefon: normalizeServisSoforTelefon(form.telefon),
      ...kimlik,
    },
    include: servisSoforInclude,
  })
}

export async function updateServisSofor(id: string, form: ServisSoforForm) {
  const { valid, errors } = validateServisSoforForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const existing = await prisma.servisSofor.findUnique({ where: { id } })
  if (!existing) throw new Error('Şoför bulunamadı.')

  const kimlik = servisSoforKimlikData(form, { mevcutDisFirmaSoforKodu: existing.disFirmaSoforKodu })
  await dogrulaServisSoforKimlik(kimlik, id)

  return prisma.servisSofor.update({
    where: { id },
    data: {
      adSoyad: form.adSoyad.trim(),
      telefon: normalizeServisSoforTelefon(form.telefon),
      ...kimlik,
    },
    include: servisSoforInclude,
  })
}

export async function pasiflestirServisSofor(id: string) {
  const existing = await prisma.servisSofor.findUnique({ where: { id } })
  if (!existing) throw new Error('Şoför bulunamadı.')
  if (!existing.aktif) throw new Error('Şoför zaten pasif.')

  return prisma.servisSofor.update({ where: { id }, data: { aktif: false } })
}

export async function geriAlServisSofor(id: string) {
  const existing = await prisma.servisSofor.findUnique({ where: { id } })
  if (!existing) throw new Error('Şoför bulunamadı.')
  if (existing.aktif) throw new Error('Şoför zaten aktif.')

  return prisma.servisSofor.update({ where: { id }, data: { aktif: true } })
}

// ============================================================================
// ServisSeferDilimi — sabit enum yerine lookup tablosu (vardiya × yön dilimi)
// ============================================================================

export async function listServisSeferDilimleri(filtre?: { aktif?: boolean }) {
  return prisma.servisSeferDilimi.findMany({
    where: filtre?.aktif !== undefined ? { aktif: filtre.aktif } : undefined,
    orderBy: [{ sira: 'asc' }, { kod: 'asc' }],
  })
}

function servisSeferDilimiData(form: ServisSeferDilimiForm) {
  return {
    kod: form.kod.trim().toUpperCase(),
    ad: form.ad.trim(),
    yon: form.yon,
    grupKodu: form.grupKodu?.trim() || null,
    sira: form.sira,
  }
}

export async function createServisSeferDilimi(form: ServisSeferDilimiForm) {
  const { valid, errors } = validateServisSeferDilimiForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const data = servisSeferDilimiData(form)
  const existing = await prisma.servisSeferDilimi.findUnique({ where: { kod: data.kod } })
  if (existing) throw new Error(`"${data.kod}" kodu zaten kullanılıyor.`)

  return prisma.servisSeferDilimi.create({ data })
}

export async function updateServisSeferDilimi(id: string, form: ServisSeferDilimiForm) {
  const { valid, errors } = validateServisSeferDilimiForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const existing = await prisma.servisSeferDilimi.findUnique({ where: { id } })
  if (!existing) throw new Error('Sefer dilimi bulunamadı.')

  const data = servisSeferDilimiData(form)
  if (data.kod !== existing.kod) {
    const kodCakismasi = await prisma.servisSeferDilimi.findUnique({ where: { kod: data.kod } })
    if (kodCakismasi) throw new Error(`"${data.kod}" kodu zaten kullanılıyor.`)
  }

  return prisma.servisSeferDilimi.update({ where: { id }, data })
}

export async function pasiflestirServisSeferDilimi(id: string) {
  const existing = await prisma.servisSeferDilimi.findUnique({ where: { id } })
  if (!existing) throw new Error('Sefer dilimi bulunamadı.')
  if (!existing.aktif) throw new Error('Sefer dilimi zaten pasif.')

  return prisma.servisSeferDilimi.update({ where: { id }, data: { aktif: false } })
}

export async function geriAlServisSeferDilimi(id: string) {
  const existing = await prisma.servisSeferDilimi.findUnique({ where: { id } })
  if (!existing) throw new Error('Sefer dilimi bulunamadı.')
  if (existing.aktif) throw new Error('Sefer dilimi zaten aktif.')

  return prisma.servisSeferDilimi.update({ where: { id }, data: { aktif: true } })
}

// ============================================================================
// ServisGuzergahDurak — güzergahın sıralı durak listesi
// ============================================================================
//
// sira, (guzergahId, sira) üzerinde DB'de ANLIK (deferrable olmayan) unique
// kısıtla korunur. Pasifleştirme sira'yı DEĞİŞTİRMEZ — yalnız aktif=false
// yapar; satır asla hard-delete edilmez çünkü ServisPersonelAtama geçmiş bir
// atamanın hedefini (guzergahId, durakId) bileşik anahtarıyla buraya
// referans verir (bkz. schema.prisma yorumu). sira'nın kendisi yalnız
// gösterim/sıralama amaçlıdır — iş kuralı/tarihçe sira'ya bakmaz.

const SIRA_GECICI_OFSET = 1_000_000

const servisGuzergahDurakInclude = {
  durak: { select: { id: true, kod: true, ad: true, aktif: true } },
  saatler: {
    include: { dilim: { select: { id: true, kod: true, ad: true, yon: true } } },
  },
} as const

export async function listServisGuzergahDuraklar(guzergahId: string, filtre?: { aktif?: boolean }) {
  return prisma.servisGuzergahDurak.findMany({
    where: { guzergahId, ...(filtre?.aktif !== undefined ? { aktif: filtre.aktif } : {}) },
    include: servisGuzergahDurakInclude,
    orderBy: { sira: 'asc' },
  })
}

export async function createServisGuzergahDurak(guzergahId: string, form: ServisGuzergahDurakForm) {
  const { valid, errors } = validateServisGuzergahDurakForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const durakId = form.durakId.trim()
  const [guzergah, durak, mevcut, sonuncusu] = await Promise.all([
    prisma.servisGuzergah.findUnique({ where: { id: guzergahId } }),
    prisma.servisDurak.findUnique({ where: { id: durakId } }),
    prisma.servisGuzergahDurak.findUnique({ where: { guzergahId_durakId: { guzergahId, durakId } } }),
    prisma.servisGuzergahDurak.findFirst({ where: { guzergahId }, orderBy: { sira: 'desc' } }),
  ])
  if (!guzergah) throw new Error('Güzergâh bulunamadı.')
  if (!guzergah.aktif) throw new Error('Pasif güzergaha durak eklenemez.')
  if (!durak) throw new Error('Durak bulunamadı.')
  if (!durak.aktif) throw new Error('Pasif durak güzergaha eklenemez.')
  if (mevcut) {
    throw new Error(
      mevcut.aktif
        ? 'Bu durak zaten bu güzergahta.'
        : 'Bu durak bu güzergahta daha önce eklenmiş ve pasifleştirilmiş — yeniden eklemek yerine geri alın.',
    )
  }

  return prisma.servisGuzergahDurak.create({
    data: { guzergahId, durakId, sira: (sonuncusu?.sira ?? 0) + 1 },
    include: servisGuzergahDurakInclude,
  })
}

export async function pasiflestirServisGuzergahDurak(id: string) {
  const existing = await prisma.servisGuzergahDurak.findUnique({ where: { id } })
  if (!existing) throw new Error('Güzergâh-durak eşleşmesi bulunamadı.')
  if (!existing.aktif) throw new Error('Durak zaten pasif.')

  return prisma.servisGuzergahDurak.update({
    where: { id },
    data: { aktif: false },
    include: servisGuzergahDurakInclude,
  })
}

export async function geriAlServisGuzergahDurak(id: string) {
  const existing = await prisma.servisGuzergahDurak.findUnique({ where: { id } })
  if (!existing) throw new Error('Güzergâh-durak eşleşmesi bulunamadı.')
  if (existing.aktif) throw new Error('Durak zaten aktif.')

  return prisma.servisGuzergahDurak.update({
    where: { id },
    data: { aktif: true },
    include: servisGuzergahDurakInclude,
  })
}

// Komşu aktif kayıtla sira değiştirir (yukarı/aşağı ok butonları). Üç adımlı
// transaction ZORUNLU: doğrudan "seçili.sira = komşu.sira" yazımı, komşu o
// sira'yı hâlâ taşırken @@unique([guzergahId, sira]) ihlali fırlatır (anlık
// kontrol edilir, deferrable değil) — seçili önce aralık dışı geçici bir
// sira'ya taşınmalı.
export async function siraDegistirServisGuzergahDurak(
  guzergahId: string,
  id: string,
  yon: 'YUKARI' | 'ASAGI',
) {
  const aktifSirali = await prisma.servisGuzergahDurak.findMany({
    where: { guzergahId, aktif: true },
    orderBy: { sira: 'asc' },
  })
  const index = aktifSirali.findIndex((d) => d.id === id)
  if (index === -1) throw new Error('Güzergâh-durak eşleşmesi bulunamadı veya pasif.')

  const komsuIndex = yon === 'YUKARI' ? index - 1 : index + 1
  if (komsuIndex < 0 || komsuIndex >= aktifSirali.length) {
    return listServisGuzergahDuraklar(guzergahId)
  }

  const seciliId = aktifSirali[index].id
  const seciliSira = aktifSirali[index].sira
  const komsuId = aktifSirali[komsuIndex].id
  const komsuSira = aktifSirali[komsuIndex].sira

  await prisma.$transaction([
    prisma.servisGuzergahDurak.update({
      where: { id: seciliId },
      data: { sira: seciliSira + SIRA_GECICI_OFSET },
    }),
    prisma.servisGuzergahDurak.update({ where: { id: komsuId }, data: { sira: seciliSira } }),
    prisma.servisGuzergahDurak.update({ where: { id: seciliId }, data: { sira: komsuSira } }),
  ])

  return listServisGuzergahDuraklar(guzergahId)
}

// Sürükle-bırak sonrası tam liste yeniden sıralama. `siraliIdler` YALNIZ aktif
// kayıtları, istenen yeni sırayla içermeli — pasif kayıtlar (varsa) listenin
// sonuna eklenir (sira'ları pasif kayıtlar için anlamsızdır, yalnız unique
// kalmaları yeterlidir). İki fazlı transaction: önce TÜM etkilenen satırlar
// çakışmayacak geçici değerlere, sonra 1..N'e taşınır — @@unique([guzergahId,
// sira]) anlık kontrol edildiği için tek fazda (index+1) doğrudan yazmak
// mevcut değerlerle çakışabilir.
export async function yenidenSiralaServisGuzergahDuraklar(guzergahId: string, siraliIdler: string[]) {
  const tumKayitlar = await prisma.servisGuzergahDurak.findMany({
    where: { guzergahId },
    orderBy: { sira: 'asc' },
  })

  const aktifIdSeti = new Set(tumKayitlar.filter((d) => d.aktif).map((d) => d.id))
  const gelenIdSeti = new Set(siraliIdler)
  const birebirEsit =
    siraliIdler.length === aktifIdSeti.size &&
    siraliIdler.every((id) => aktifIdSeti.has(id)) &&
    [...aktifIdSeti].every((id) => gelenIdSeti.has(id))
  if (!birebirEsit) {
    throw new Error('Sıralama listesi bu güzergahın aktif duraklarıyla birebir eşleşmiyor.')
  }

  const pasifIdler = tumKayitlar.filter((d) => !d.aktif).map((d) => d.id)
  const nihaiSiraliListe = [...siraliIdler, ...pasifIdler]

  await prisma.$transaction([
    ...nihaiSiraliListe.map((id, index) =>
      prisma.servisGuzergahDurak.update({
        where: { id },
        data: { sira: index + 1 + SIRA_GECICI_OFSET },
      }),
    ),
    ...nihaiSiraliListe.map((id, index) =>
      prisma.servisGuzergahDurak.update({ where: { id }, data: { sira: index + 1 } }),
    ),
  ])

  return listServisGuzergahDuraklar(guzergahId)
}

// ============================================================================
// ServisGuzergahDurakSaat — dilim bazlı biniş/iniş saati (tanım verisi,
// aktif/tarihçe YOK — satır doğrudan güncellenir veya silinir, bkz.
// schema.prisma yorumu)
// ============================================================================

const servisGuzergahDurakSaatInclude = {
  dilim: { select: { id: true, kod: true, ad: true, yon: true } },
} as const

export async function guzergahDurakSaatiKaydet(guzergahDurakId: string, form: ServisGuzergahDurakSaatForm) {
  const { valid, errors } = validateServisGuzergahDurakSaatForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const dilimId = form.dilimId.trim()
  const [guzergahDurak, dilim] = await Promise.all([
    prisma.servisGuzergahDurak.findUnique({ where: { id: guzergahDurakId } }),
    prisma.servisSeferDilimi.findUnique({ where: { id: dilimId } }),
  ])
  if (!guzergahDurak) throw new Error('Güzergâh-durak eşleşmesi bulunamadı.')
  if (!guzergahDurak.aktif) throw new Error('Pasif güzergâh-durak eşleşmesine saat girilemez.')
  if (!dilim) throw new Error('Sefer dilimi bulunamadı.')
  if (!dilim.aktif) throw new Error('Pasif sefer dilimine saat girilemez.')

  return prisma.servisGuzergahDurakSaat.upsert({
    where: { guzergahDurakId_dilimId: { guzergahDurakId, dilimId } },
    create: { guzergahDurakId, dilimId, saat: form.saat.trim() },
    update: { saat: form.saat.trim() },
    include: servisGuzergahDurakSaatInclude,
  })
}

export async function guzergahDurakSaatiSil(id: string) {
  const existing = await prisma.servisGuzergahDurakSaat.findUnique({ where: { id } })
  if (!existing) throw new Error('Saat kaydı bulunamadı.')

  return prisma.servisGuzergahDurakSaat.delete({ where: { id } })
}

// ============================================================================
// ServisGuzergahAracVarsayilan / ServisGuzergahSoforVarsayilan — güzergahın
// bir sefer diliminde varsayılan olarak hangi araç/şoförle çalıştığı
// (ANA/YEDEK). ZAMAN BAĞIMLI ATAMA — geçmiş korunur: satır asla silinmez
// veya kimlik alanları (aracId/soforId/dilimId/guzergahId/rol/baslangıç)
// üzerine yazılmaz. "Pasifleştirme" bitisTarihi yazıp aktif=false yapmaktır
// (kapatma tarihi kalıcı olarak kayıtta kalır); yeni bir atama HER ZAMAN
// yeni bir satırdır.
//
// DB'de EXCLUDE USING gist (aracId|soforId WITH =, dilimId WITH =,
// daterange(baslangicTarihi, COALESCE(bitisTarihi,'infinity'),'[]') WITH &&)
// WHERE (aktif=true AND rol='ANA') — yalnız migration SQL'inde tanımlı,
// Prisma'da ifade edilemez. ÖNEMLİ (migration SQL yorumunda da açık):
// guzergahId bu kısıta DAHİL DEĞİL. Kısıt araç/şoför bazlı çalışır: aynı
// güzergah+dilimde birden fazla ANA araç/şoför olması (yoğun hat, 2 araç)
// kısıtı İHLAL ETMEZ (aracId farklı). İhlal eden şey: AYNI araç/şoförün
// AYNI dilimde çakışan tarih aralıklarında FARKLI güzergahların ANA'sı
// olması (fiziken aynı anda iki yerde olamaz). YEDEK satırları bu kısıtın
// tamamen dışındadır (WHERE rol='ANA' filtresi) — bir araç/şoför aynı anda
// birden çok güzergaha YEDEK yazılabilir, DB hiç kontrol etmez.
//
// Aşağıdaki cakisma kontrolü bu kuralı aplikasyon katmanında BİREBİR
// uygular (insert/update/geri-al öncesi) — çiğ Postgres EXCLUDE hatası
// kullanıcıya asla yansımaz.

function tarihStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function anaAracCakismasi(
  aracId: string,
  dilimId: string,
  baslangic: Date,
  bitis: Date | null,
  haricId?: string,
) {
  return prisma.servisGuzergahAracVarsayilan.findFirst({
    where: {
      aracId,
      dilimId,
      rol: 'ANA',
      aktif: true,
      ...(haricId ? { id: { not: haricId } } : {}),
      AND: [
        { OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: baslangic } }] },
        ...(bitis ? [{ baslangicTarihi: { lte: bitis } }] : []),
      ],
    },
    include: { guzergah: { select: { id: true, kod: true, ad: true } } },
  })
}

async function anaSoforCakismasi(
  soforId: string,
  dilimId: string,
  baslangic: Date,
  bitis: Date | null,
  haricId?: string,
) {
  return prisma.servisGuzergahSoforVarsayilan.findFirst({
    where: {
      soforId,
      dilimId,
      rol: 'ANA',
      aktif: true,
      ...(haricId ? { id: { not: haricId } } : {}),
      AND: [
        { OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: baslangic } }] },
        ...(bitis ? [{ baslangicTarihi: { lte: bitis } }] : []),
      ],
    },
    include: { guzergah: { select: { id: true, kod: true, ad: true } } },
  })
}

function aracCakismaMesaji(cakisan: { baslangicTarihi: Date; bitisTarihi: Date | null; guzergah: { kod: string; ad: string } }): string {
  const araligi = cakisan.bitisTarihi
    ? `${tarihStr(cakisan.baslangicTarihi)} – ${tarihStr(cakisan.bitisTarihi)}`
    : `${tarihStr(cakisan.baslangicTarihi)} tarihinden itibaren süresiz`
  return `Bu araç ${araligi} aralığında zaten "${cakisan.guzergah.kod} — ${cakisan.guzergah.ad}" güzergahının ANA aracı. Önce o atamayı kapatmalısınız.`
}

function soforCakismaMesaji(cakisan: { baslangicTarihi: Date; bitisTarihi: Date | null; guzergah: { kod: string; ad: string } }): string {
  const araligi = cakisan.bitisTarihi
    ? `${tarihStr(cakisan.baslangicTarihi)} – ${tarihStr(cakisan.bitisTarihi)}`
    : `${tarihStr(cakisan.baslangicTarihi)} tarihinden itibaren süresiz`
  return `Bu şoför ${araligi} aralığında zaten "${cakisan.guzergah.kod} — ${cakisan.guzergah.ad}" güzergahının ANA şoförü. Önce o atamayı kapatmalısınız.`
}

const servisGuzergahAracVarsayilanInclude = {
  guzergah: { select: { id: true, kod: true, ad: true } },
  dilim: { select: { id: true, kod: true, ad: true, yon: true } },
  arac: { select: { id: true, plaka: true, aktif: true } },
} as const

export async function listServisGuzergahAracVarsayilanlari(guzergahId: string, filtre?: { aktif?: boolean }) {
  return prisma.servisGuzergahAracVarsayilan.findMany({
    where: { guzergahId, ...(filtre?.aktif !== undefined ? { aktif: filtre.aktif } : {}) },
    include: servisGuzergahAracVarsayilanInclude,
    orderBy: [{ aktif: 'desc' }, { baslangicTarihi: 'desc' }],
  })
}

export async function createServisGuzergahAracVarsayilan(
  form: ServisGuzergahAracVarsayilanForm,
  createdById: string,
) {
  const { valid, errors } = validateServisGuzergahAracVarsayilanForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const guzergahId = form.guzergahId.trim()
  const dilimId = form.dilimId.trim()
  const aracId = form.aracId.trim()
  const baslangic = dateOnlyOrNull(form.baslangicTarihi)!
  const bitis = dateOnlyOrNull(form.bitisTarihi)

  const [guzergah, dilim, arac] = await Promise.all([
    prisma.servisGuzergah.findUnique({ where: { id: guzergahId } }),
    prisma.servisSeferDilimi.findUnique({ where: { id: dilimId } }),
    prisma.servisArac.findUnique({ where: { id: aracId } }),
  ])
  if (!guzergah) throw new Error('Güzergâh bulunamadı.')
  if (!guzergah.aktif) throw new Error('Pasif güzergaha varsayılan araç ataması yapılamaz.')
  if (!dilim) throw new Error('Sefer dilimi bulunamadı.')
  if (!dilim.aktif) throw new Error('Pasif sefer dilimine varsayılan araç ataması yapılamaz.')
  if (!arac) throw new Error('Araç bulunamadı.')
  if (!arac.aktif) throw new Error('Pasif araç varsayılan olarak atanamaz.')

  if (form.rol === 'ANA') {
    const cakisan = await anaAracCakismasi(aracId, dilimId, baslangic, bitis)
    if (cakisan) throw new Error(aracCakismaMesaji(cakisan))
  }

  return prisma.servisGuzergahAracVarsayilan.create({
    data: {
      guzergahId,
      dilimId,
      aracId,
      rol: form.rol,
      baslangicTarihi: baslangic,
      bitisTarihi: bitis,
      neden: form.neden?.trim() || null,
      aciklama: form.aciklama?.trim() || null,
      createdById,
    },
    include: servisGuzergahAracVarsayilanInclude,
  })
}

export async function guncelleServisGuzergahAracVarsayilan(
  id: string,
  form: { bitisTarihi?: string | null; neden?: string | null; aciklama?: string | null },
  updatedById: string,
) {
  const existing = await prisma.servisGuzergahAracVarsayilan.findUnique({ where: { id } })
  if (!existing) throw new Error('Varsayılan araç ataması bulunamadı.')

  const data: { bitisTarihi?: Date | null; neden?: string | null; aciklama?: string | null; updatedById: string } = {
    updatedById,
  }

  if (form.bitisTarihi !== undefined) {
    const bitis = dateOnlyOrNull(form.bitisTarihi)
    if (form.bitisTarihi?.trim() && !bitis) throw new Error('Bitiş tarihi geçersiz.')
    if (bitis && bitis < existing.baslangicTarihi) throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.')

    if (existing.rol === 'ANA' && existing.aktif && bitis?.getTime() !== existing.bitisTarihi?.getTime()) {
      const cakisan = await anaAracCakismasi(existing.aracId, existing.dilimId, existing.baslangicTarihi, bitis, id)
      if (cakisan) throw new Error(aracCakismaMesaji(cakisan))
    }
    data.bitisTarihi = bitis
  }
  if (form.neden !== undefined) data.neden = form.neden?.trim() || null
  if (form.aciklama !== undefined) data.aciklama = form.aciklama?.trim() || null

  return prisma.servisGuzergahAracVarsayilan.update({
    where: { id },
    data,
    include: servisGuzergahAracVarsayilanInclude,
  })
}

export async function pasiflestirServisGuzergahAracVarsayilan(id: string, bitisTarihi: string, updatedById: string) {
  const existing = await prisma.servisGuzergahAracVarsayilan.findUnique({ where: { id } })
  if (!existing) throw new Error('Varsayılan araç ataması bulunamadı.')
  if (!existing.aktif) throw new Error('Bu atama zaten pasif.')

  const bitis = dateOnlyOrNull(bitisTarihi)
  if (!bitisTarihi?.trim() || !bitis) throw new Error('Kapatma tarihi zorunludur ve geçerli olmalıdır.')
  if (bitis < existing.baslangicTarihi) throw new Error('Kapatma tarihi başlangıç tarihinden önce olamaz.')

  return prisma.servisGuzergahAracVarsayilan.update({
    where: { id },
    data: { bitisTarihi: bitis, aktif: false, updatedById },
    include: servisGuzergahAracVarsayilanInclude,
  })
}

export async function geriAlServisGuzergahAracVarsayilan(id: string, updatedById: string) {
  const existing = await prisma.servisGuzergahAracVarsayilan.findUnique({ where: { id } })
  if (!existing) throw new Error('Varsayılan araç ataması bulunamadı.')
  if (existing.aktif) throw new Error('Bu atama zaten aktif.')

  if (existing.rol === 'ANA') {
    const cakisan = await anaAracCakismasi(
      existing.aracId,
      existing.dilimId,
      existing.baslangicTarihi,
      existing.bitisTarihi,
      id,
    )
    if (cakisan) throw new Error(aracCakismaMesaji(cakisan))
  }

  return prisma.servisGuzergahAracVarsayilan.update({
    where: { id },
    data: { aktif: true, updatedById },
    include: servisGuzergahAracVarsayilanInclude,
  })
}

const servisGuzergahSoforVarsayilanInclude = {
  guzergah: { select: { id: true, kod: true, ad: true } },
  dilim: { select: { id: true, kod: true, ad: true, yon: true } },
  sofor: { select: { id: true, adSoyad: true, aktif: true } },
} as const

export async function listServisGuzergahSoforVarsayilanlari(guzergahId: string, filtre?: { aktif?: boolean }) {
  return prisma.servisGuzergahSoforVarsayilan.findMany({
    where: { guzergahId, ...(filtre?.aktif !== undefined ? { aktif: filtre.aktif } : {}) },
    include: servisGuzergahSoforVarsayilanInclude,
    orderBy: [{ aktif: 'desc' }, { baslangicTarihi: 'desc' }],
  })
}

export async function createServisGuzergahSoforVarsayilan(
  form: ServisGuzergahSoforVarsayilanForm,
  createdById: string,
) {
  const { valid, errors } = validateServisGuzergahSoforVarsayilanForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const guzergahId = form.guzergahId.trim()
  const dilimId = form.dilimId.trim()
  const soforId = form.soforId.trim()
  const baslangic = dateOnlyOrNull(form.baslangicTarihi)!
  const bitis = dateOnlyOrNull(form.bitisTarihi)

  const [guzergah, dilim, sofor] = await Promise.all([
    prisma.servisGuzergah.findUnique({ where: { id: guzergahId } }),
    prisma.servisSeferDilimi.findUnique({ where: { id: dilimId } }),
    prisma.servisSofor.findUnique({ where: { id: soforId } }),
  ])
  if (!guzergah) throw new Error('Güzergâh bulunamadı.')
  if (!guzergah.aktif) throw new Error('Pasif güzergaha varsayılan şoför ataması yapılamaz.')
  if (!dilim) throw new Error('Sefer dilimi bulunamadı.')
  if (!dilim.aktif) throw new Error('Pasif sefer dilimine varsayılan şoför ataması yapılamaz.')
  if (!sofor) throw new Error('Şoför bulunamadı.')
  if (!sofor.aktif) throw new Error('Pasif şoför varsayılan olarak atanamaz.')

  if (form.rol === 'ANA') {
    const cakisan = await anaSoforCakismasi(soforId, dilimId, baslangic, bitis)
    if (cakisan) throw new Error(soforCakismaMesaji(cakisan))
  }

  return prisma.servisGuzergahSoforVarsayilan.create({
    data: {
      guzergahId,
      dilimId,
      soforId,
      rol: form.rol,
      baslangicTarihi: baslangic,
      bitisTarihi: bitis,
      neden: form.neden?.trim() || null,
      aciklama: form.aciklama?.trim() || null,
      createdById,
    },
    include: servisGuzergahSoforVarsayilanInclude,
  })
}

export async function guncelleServisGuzergahSoforVarsayilan(
  id: string,
  form: { bitisTarihi?: string | null; neden?: string | null; aciklama?: string | null },
  updatedById: string,
) {
  const existing = await prisma.servisGuzergahSoforVarsayilan.findUnique({ where: { id } })
  if (!existing) throw new Error('Varsayılan şoför ataması bulunamadı.')

  const data: { bitisTarihi?: Date | null; neden?: string | null; aciklama?: string | null; updatedById: string } = {
    updatedById,
  }

  if (form.bitisTarihi !== undefined) {
    const bitis = dateOnlyOrNull(form.bitisTarihi)
    if (form.bitisTarihi?.trim() && !bitis) throw new Error('Bitiş tarihi geçersiz.')
    if (bitis && bitis < existing.baslangicTarihi) throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.')

    if (existing.rol === 'ANA' && existing.aktif && bitis?.getTime() !== existing.bitisTarihi?.getTime()) {
      const cakisan = await anaSoforCakismasi(existing.soforId, existing.dilimId, existing.baslangicTarihi, bitis, id)
      if (cakisan) throw new Error(soforCakismaMesaji(cakisan))
    }
    data.bitisTarihi = bitis
  }
  if (form.neden !== undefined) data.neden = form.neden?.trim() || null
  if (form.aciklama !== undefined) data.aciklama = form.aciklama?.trim() || null

  return prisma.servisGuzergahSoforVarsayilan.update({
    where: { id },
    data,
    include: servisGuzergahSoforVarsayilanInclude,
  })
}

export async function pasiflestirServisGuzergahSoforVarsayilan(id: string, bitisTarihi: string, updatedById: string) {
  const existing = await prisma.servisGuzergahSoforVarsayilan.findUnique({ where: { id } })
  if (!existing) throw new Error('Varsayılan şoför ataması bulunamadı.')
  if (!existing.aktif) throw new Error('Bu atama zaten pasif.')

  const bitis = dateOnlyOrNull(bitisTarihi)
  if (!bitisTarihi?.trim() || !bitis) throw new Error('Kapatma tarihi zorunludur ve geçerli olmalıdır.')
  if (bitis < existing.baslangicTarihi) throw new Error('Kapatma tarihi başlangıç tarihinden önce olamaz.')

  return prisma.servisGuzergahSoforVarsayilan.update({
    where: { id },
    data: { bitisTarihi: bitis, aktif: false, updatedById },
    include: servisGuzergahSoforVarsayilanInclude,
  })
}

export async function geriAlServisGuzergahSoforVarsayilan(id: string, updatedById: string) {
  const existing = await prisma.servisGuzergahSoforVarsayilan.findUnique({ where: { id } })
  if (!existing) throw new Error('Varsayılan şoför ataması bulunamadı.')
  if (existing.aktif) throw new Error('Bu atama zaten aktif.')

  if (existing.rol === 'ANA') {
    const cakisan = await anaSoforCakismasi(
      existing.soforId,
      existing.dilimId,
      existing.baslangicTarihi,
      existing.bitisTarihi,
      id,
    )
    if (cakisan) throw new Error(soforCakismaMesaji(cakisan))
  }

  return prisma.servisGuzergahSoforVarsayilan.update({
    where: { id },
    data: { aktif: true, updatedById },
    include: servisGuzergahSoforVarsayilanInclude,
  })
}

// ============================================================================
// ServisSorumlusu — servis sorumlusu (sürücüden AYRI bir rol, bkz.
// schema.prisma yorumu). ZAMAN BAĞIMLI ATAMA — geçmiş korunur, satır asla
// silinmez/üzerine yazılmaz; "pasifleştirme" bitisTarihi + aktif=false
// yazmaktır, yeni atama her zaman yeni satırdır (madde 14).
//
// ÖNEMLİ FARK (Araç/Şoför Varsayılan'dan): bu tabloda EXCLUDE/daterange
// çakışma kısıtı DB'de TANIMLI DEĞİL — migration SQL'de yalnız 4 EXCLUDE
// var (arac_varsayilan, sofor_varsayilan, personel_atama, personel_durum),
// servis_sorumlusu bunlardan biri değil. Bilinçli tasarım kararı olarak
// kabul edildi: bir personel aynı anda birden fazla güzergahın sorumlusu
// olabilir (fiziksel bir kaynak değil, gözetim/irtibat rolü). Bu yüzden
// burada ANA-çakışma kontrolü YOK — yalnız mevcut DB CHECK'in
// (bitisTarihi IS NULL OR bitisTarihi >= baslangicTarihi) aplikasyon
// katmanı karşılığı uygulanır.

const servisSorumlusuInclude = {
  guzergah: { select: { id: true, kod: true, ad: true } },
  personnel: { select: { id: true, adSoyad: true, sicilNo: true, aktif: true } },
} as const

export async function listServisSorumlulari(guzergahId: string, filtre?: { aktif?: boolean }) {
  return prisma.servisSorumlusu.findMany({
    where: { guzergahId, ...(filtre?.aktif !== undefined ? { aktif: filtre.aktif } : {}) },
    include: servisSorumlusuInclude,
    orderBy: [{ aktif: 'desc' }, { baslangicTarihi: 'desc' }],
  })
}

export async function createServisSorumlusu(form: ServisSorumlusuForm, createdById: string) {
  const { valid, errors } = validateServisSorumlusuForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const personnelId = form.personnelId.trim()
  const guzergahId = form.guzergahId.trim()
  const baslangic = dateOnlyOrNull(form.baslangicTarihi)!
  const bitis = dateOnlyOrNull(form.bitisTarihi)

  const [personnel, guzergah] = await Promise.all([
    prisma.personnel.findUnique({ where: { id: personnelId } }),
    prisma.servisGuzergah.findUnique({ where: { id: guzergahId } }),
  ])
  if (!personnel) throw new Error('Personel bulunamadı.')
  if (!personnel.aktif) throw new Error('Pasif personel servis sorumlusu olarak atanamaz.')
  if (!guzergah) throw new Error('Güzergâh bulunamadı.')
  if (!guzergah.aktif) throw new Error('Pasif güzergaha sorumlu atanamaz.')

  return prisma.servisSorumlusu.create({
    data: {
      personnelId,
      guzergahId,
      rol: form.rol,
      baslangicTarihi: baslangic,
      bitisTarihi: bitis,
      neden: form.neden?.trim() || null,
      aciklama: form.aciklama?.trim() || null,
      createdById,
    },
    include: servisSorumlusuInclude,
  })
}

export async function guncelleServisSorumlusu(
  id: string,
  form: { bitisTarihi?: string | null; neden?: string | null; aciklama?: string | null },
  updatedById: string,
) {
  const existing = await prisma.servisSorumlusu.findUnique({ where: { id } })
  if (!existing) throw new Error('Servis sorumlusu ataması bulunamadı.')

  const data: { bitisTarihi?: Date | null; neden?: string | null; aciklama?: string | null; updatedById: string } = {
    updatedById,
  }

  if (form.bitisTarihi !== undefined) {
    const bitis = dateOnlyOrNull(form.bitisTarihi)
    if (form.bitisTarihi?.trim() && !bitis) throw new Error('Bitiş tarihi geçersiz.')
    if (bitis && bitis < existing.baslangicTarihi) throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.')
    data.bitisTarihi = bitis
  }
  if (form.neden !== undefined) data.neden = form.neden?.trim() || null
  if (form.aciklama !== undefined) data.aciklama = form.aciklama?.trim() || null

  return prisma.servisSorumlusu.update({ where: { id }, data, include: servisSorumlusuInclude })
}

export async function pasiflestirServisSorumlusu(id: string, bitisTarihi: string, updatedById: string) {
  const existing = await prisma.servisSorumlusu.findUnique({ where: { id } })
  if (!existing) throw new Error('Servis sorumlusu ataması bulunamadı.')
  if (!existing.aktif) throw new Error('Bu atama zaten pasif.')

  const bitis = dateOnlyOrNull(bitisTarihi)
  if (!bitisTarihi?.trim() || !bitis) throw new Error('Kapatma tarihi zorunludur ve geçerli olmalıdır.')
  if (bitis < existing.baslangicTarihi) throw new Error('Kapatma tarihi başlangıç tarihinden önce olamaz.')

  return prisma.servisSorumlusu.update({
    where: { id },
    data: { bitisTarihi: bitis, aktif: false, updatedById },
    include: servisSorumlusuInclude,
  })
}

export async function geriAlServisSorumlusu(id: string, updatedById: string) {
  const existing = await prisma.servisSorumlusu.findUnique({ where: { id } })
  if (!existing) throw new Error('Servis sorumlusu ataması bulunamadı.')
  if (existing.aktif) throw new Error('Bu atama zaten aktif.')

  return prisma.servisSorumlusu.update({
    where: { id },
    data: { aktif: true, updatedById },
    include: servisSorumlusuInclude,
  })
}

// ============================================================================
// ServisPersonelDurum — güzergahtan BAĞIMSIZ, personel bazlı kullanım durumu
// ("KENDİ GELİYOR" bir güzergah/durak değil, kullanım durumudur — bkz.
// ServisKullanimDurumu şema yorumu). ZAMAN BAĞIMLI ATAMA — geçmiş korunur,
// satır asla silinmez/üzerine yazılmaz (madde 14/15).
//
// EXCLUDE USING gist (personnelId WITH =, daterange(...) WITH &&) WHERE
// (aktif=true) — Sorumlusu'nun aksine bu tabloda EXCLUDE VAR, Araç/Şoför
// Varsayılan'ın aksine rol/durum filtresi YOK: TÜM aktif kayıtlar aynı
// personel için birbiriyle çakışır (aynı personelin aynı anda iki farklı
// — hatta aynı — kullanım durumu olamaz). Kontrol BAŞTAN pozitif AND-of-OR
// formuyla yazıldı (Ders 59 — NOT+lt/gt formu NULL bitisTarihi'li
// (süresiz) satırları SQL'de UNKNOWN karşılaştırması yüzünden kaçırıp çiğ
// Postgres EXCLUDE hatası sızdırıyordu; Araç/Şoför Varsayılan'da tespit
// edilip düzeltilmişti, burada baştan doğru yazıldı).
//
// KVKK/minimum veri (madde 23): personel için yalnız görüntüleme amaçlı
// alanlar (id, adSoyad, sicilNo, bolum, aktif) çekilir — adres/telefon gibi
// alanlara bu ekranın hiçbir ihtiyacı yok.

function durumEtiketi(durum: string): string {
  switch (durum) {
    case 'SERVIS_KULLANIYOR':
      return 'Servis Kullanıyor'
    case 'KENDI_GELIYOR':
      return 'Kendi Geliyor'
    case 'KULLANMIYOR':
      return 'Kullanmıyor'
    default:
      return durum
  }
}

async function personelDurumCakismasi(
  personnelId: string,
  baslangic: Date,
  bitis: Date | null,
  haricId?: string,
) {
  return prisma.servisPersonelDurum.findFirst({
    where: {
      personnelId,
      aktif: true,
      ...(haricId ? { id: { not: haricId } } : {}),
      AND: [
        { OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: baslangic } }] },
        ...(bitis ? [{ baslangicTarihi: { lte: bitis } }] : []),
      ],
    },
  })
}

function personelDurumCakismaMesaji(cakisan: { baslangicTarihi: Date; bitisTarihi: Date | null; durum: string }): string {
  const araligi = cakisan.bitisTarihi
    ? `${tarihStr(cakisan.baslangicTarihi)} – ${tarihStr(cakisan.bitisTarihi)}`
    : `${tarihStr(cakisan.baslangicTarihi)} tarihinden itibaren süresiz`
  return `Bu personelin ${araligi} aralığında zaten aktif bir "${durumEtiketi(cakisan.durum)}" kaydı var. Önce onu kapatmalısınız.`
}

const servisPersonelDurumInclude = {
  personnel: { select: { id: true, adSoyad: true, sicilNo: true, bolum: true, aktif: true } },
} as const

export async function listServisPersonelDurumlari(filtre?: { personnelId?: string; aktif?: boolean }) {
  return prisma.servisPersonelDurum.findMany({
    where: {
      ...(filtre?.personnelId ? { personnelId: filtre.personnelId } : {}),
      ...(filtre?.aktif !== undefined ? { aktif: filtre.aktif } : {}),
    },
    include: servisPersonelDurumInclude,
    orderBy: [{ aktif: 'desc' }, { baslangicTarihi: 'desc' }],
  })
}

export async function createServisPersonelDurum(form: ServisPersonelDurumForm, createdById: string) {
  const { valid, errors } = validateServisPersonelDurumForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const personnelId = form.personnelId.trim()
  const baslangic = dateOnlyOrNull(form.baslangicTarihi)!
  const bitis = dateOnlyOrNull(form.bitisTarihi)

  const personnel = await prisma.personnel.findUnique({ where: { id: personnelId } })
  if (!personnel) throw new Error('Personel bulunamadı.')
  if (!personnel.aktif) throw new Error('Pasif personel için servis kullanım durumu kaydı oluşturulamaz.')

  const cakisan = await personelDurumCakismasi(personnelId, baslangic, bitis)
  if (cakisan) throw new Error(personelDurumCakismaMesaji(cakisan))

  return prisma.servisPersonelDurum.create({
    data: {
      personnelId,
      durum: form.durum,
      baslangicTarihi: baslangic,
      bitisTarihi: bitis,
      neden: form.neden?.trim() || null,
      createdById,
    },
    include: servisPersonelDurumInclude,
  })
}

export async function guncelleServisPersonelDurum(
  id: string,
  form: { bitisTarihi?: string | null; neden?: string | null },
  updatedById: string,
) {
  const existing = await prisma.servisPersonelDurum.findUnique({ where: { id } })
  if (!existing) throw new Error('Servis kullanım durumu kaydı bulunamadı.')

  const data: { bitisTarihi?: Date | null; neden?: string | null; updatedById: string } = { updatedById }

  if (form.bitisTarihi !== undefined) {
    const bitis = dateOnlyOrNull(form.bitisTarihi)
    if (form.bitisTarihi?.trim() && !bitis) throw new Error('Bitiş tarihi geçersiz.')
    if (bitis && bitis < existing.baslangicTarihi) throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.')

    if (existing.aktif && bitis?.getTime() !== existing.bitisTarihi?.getTime()) {
      const cakisan = await personelDurumCakismasi(existing.personnelId, existing.baslangicTarihi, bitis, id)
      if (cakisan) throw new Error(personelDurumCakismaMesaji(cakisan))
    }
    data.bitisTarihi = bitis
  }
  if (form.neden !== undefined) data.neden = form.neden?.trim() || null

  return prisma.servisPersonelDurum.update({ where: { id }, data, include: servisPersonelDurumInclude })
}

export async function pasiflestirServisPersonelDurum(id: string, bitisTarihi: string, updatedById: string) {
  const existing = await prisma.servisPersonelDurum.findUnique({ where: { id } })
  if (!existing) throw new Error('Servis kullanım durumu kaydı bulunamadı.')
  if (!existing.aktif) throw new Error('Bu kayıt zaten pasif.')

  const bitis = dateOnlyOrNull(bitisTarihi)
  if (!bitisTarihi?.trim() || !bitis) throw new Error('Kapatma tarihi zorunludur ve geçerli olmalıdır.')
  if (bitis < existing.baslangicTarihi) throw new Error('Kapatma tarihi başlangıç tarihinden önce olamaz.')

  return prisma.servisPersonelDurum.update({
    where: { id },
    data: { bitisTarihi: bitis, aktif: false, updatedById },
    include: servisPersonelDurumInclude,
  })
}

export async function geriAlServisPersonelDurum(id: string, updatedById: string) {
  const existing = await prisma.servisPersonelDurum.findUnique({ where: { id } })
  if (!existing) throw new Error('Servis kullanım durumu kaydı bulunamadı.')
  if (existing.aktif) throw new Error('Bu kayıt zaten aktif.')

  const cakisan = await personelDurumCakismasi(
    existing.personnelId,
    existing.baslangicTarihi,
    existing.bitisTarihi,
    id,
  )
  if (cakisan) throw new Error(personelDurumCakismaMesaji(cakisan))

  return prisma.servisPersonelDurum.update({
    where: { id },
    data: { aktif: true, updatedById },
    include: servisPersonelDurumInclude,
  })
}

// ============================================================================
// ServisPersonelAtama + ServisPersonelAtamaDilim — bir personelin bir
// güzergaha (opsiyonel: belirli bir durağa), N sefer diliminde geçerli
// ataması. ZAMAN BAĞIMLI — geçmiş korunur, satır asla silinmez/üzerine
// yazılmaz. Dilim seçimi de İMMUTABLE: bir atamanın dilimleri sonradan
// değiştirilemez (şema yorumu) — değişiklik = mevcut atamayı bitisTarihi
// ile kapat + yeni atama+dilim satırları aç.
//
// EXCLUDE USING gist (personnelId WITH =, daterange(...) WITH &&) WHERE
// (aktif=true) — ServisPersonelDurum ile BİREBİR aynı desen: guzergahId/
// durakId kısıta dahil değil, TÜM aktif atamalar personnelId bazında
// birbiriyle çakışır. Kontrol BAŞTAN pozitif AND-of-OR formuyla yazıldı.
//
// Bileşik FK (guzergahId, durakId) → servis_guzergah_durak(guzergahId,
// durakId) yalnız migration SQL'inde var, Prisma'da ifade edilemez —
// aşağıda create sırasında AYNI kuralı önceden kontrol edip çiğ FK
// hatası yerine anlaşılır mesaj veriyoruz.
//
// atamaKaynagi: UI'dan hiç seçtirilmiyor, HER ZAMAN 'MANUEL' yazılıyor —
// 'IMPORT' yalnız göç script'i (feat/servis-goc-script) içindir.

const servisPersonelAtamaInclude = {
  personnel: { select: { id: true, adSoyad: true, sicilNo: true, bolum: true, aktif: true } },
  guzergah: { select: { id: true, kod: true, ad: true } },
  durak: { select: { id: true, kod: true, ad: true } },
  dilimler: { include: { dilim: { select: { id: true, kod: true, ad: true, yon: true } } } },
} as const

async function personelAtamaCakismasi(
  personnelId: string,
  baslangic: Date,
  bitis: Date | null,
  haricId?: string,
) {
  return prisma.servisPersonelAtama.findFirst({
    where: {
      personnelId,
      aktif: true,
      ...(haricId ? { id: { not: haricId } } : {}),
      AND: [
        { OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: baslangic } }] },
        ...(bitis ? [{ baslangicTarihi: { lte: bitis } }] : []),
      ],
    },
    include: { guzergah: { select: { id: true, kod: true, ad: true } } },
  })
}

function personelAtamaCakismaMesaji(cakisan: { baslangicTarihi: Date; bitisTarihi: Date | null; guzergah: { kod: string; ad: string } }): string {
  const araligi = cakisan.bitisTarihi
    ? `${tarihStr(cakisan.baslangicTarihi)} – ${tarihStr(cakisan.bitisTarihi)}`
    : `${tarihStr(cakisan.baslangicTarihi)} tarihinden itibaren süresiz`
  return `Bu personelin ${araligi} aralığında zaten "${cakisan.guzergah.kod} — ${cakisan.guzergah.ad}" güzergahına aktif bir ataması var. Önce onu kapatmalısınız.`
}

export async function listServisPersonelAtamalari(guzergahId: string, filtre?: { aktif?: boolean }) {
  return prisma.servisPersonelAtama.findMany({
    where: { guzergahId, ...(filtre?.aktif !== undefined ? { aktif: filtre.aktif } : {}) },
    include: servisPersonelAtamaInclude,
    orderBy: [{ aktif: 'desc' }, { baslangicTarihi: 'desc' }],
  })
}

export async function createServisPersonelAtama(form: ServisPersonelAtamaForm, createdById: string) {
  const { valid, errors } = validateServisPersonelAtamaForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const personnelId = form.personnelId.trim()
  const guzergahId = form.guzergahId.trim()
  const durakId = form.durakId?.trim() || null
  const baslangic = dateOnlyOrNull(form.baslangicTarihi)!
  const bitis = dateOnlyOrNull(form.bitisTarihi)
  const dilimIdleri = [...new Set(form.dilimIdleri.map((d) => d.trim()).filter(Boolean))]

  const [personnel, guzergah, dilimler] = await Promise.all([
    prisma.personnel.findUnique({ where: { id: personnelId } }),
    prisma.servisGuzergah.findUnique({ where: { id: guzergahId } }),
    prisma.servisSeferDilimi.findMany({ where: { id: { in: dilimIdleri } } }),
  ])
  if (!personnel) throw new Error('Personel bulunamadı.')
  if (!personnel.aktif) throw new Error('Pasif personel servise atanamaz.')
  if (!guzergah) throw new Error('Güzergâh bulunamadı.')
  if (!guzergah.aktif) throw new Error('Pasif güzergaha personel atanamaz.')

  if (durakId) {
    const guzergahDurak = await prisma.servisGuzergahDurak.findUnique({
      where: { guzergahId_durakId: { guzergahId, durakId } },
    })
    if (!guzergahDurak) throw new Error('Bu durak, seçilen güzergahın bir durağı değil.')
  }

  if (dilimler.length !== dilimIdleri.length) throw new Error('Seçilen sefer dilimlerinden biri veya birkaçı bulunamadı.')
  const pasifDilim = dilimler.find((d) => !d.aktif)
  if (pasifDilim) throw new Error(`"${pasifDilim.kod}" dilimi pasif, atama yapılamaz.`)

  const cakisan = await personelAtamaCakismasi(personnelId, baslangic, bitis)
  if (cakisan) throw new Error(personelAtamaCakismaMesaji(cakisan))

  return prisma.$transaction(async (tx) => {
    const atama = await tx.servisPersonelAtama.create({
      data: {
        personnelId,
        guzergahId,
        durakId,
        baslangicTarihi: baslangic,
        bitisTarihi: bitis,
        atamaKaynagi: 'MANUEL',
        createdById,
      },
    })
    await tx.servisPersonelAtamaDilim.createMany({
      data: dilimIdleri.map((dilimId) => ({ atamaId: atama.id, dilimId })),
    })
    await kaydetIslemGecmisi({
      tx, hedefTipi: 'PERSONEL_ATAMA', hedefId: atama.id, islem: 'OLUSTURMA', yapanId: createdById,
      yeniDeger: { personnelId, guzergahId, durakId, baslangicTarihi: baslangic, bitisTarihi: bitis, atamaKaynagi: 'MANUEL' },
    })
    // Dilim seçimi immutable — set yalnız oluşturmada yazılır, hedefId
    // ATAMANIN id'si (dilim satırlarının kendi id'leri değil) ki "Geçmiş"
    // butonu ayni atama satirinda ikisini de gostersin.
    await kaydetIslemGecmisi({
      tx, hedefTipi: 'PERSONEL_ATAMA_DILIM', hedefId: atama.id, islem: 'OLUSTURMA', yapanId: createdById,
      yeniDeger: { dilimIdleri },
    })
    const sonuc = await tx.servisPersonelAtama.findUnique({
      where: { id: atama.id },
      include: servisPersonelAtamaInclude,
    })
    if (!sonuc) throw new Error('Atama oluşturulamadı.')
    return sonuc
  })
}

export async function guncelleServisPersonelAtama(
  id: string,
  form: { bitisTarihi?: string | null },
  updatedById: string,
) {
  const existing = await prisma.servisPersonelAtama.findUnique({ where: { id } })
  if (!existing) throw new Error('Personel ataması bulunamadı.')

  const data: { bitisTarihi?: Date | null; updatedById: string } = { updatedById }

  if (form.bitisTarihi !== undefined) {
    const bitis = dateOnlyOrNull(form.bitisTarihi)
    if (form.bitisTarihi?.trim() && !bitis) throw new Error('Bitiş tarihi geçersiz.')
    if (bitis && bitis < existing.baslangicTarihi) throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.')

    if (existing.aktif && bitis?.getTime() !== existing.bitisTarihi?.getTime()) {
      const cakisan = await personelAtamaCakismasi(existing.personnelId, existing.baslangicTarihi, bitis, id)
      if (cakisan) throw new Error(personelAtamaCakismaMesaji(cakisan))
    }
    data.bitisTarihi = bitis
  }

  const fark = degisenAlanlar(existing, data, ['bitisTarihi'])

  return prisma.$transaction(async (tx) => {
    const guncel = await tx.servisPersonelAtama.update({ where: { id }, data, include: servisPersonelAtamaInclude })
    if (fark) {
      await kaydetIslemGecmisi({ tx, hedefTipi: 'PERSONEL_ATAMA', hedefId: id, islem: 'GUNCELLEME', yapanId: updatedById, ...fark })
    }
    return guncel
  })
}

export async function pasiflestirServisPersonelAtama(id: string, bitisTarihi: string, updatedById: string) {
  const existing = await prisma.servisPersonelAtama.findUnique({ where: { id } })
  if (!existing) throw new Error('Personel ataması bulunamadı.')
  if (!existing.aktif) throw new Error('Bu atama zaten pasif.')

  const bitis = dateOnlyOrNull(bitisTarihi)
  if (!bitisTarihi?.trim() || !bitis) throw new Error('Kapatma tarihi zorunludur ve geçerli olmalıdır.')
  if (bitis < existing.baslangicTarihi) throw new Error('Kapatma tarihi başlangıç tarihinden önce olamaz.')

  return prisma.$transaction(async (tx) => {
    const guncel = await tx.servisPersonelAtama.update({
      where: { id },
      data: { bitisTarihi: bitis, aktif: false, updatedById },
      include: servisPersonelAtamaInclude,
    })
    await kaydetIslemGecmisi({
      tx, hedefTipi: 'PERSONEL_ATAMA', hedefId: id, islem: 'PASIFLESTIRME', yapanId: updatedById,
      oncekiDeger: { bitisTarihi: existing.bitisTarihi, aktif: true },
      yeniDeger: { bitisTarihi: bitis, aktif: false },
    })
    return guncel
  })
}

export async function geriAlServisPersonelAtama(id: string, updatedById: string) {
  const existing = await prisma.servisPersonelAtama.findUnique({ where: { id } })
  if (!existing) throw new Error('Personel ataması bulunamadı.')
  if (existing.aktif) throw new Error('Bu atama zaten aktif.')

  const cakisan = await personelAtamaCakismasi(
    existing.personnelId,
    existing.baslangicTarihi,
    existing.bitisTarihi,
    id,
  )
  if (cakisan) throw new Error(personelAtamaCakismaMesaji(cakisan))

  return prisma.$transaction(async (tx) => {
    const guncel = await tx.servisPersonelAtama.update({
      where: { id },
      data: { aktif: true, updatedById },
      include: servisPersonelAtamaInclude,
    })
    await kaydetIslemGecmisi({
      tx, hedefTipi: 'PERSONEL_ATAMA', hedefId: id, islem: 'AKTIFLESTIRME', yapanId: updatedById,
      oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
    })
    return guncel
  })
}
