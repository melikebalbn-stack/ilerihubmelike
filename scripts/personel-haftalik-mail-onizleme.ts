/**
 * Haftalık Personel Raporu maili — önizleme üretici / test göndericisi.
 *
 *   npx tsx scripts/personel-haftalik-mail-onizleme.ts              → yalnız HTML dosyası
 *   npx tsx scripts/personel-haftalik-mail-onizleme.ts --gonder <e-posta>
 *
 * --gonder VERİLMEDEN mail ATILMAZ. Adres tek tek verilir; toplu alıcı listesi
 * bu betikte YOKTUR (cron/rol tabanlı gönderim ayrı bir karar).
 *
 * KVKK: çıktı HTML'i kişi adı içerir — repo içindeki uploads/ altına, 600 hakla
 * yazılır. uploads/ .gitignore'da ve public/uploads ile İLİŞKİSİZ (o symlink
 * kimlik doğrulamasız servis ediliyor).
 */
import 'dotenv/config'
import { chmodSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { getHaftalikPersonelRaporu } from '../src/lib/personnel-weekly-report'
import { buildPersonnelWeeklyHtml, buildPersonnelWeeklyText } from '../src/lib/email-templates/personnel-weekly'
import { ileriHubUrl } from '../src/lib/email-templates/akademi/_base'
import { sendEmail } from '../src/lib/email'

const CIKTI = process.env.CIKTI ?? path.join(process.cwd(), 'uploads', 'personel-haftalik-mail-onizleme.html')

async function main() {
  const args = process.argv.slice(2)
  const gonderIdx = args.indexOf('--gonder')
  const hedef = gonderIdx >= 0 ? args[gonderIdx + 1] : null
  if (gonderIdx >= 0 && !hedef) {
    console.error('--gonder için hedef e-posta adresi gerekli.')
    process.exit(1)
  }

  const veri = await getHaftalikPersonelRaporu()
  const opts = {
    baslik: 'Haftalık Personel Raporu',
    sayfaUrl: ileriHubUrl('/personnel/reports'),
    bolumLimiti: 12,
  }
  const html = buildPersonnelWeeklyHtml(veri, opts)
  const text = buildPersonnelWeeklyText(veri, opts)

  mkdirSync(path.dirname(CIKTI), { recursive: true })
  writeFileSync(CIKTI, html, 'utf8')
  chmodSync(CIKTI, 0o600)

  const { ozet, cinsiyetDagilimi, tumBolumler } = veri.rapor
  console.log('Önizleme :', CIKTI)
  console.log('Hafta    :', veri.tarihMetni)
  console.log('Özet     :', `toplam ${ozet.toplamCalisan} · beyaz ${ozet.beyazYaka} · mavi ${ozet.maviYaka} · gri ${ozet.griYaka} · K/E ${cinsiyetDagilimi.kadin}/${cinsiyetDagilimi.erkek}`)
  console.log('Bölüm    :', `${tumBolumler.length} bölüm (mailde ilk ${opts.bolumLimiti})`)
  console.log('Hareket  :', `giren ${veri.girenler.length} · çıkan ${veri.cikanlar.length}`)

  if (!hedef) {
    console.log('\nGönderim YAPILMADI (--gonder verilmedi).')
    return
  }

  const sonuc = await sendEmail(
    [{ email: hedef, name: hedef }],
    `[TEST] Haftalık Personel Raporu — ${veri.tarihMetni}`,
    text,
    html,
  )
  console.log('\nGönderim :', hedef, sonuc.success ? 'OK' : `HATA: ${sonuc.error}`, sonuc.messageId ?? '')
  if (!sonuc.success) process.exit(1)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => {
    const { prisma } = await import('../src/lib/prisma')
    await prisma.$disconnect()
  })
