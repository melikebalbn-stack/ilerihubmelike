import type { EnvanterStokSatiri, EnvanterUrunForm } from '@/types/envanter'
import { buildStokKeys } from './variants'

export type EnvanterStockCreateInput = {
  key: string
  mevcut: number
  minStok: number | null
  kritikStok: number | null
  maxStok: number | null
  depo: string | null
  raf: string | null
  durum: 'NORMAL' | 'MINIMUM' | 'KRITIK' | 'EKSIK'
}

function toNullableInt(value: string | undefined | null) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null
  }

  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return null
  }

  return Math.trunc(numberValue)
}

function toRequiredInt(value: string | undefined | null) {
  const parsed = toNullableInt(value)
  return parsed ?? 0
}

export function calculateStockStatus(row: EnvanterStokSatiri) {
  const ilkGirisBos = row.ilkGiris.trim() === ''
  const minBos = row.minStok.trim() === ''
  const kritikBos = row.kritikStok.trim() === ''

  if (ilkGirisBos || minBos || kritikBos) {
    return 'EKSIK' as const
  }

  const mevcut = toRequiredInt(row.ilkGiris)
  const minStok = toRequiredInt(row.minStok)
  const kritikStok = toRequiredInt(row.kritikStok)

  if (mevcut <= kritikStok) {
    return 'KRITIK' as const
  }

  if (mevcut <= minStok) {
    return 'MINIMUM' as const
  }

  return 'NORMAL' as const
}

export function normalizeStockRow(row?: EnvanterStokSatiri): EnvanterStokSatiri {
  return {
    ilkGiris: row?.ilkGiris ?? '',
    minStok: row?.minStok ?? '',
    kritikStok: row?.kritikStok ?? '',
    maxStok: row?.maxStok ?? '',
    depo: row?.depo ?? '',
    raf: row?.raf ?? '',
  }
}

export function buildStockCreateInputs(
  form: EnvanterUrunForm,
): EnvanterStockCreateInput[] {
  const keys = buildStokKeys(form)

  return keys.map((key) => {
    const row = normalizeStockRow(form.stokSatirlari[key])

    return {
      key,
      mevcut: toRequiredInt(row.ilkGiris),
      minStok: toNullableInt(row.minStok),
      kritikStok: toNullableInt(row.kritikStok),
      maxStok: toNullableInt(row.maxStok),
      depo: row.depo.trim() || null,
      raf: row.raf.trim() || null,
      durum: calculateStockStatus(row),
    }
  })
}

export function getTotalInitialStock(form: EnvanterUrunForm) {
  return buildStockCreateInputs(form).reduce(
    (total, row) => total + row.mevcut,
    0,
  )
}

export function getOverallStockStatus(
  stocks: EnvanterStockCreateInput[],
): 'NORMAL' | 'KRITIK' | 'PASIF' {
  if (stocks.some((stock) => stock.durum === 'KRITIK')) {
    return 'KRITIK'
  }

  return 'NORMAL'
}

export function mapStockStatusForPrisma(status: EnvanterStockCreateInput['durum']) {
  return status
}