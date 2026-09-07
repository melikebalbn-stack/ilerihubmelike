/**
 * RMA/SMA İade Formu (KAL-KYT-16) — ortak etiket sabitleri. TEK KAYNAK; ekranlar buradan okur.
 */
import { RmaKarar, RmaTip, RmaIadeTuru, RmaDurum } from '@/generated/prisma'

export const RMA_KARAR_LABELS: Record<RmaKarar, string> = {
  HURDA: 'Hurda',
  REWORK: 'Rework',
  TAMIR: 'Tamir',
  TEDARIKCIYE_IADE: 'Tedarikçiye İade',
  MUSTERIYE_IADE: 'Müşteriye İade',
  DEPOYA_KABUL: 'Depoya Kabul',
  URUN_BIZE_AIT_DEGIL: 'Ürün Bize Ait Değil',
}

export const RMA_TIP_LABELS: Record<RmaTip, string> = {
  RMA: 'RMA',
  SMA: 'SMA',
}

export const RMA_IADE_TURU_LABELS: Record<RmaIadeTuru, string> = {
  GIRIS_KALITE: 'Giriş Kalite',
  HAT: 'Hat',
  MUSTERI_SIKAYETI: 'Müşteri Şikayeti',
}

/** Kayıt durumu — ELLE seçilir, kapanisTarihi'nden türetilmez. */
export const RMA_DURUM_LABELS: Record<RmaDurum, string> = {
  ACIK: 'Açık',
  KAPALI: 'Kapalı',
}

/** Seçici/dropdown için {value,label} dizileri. */
export const RMA_KARAR_OPTIONS = (Object.keys(RMA_KARAR_LABELS) as RmaKarar[]).map((k) => ({
  value: k,
  label: RMA_KARAR_LABELS[k],
}))
export const RMA_TIP_OPTIONS = (Object.keys(RMA_TIP_LABELS) as RmaTip[]).map((k) => ({
  value: k,
  label: RMA_TIP_LABELS[k],
}))
export const RMA_IADE_TURU_OPTIONS = (Object.keys(RMA_IADE_TURU_LABELS) as RmaIadeTuru[]).map((k) => ({
  value: k,
  label: RMA_IADE_TURU_LABELS[k],
}))
export const RMA_DURUM_OPTIONS = (Object.keys(RMA_DURUM_LABELS) as RmaDurum[]).map((k) => ({
  value: k,
  label: RMA_DURUM_LABELS[k],
}))
