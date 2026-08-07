import { prisma } from '@/lib/prisma'

// satinalma.ts ile aynı desen: durum tipi lib'de export edilir, UI type-import eder.
export type BakimYonlendirmeDurumTip =
  | 'TESPIT_EDILDI'
  | 'BAKIMA_YONLENDIRILDI'
  | 'BAKIM_INCELEDI'
  | 'KENDI_COZDU'
  | 'SERVIS_TALEBI_ACILDI'
  | 'TAMAMLANDI'
  | 'IPTAL'

export type Yapan = { id?: string | null; ad: string }

const TERMINAL_DURUMLAR: BakimYonlendirmeDurumTip[] = ['KENDI_COZDU', 'TAMAMLANDI', 'IPTAL']

export type CreateYonlendirmeInput = {
  tespitEdenId?: string | null
  tespitEdenAd: string
  konu: string
  lokasyon?: string
  aciklama?: string
  yonlendirilenBirim?: string
}

export type UpdateYonlendirmeInput = {
  durum?: BakimYonlendirmeDurumTip
  konu?: string
  lokasyon?: string | null
  aciklama?: string | null
  yonlendirilenBirim?: string
  servisReferansi?: string | null
  sonucNotu?: string | null
}

// kayitNo üretimi — satinalma.ts'deki generateFormNoTx ile aynı mantık, önek BY-.
async function generateKayitNoTx(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
  const yil = new Date().getFullYear()
  const onEk = `BY-${yil}-`

  const sonKayit = await tx.envanterBakimYonlendirme.findFirst({
    where: { kayitNo: { startsWith: onEk } },
    orderBy: { kayitNo: 'desc' },
  })

  let sonSira = 0
  if (sonKayit) {
    const sayi = Number(sonKayit.kayitNo.slice(onEk.length))
    if (Number.isFinite(sayi)) sonSira = sayi
  }

  return `${onEk}${String(sonSira + 1).padStart(4, '0')}`
}

export async function createYonlendirme(input: CreateYonlendirmeInput) {
  const konu = (input.konu ?? '').trim()
  if (!konu) {
    throw new Error('Konu zorunludur.')
  }

  return prisma.$transaction(async (tx) => {
    const kayitNo = await generateKayitNoTx(tx)

    return tx.envanterBakimYonlendirme.create({
      data: {
        kayitNo,
        tespitEdenId: input.tespitEdenId || null,
        tespitEdenAd: input.tespitEdenAd,
        konu,
        lokasyon: input.lokasyon?.trim() || null,
        aciklama: input.aciklama?.trim() || null,
        yonlendirilenBirim: input.yonlendirilenBirim?.trim() || 'Bakım',
        durum: 'TESPIT_EDILDI',
      },
    })
  })
}

export async function listYonlendirmeler(options?: { durum?: BakimYonlendirmeDurumTip }) {
  return prisma.envanterBakimYonlendirme.findMany({
    where: options?.durum ? { durum: options.durum } : undefined,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getYonlendirme(id: string) {
  return prisma.envanterBakimYonlendirme.findUnique({ where: { id } })
}

export async function updateYonlendirme(id: string, input: UpdateYonlendirmeInput, _yapan: Yapan) {
  const mevcut = await prisma.envanterBakimYonlendirme.findUnique({ where: { id } })
  if (!mevcut) {
    throw new Error('Kayıt bulunamadı.')
  }

  if (TERMINAL_DURUMLAR.includes(mevcut.durum as BakimYonlendirmeDurumTip)) {
    throw new Error('Bu kayıt kapanmış durumda, güncellenemez.')
  }

  const data: Record<string, unknown> = {}

  if (input.durum !== undefined) data.durum = input.durum
  if (input.konu !== undefined) {
    const konu = input.konu.trim()
    if (!konu) throw new Error('Konu boş bırakılamaz.')
    data.konu = konu
  }
  if (input.lokasyon !== undefined) data.lokasyon = input.lokasyon?.trim() || null
  if (input.aciklama !== undefined) data.aciklama = input.aciklama?.trim() || null
  if (input.yonlendirilenBirim !== undefined) {
    data.yonlendirilenBirim = input.yonlendirilenBirim?.trim() || 'Bakım'
  }
  if (input.servisReferansi !== undefined) data.servisReferansi = input.servisReferansi?.trim() || null
  if (input.sonucNotu !== undefined) data.sonucNotu = input.sonucNotu?.trim() || null

  return prisma.envanterBakimYonlendirme.update({
    where: { id },
    data,
  })
}

// smoke test 2026-08-07 — self-service deploy zinciri doğrulaması
