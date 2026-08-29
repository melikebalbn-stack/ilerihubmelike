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
  type ServisFirmaForm,
  type ServisAracForm,
  type ServisDurakForm,
  type ServisGuzergahForm,
  type ServisYerleskeForm,
  type ServisSoforForm,
  type ServisSeferDilimiForm,
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
