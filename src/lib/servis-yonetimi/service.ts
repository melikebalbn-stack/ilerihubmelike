import { prisma } from '@/lib/prisma'
import {
  validateServisFirmaForm,
  validateServisYerleskeForm,
  type ServisFirmaForm,
  type ServisYerleskeForm,
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
