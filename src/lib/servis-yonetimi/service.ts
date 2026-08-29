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
  type ServisFirmaForm,
  type ServisAracForm,
  type ServisDurakForm,
  type ServisGuzergahForm,
  type ServisYerleskeForm,
  type ServisSoforForm,
  type ServisSeferDilimiForm,
  type ServisGuzergahDurakForm,
  type ServisGuzergahDurakSaatForm,
} from './validation'

// ============================================================================
// ServisFirma
// ============================================================================

export async function listServisFirmalar(filtre?: { aktif?: boolean }) {
  return prisma.servisFirma.findMany({
    where: filtre?.aktif !== undefined ? { aktif: filtre.aktif } : undefined,
    orderBy: { ad: 'asc' },
  })
}

export async function createServisFirma(form: ServisFirmaForm) {
  const { valid, errors } = validateServisFirmaForm(form)
  if (!valid) throw new Error(errors.join(' '))

  return prisma.servisFirma.create({
    data: {
      ad: form.ad.trim(),
      yetkiliAdi: form.yetkiliAdi?.trim() || null,
      telefon: form.telefon?.trim() || null,
      eposta: form.eposta?.trim() || null,
      adres: form.adres?.trim() || null,
    },
  })
}

export async function updateServisFirma(id: string, form: ServisFirmaForm) {
  const { valid, errors } = validateServisFirmaForm(form)
  if (!valid) throw new Error(errors.join(' '))

  const existing = await prisma.servisFirma.findUnique({ where: { id } })
  if (!existing) throw new Error('Firma bulunamadı.')

  return prisma.servisFirma.update({
    where: { id },
    data: {
      ad: form.ad.trim(),
      yetkiliAdi: form.yetkiliAdi?.trim() || null,
      telefon: form.telefon?.trim() || null,
      eposta: form.eposta?.trim() || null,
      adres: form.adres?.trim() || null,
    },
  })
}

export async function pasiflestirServisFirma(id: string) {
  const existing = await prisma.servisFirma.findUnique({ where: { id } })
  if (!existing) throw new Error('Firma bulunamadı.')
  if (!existing.aktif) throw new Error('Firma zaten pasif.')

  return prisma.servisFirma.update({ where: { id }, data: { aktif: false } })
}

export async function geriAlServisFirma(id: string) {
  const existing = await prisma.servisFirma.findUnique({ where: { id } })
  if (!existing) throw new Error('Firma bulunamadı.')
  if (existing.aktif) throw new Error('Firma zaten aktif.')

  return prisma.servisFirma.update({ where: { id }, data: { aktif: true } })
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
