import type { EnvanterUrunForm } from '@/types/envanter'

export type EnvanterVaryantCreateInput = {
  varyantAdi: string
  beden?: string
  numara?: string
  renk?: string
}

export function buildVaryantList(
  form: EnvanterUrunForm,
): EnvanterVaryantCreateInput[] {
  if (!form.varyantTipi) return []

  if (form.varyantTipi === 'BEDEN') {
    return form.bedenler.map((beden) => ({
      varyantAdi: beden,
      beden,
    }))
  }

  if (form.varyantTipi === 'NUMARA') {
    return form.numaralar.map((numara) => ({
      varyantAdi: numara,
      numara,
    }))
  }

  if (form.varyantTipi === 'RENK') {
    return form.renkler.map((renk) => ({
      varyantAdi: renk,
      renk,
    }))
  }

  if (form.varyantTipi === 'BEDEN_RENK') {
    return form.bedenler.flatMap((beden) =>
      form.renkler.map((renk) => ({
        varyantAdi: `${beden} ${renk}`,
        beden,
        renk,
      })),
    )
  }

  if (form.varyantTipi === 'NUMARA_RENK') {
    return form.numaralar.flatMap((numara) =>
      form.renkler.map((renk) => ({
        varyantAdi: `${numara} ${renk}`,
        numara,
        renk,
      })),
    )
  }

  return []
}

export function buildStokKeys(form: EnvanterUrunForm) {
  const varyantlar = buildVaryantList(form)
  return varyantlar.length > 0
    ? varyantlar.map((varyant) => varyant.varyantAdi)
    : ['Ana Ürün']
}

export function normalizeVaryantTipi(value: string) {
  return value && value.trim() !== '' ? value : 'YOK'
}