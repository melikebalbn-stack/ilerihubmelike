/**
 * IPRO script'leri için TEK NOKTA hedef-DB guard'ı.
 *
 * Kural: dev serbest; dev DIŞI bir hedefe yazmak için komut satırında açıkça
 * `--prod-onay` verilmeli. Guard'ı sessizce gevşetmek yasak — bayrak, yazmanın
 * bilinçli olduğunu komut geçmişinde de görünür kılar.
 *
 * Kullanım: yazma yapan her script main()'in EN BAŞINDA çağırır.
 */

/** DB kimlik bilgisini gizleyerek URL'i loglanabilir hale getirir. */
export function maskeliDbUrl(url: string): string {
  return url.replace(/:\/\/[^@]*@/, '://***@')
}

/**
 * Hedef DB'yi doğrular ve URL'i döndürür.
 * @throws dev dışı hedefte `--prod-onay` verilmemişse
 */
export function hedefDbGuard(): string {
  const url = process.env.DATABASE_URL ?? ''
  if (!url) throw new Error('GÜVENLİK DURDU: DATABASE_URL boş')

  const maskeli = maskeliDbUrl(url)
  if (url.includes('ilerihub_dev')) return url

  if (!process.argv.includes('--prod-onay')) {
    throw new Error(
      `GÜVENLİK DURDU: hedef DB dev değil → ${maskeli}\n` +
        `Bu hedefe yazmak için komuta --prod-onay ekleyin (bilinçli onay).`,
    )
  }

  console.warn(`⚠️  DEV DIŞI HEDEFE YAZILIYOR: ${maskeli}  (--prod-onay verildi)`)
  return url
}
