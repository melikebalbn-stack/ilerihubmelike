import 'server-only'
import { prisma } from '@/lib/prisma'
import { sendEmail, type EmailRecipient } from '@/lib/email'
import { resolveDeptResponsibleRecipients } from '@/lib/overtime-dept-responsible-notify'
import { bugunStr, dbGun, gunuHesapla } from './puantaj-servis'
import { pdksTakvimTipi } from './puantaj-motor'

/**
 * PDKS Adım 5 — sabah devamsızlık/geç bildirimi. Her iş günü pdks_bildirim_saati'nde (vars. 09:00)
 * o ana kadar GELMEYEN + GEÇ gelen personel bölüm amirine + İV'ye bildirilir (Hub içi bildirim + e-posta).
 * Kapılar: pdks_devamsizlik_bildirim_acik=true olmalı; hafta sonu / tatil / saatten önce no-op.
 * İV alıcıları pdks_devamsizlik_iv_mailler (virgüllü e-posta) ayarından; amirler bölüm sorumlularından.
 */
const ACIK = 'pdks_devamsizlik_bildirim_acik'
const SAAT = 'pdks_bildirim_saati'
const IV_MAILLER = 'pdks_devamsizlik_iv_mailler'

async function ayar(key: string, varsayilan: string): Promise<string> {
  const a = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } })
  return a?.value?.trim() || varsayilan
}
const hhmmDk = (s: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(s)
  return m ? Number(m[1]) * 60 + Number(m[2]) : 9 * 60
}
const simdiDk = () => {
  const s = new Date(Date.now() + 3 * 3600_000).toISOString().slice(11, 16)
  return hhmmDk(s)
}

export interface BildirimSonuc {
  noop?: boolean
  sebep?: string
  gelmedi?: number
  gec?: number
  amirSayisi?: number
  ivMail?: number
  dryRun?: boolean
}

export async function devamsizlikBildirimIsi({ dryRun = false }: { dryRun?: boolean } = {}): Promise<BildirimSonuc> {
  const bugun = bugunStr()
  if ((await ayar(ACIK, 'false')) !== 'true') return { noop: true, sebep: 'kapalı' }

  const tatil = await prisma.iproTatil.findUnique({ where: { tarih: dbGun(bugun) }, select: { tip: true } })
  const takvim = pdksTakvimTipi(bugun, tatil?.tip ?? null)
  if (takvim === 'HAFTA_SONU' || takvim === 'TATIL') return { noop: true, sebep: takvim }
  if (simdiDk() < hhmmDk(await ayar(SAAT, '09:00'))) return { noop: true, sebep: 'saat erken' }

  const { sonuclar } = await gunuHesapla(prisma, bugun, { kaydet: false })
  const sorunlu = sonuclar.filter((s) => s.sonuc.durum === 'GELMEDI' || s.sonuc.gecDakika > 0)
  if (!sorunlu.length) return { noop: true, sebep: 'sorun yok' }

  const ids = sorunlu.map((s) => s.personnelId)
  const pers = await prisma.personnel.findMany({
    where: { id: { in: ids } },
    select: { id: true, adSoyad: true, department: { select: { name: true } } },
  })
  const persById = new Map(pers.map((p) => [p.id, p]))
  const etiket = (pid: string) => {
    const s = sorunlu.find((x) => x.personnelId === pid)!.sonuc
    const ad = persById.get(pid)?.adSoyad ?? pid
    return s.durum === 'GELMEDI' ? `${ad} — gelmedi` : `${ad} — ${s.gecDakika} dk geç`
  }

  // Bölüm (DepartmentDefinition.name) → etiketli kişi listesi
  const byDept = new Map<string, string[]>()
  const bolumsuz: string[] = []
  for (const s of sorunlu) {
    const dept = persById.get(s.personnelId)?.department?.name
    if (!dept) {
      bolumsuz.push(etiket(s.personnelId))
      continue
    }
    if (!byDept.has(dept)) byDept.set(dept, [])
    byDept.get(dept)!.push(etiket(s.personnelId))
  }

  const gelmedi = sorunlu.filter((s) => s.sonuc.durum === 'GELMEDI').length
  const gec = sorunlu.filter((s) => s.sonuc.gecDakika > 0).length
  const { recipients } = await resolveDeptResponsibleRecipients(byDept)
  const ivMailler = (await ayar(IV_MAILLER, ''))
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /.+@.+/.test(x))

  if (dryRun) return { dryRun: true, gelmedi, gec, amirSayisi: recipients.length, ivMail: ivMailler.length }

  const tarihTr = new Date(`${bugun}T00:00:00Z`).toLocaleDateString('tr-TR', { timeZone: 'UTC' })

  // Amirler: Hub içi bildirim + e-posta (yalnız kendi bölümlerinin kişileri)
  for (const r of recipients) {
    const satirlar = r.departments.flatMap((d) => d.personel)
    const govde = `${tarihTr} — bölümünüzde gelmeyen/geç personel:\n\n${satirlar.map((x) => `• ${x}`).join('\n')}`
    try {
      await prisma.notification.create({
        data: { userId: r.userId, title: 'PDKS — devamsızlık/geç bildirimi', message: govde, type: 'WARNING', link: '/pdks/puantaj' },
      })
      await sendEmail([{ email: r.email, name: r.name }] as EmailRecipient[], `PDKS devamsızlık/geç — ${tarihTr}`, govde)
    } catch (e) {
      console.error('[pdks-devamsizlik] amir bildirimi hatası', r.email, e)
    }
  }

  // İV: tüm liste (bölüm başlıklı) tek e-posta
  if (ivMailler.length) {
    const bloklar = [...byDept.entries()].map(([d, liste]) => `${d}:\n${liste.map((x) => `  • ${x}`).join('\n')}`)
    if (bolumsuz.length) bloklar.push(`Bölümsüz:\n${bolumsuz.map((x) => `  • ${x}`).join('\n')}`)
    const govde = `${tarihTr} — gelmeyen (${gelmedi}) / geç (${gec}) personel:\n\n${bloklar.join('\n\n')}`
    try {
      await sendEmail(ivMailler.map((e) => ({ email: e })) as EmailRecipient[], `PDKS devamsızlık/geç özeti — ${tarihTr}`, govde)
    } catch (e) {
      console.error('[pdks-devamsizlik] İV bildirimi hatası', e)
    }
  }

  return { gelmedi, gec, amirSayisi: recipients.length, ivMail: ivMailler.length }
}
