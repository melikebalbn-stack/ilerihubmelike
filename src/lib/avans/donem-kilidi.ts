import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Avans dönem kilidi — TEK DOĞRULUK KAYNAĞI.
 *
 * "Bu (yil, ay) dönemi kapatılmış mı?" sorusunun cevabı yalnızca
 * AvansDonemKapanis tablosunda bir satır olup olmamasıdır. Talebin ait olduğu
 * dönem (AvansTalebi.donemYil / donemAy) üzerinden bakılır — kaydın oluşturulma
 * tarihi (createdAt) DEĞİL. Böylece "Ocak'ta girilen Aralık avansı" gibi
 * durumlarda doğru dönem kilitlenir.
 *
 * Kilit UI'da değil, ENDPOINT'te uygulanır: kapalı bir döneme yazma/silme
 * denemesi 409 döner. Her uç bu dosyadaki `donemKilidiKontrol`'den geçsin,
 * uç içinde ayrı kontrol YAZILMASIN — kural tek yerde dursun.
 */

export async function donemKapaliMi(yil: number, ay: number): Promise<boolean> {
  const kayit = await prisma.avansDonemKapanis.findUnique({
    where: { yil_ay: { yil, ay } },
    select: { id: true },
  })
  return kayit !== null
}

export function donemKapaliMesaji(yil: number, ay: number): string {
  return `${yil}/${ay} dönemi kapatılmış, değişiklik yapılamaz.`
}

/**
 * Dönem kapalıysa hazır 409 yanıtı, açıksa null döner.
 * Kullanım:
 *   const kilit = await donemKilidiKontrol(yil, ay)
 *   if (kilit) return kilit
 */
export async function donemKilidiKontrol(
  yil: number,
  ay: number
): Promise<NextResponse | null> {
  if (await donemKapaliMi(yil, ay)) {
    return NextResponse.json({ error: donemKapaliMesaji(yil, ay) }, { status: 409 })
  }
  return null
}
