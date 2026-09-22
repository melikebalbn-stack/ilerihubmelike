import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { operasyonelServisListesiGetir } from '@/lib/servis-yonetimi/operasyonel-servis-listesi'
import { operasyonelListeFiltreleriniAyikla } from './_filtre'

// MASTER Madde 29 — Operasyonel Servis Listeleri. Sorgu mantığı burada
// TEKRARLANMAZ (rule 6) — tek kaynak operasyonelServisListesiGetir()
// (src/lib/servis-yonetimi/operasyonel-servis-listesi.ts, Adım 1).
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.view')
  if (error) return error

  const ayiklama = operasyonelListeFiltreleriniAyikla(request.nextUrl.searchParams)
  if (!ayiklama.ok) {
    return NextResponse.json({ ok: false, message: ayiklama.mesaj }, { status: 400 })
  }

  try {
    const sonuc = await operasyonelServisListesiGetir(ayiklama.filtre)
    // filtreler: UI'ın "şu an neye göre süzülüyor" gösterebilmesi için
    // uygulanan filtrelerin yankısı — yalnız gerçekten set edilenler.
    return NextResponse.json({ ok: true, data: { ...sonuc, filtreler: ayiklama.filtre } })
  } catch (err) {
    console.error('Operasyonel servis listesi alma hatası:', err)
    return NextResponse.json({ ok: false, message: 'Operasyonel servis listesi alınırken hata oluştu.' }, { status: 500 })
  }
}
