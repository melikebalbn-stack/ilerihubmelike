import { NextResponse } from 'next/server'
import { requireAllPermissions } from '@/lib/auth/require-permission'
import { getUserPermissions } from '@/lib/auth/get-user-permissions'
import { ExcelAtamaHatasi, excelOku, type HamSatir, type SatirSonucu } from '@/lib/servis-yonetimi/excel-atama'
import { EXCEL_DOSYA_SINIRI_MESAJI, EXCEL_LIMITLERI } from '@/lib/servis-yonetimi/excel-atama-limitleri'

// Excel toplu atama uçlarının ORTAK iskeleti (Next route dosyası olarak algılanmasın diye "_" ile başlar).
//
// YETKİ (3 katman: menü/sayfa, API, işlem satırı):
//  • API: servis.view VE servis.edit (dosya yükleme için view, operasyonel kayıt için edit) — AND.
//    Anahtar listesi HER route.ts'te AÇIKÇA yazılır (servis-edit-tanim-ayrimi drift testi route dosyalarını tarar).
//  • SATIR: yeni atama için servis.create, güzergâh/durak değişikliği (eski atamayı kapatır) için
//    servis.create + servis.passive; yetkisi olmayan satır HATA olarak işaretlenir (yetki aşılmaz).
// KVKK: dosya içeriği loglanmaz; hata mesajları kişi verisi taşımaz (satır no + sicil kullanıcının kendi dosyası).

export type ExcelIstegi = {
  userId: string
  izinler: { create: boolean; passive: boolean }
  satirlar: HamSatir[]
  form: FormData
}

export async function yetkiVeIzinler(yetkiler: string[]): Promise<{ error: NextResponse } | { userId: string; izinler: { create: boolean; passive: boolean } }> {
  const { error, userId } = await requireAllPermissions(yetkiler)
  if (error) return { error }
  const perms = await getUserPermissions(userId)
  return { userId, izinler: { create: perms.has('servis.create'), passive: perms.has('servis.passive') } }
}

export async function excelIstegiOku(request: Request, yetkiler: string[]): Promise<{ error: NextResponse } | ExcelIstegi> {
  const yetki = await yetkiVeIzinler(yetkiler)
  if ('error' in yetki) return yetki

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return { error: NextResponse.json({ ok: false, message: 'Geçersiz istek: dosya gönderilmedi.' }, { status: 400 }) }
  }
  const dosya = form.get('dosya')
  if (!dosya || typeof dosya === 'string' || typeof (dosya as Blob).arrayBuffer !== 'function') {
    return { error: NextResponse.json({ ok: false, message: 'Excel dosyası seçilmedi.' }, { status: 400 }) }
  }
  if ((dosya as Blob).size > EXCEL_LIMITLERI.maksDosyaBayt) {
    return { error: NextResponse.json({ ok: false, message: EXCEL_DOSYA_SINIRI_MESAJI }, { status: 413 }) }
  }
  try {
    const satirlar = excelOku(Buffer.from(await (dosya as Blob).arrayBuffer()))
    return { userId: yetki.userId, izinler: yetki.izinler, satirlar, form }
  } catch (err) {
    if (err instanceof ExcelAtamaHatasi) return { error: NextResponse.json({ ok: false, message: err.message }, { status: 400 }) }
    console.error('Excel atama dosyası okunamadı')
    return { error: NextResponse.json({ ok: false, message: 'Dosya okunamadı.' }, { status: 400 }) }
  }
}

/** İstemciye dönen satır: iç kimlikler (personnelId/guzergahId…) HARİÇ. Ad soyad yalnız yetkili ekranda. */
export function satirGorunumu(s: SatirSonucu) {
  return {
    satirNo: s.satirNo, sicil: s.sicil, adSoyad: s.adSoyad, guzergahKod: s.guzergahKod, durakKod: s.durakKod,
    dilimKodlari: s.dilimKodlari, baslangic: s.baslangic, tur: s.tur, hata: s.hata, uyari: s.uyari,
  }
}
