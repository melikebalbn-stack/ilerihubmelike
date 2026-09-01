import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import { isSandboxOwner } from '../_lib/avans-formu-helpers'
import { dispatchAvansHatirlatma, dispatchAvansKendiHatirlatma } from '@/lib/sandbox/avans-notifications'

export const dynamic = 'force-dynamic'

type SorumluAdayi = { personnelId: string; adSoyad: string }

type Alici = SorumluAdayi & { userId: string | null; email: string | null }

/**
 * Personnel.birimSorumlusu/sorumlu2/sorumlu3/bolumMuduru alanlarında geçen
 * tüm isimleri toplayıp kişi bazında (case-insensitive) dedup'lar, sonra her
 * ismi kendi Personnel kaydına (adSoyad eşleşmesiyle) bağlar. Aynı kişi
 * birden fazla alanda/bölümde sorumlu olarak geçse bile listede tek satır
 * olarak yer alır.
 */
async function bulTumSorumlular(): Promise<SorumluAdayi[]> {
  const personeller = await prisma.personnel.findMany({
    where: {
      OR: [
        { birimSorumlusu: { not: null } },
        { sorumlu2: { not: null } },
        { sorumlu3: { not: null } },
        { bolumMuduru: { not: null } },
      ],
    },
    select: { birimSorumlusu: true, sorumlu2: true, sorumlu3: true, bolumMuduru: true },
  })

  const isimSeti = new Map<string, string>()
  for (const p of personeller) {
    for (const isim of [p.birimSorumlusu, p.sorumlu2, p.sorumlu3, p.bolumMuduru]) {
      const trimmed = isim?.trim()
      if (!trimmed) continue
      const anahtar = trimmed.toLowerCase()
      if (!isimSeti.has(anahtar)) isimSeti.set(anahtar, trimmed)
    }
  }

  const sonuc: SorumluAdayi[] = []
  for (const adSoyad of isimSeti.values()) {
    const kayit = await prisma.personnel.findFirst({
      where: { adSoyad: { equals: adSoyad, mode: 'insensitive' } },
      select: { id: true, adSoyad: true },
    })
    if (kayit) sonuc.push({ personnelId: kayit.id, adSoyad: kayit.adSoyad })
  }
  return sonuc
}

/**
 * Sorumlu OLMAYAN, aktif BEYAZ yaka personeli bulur — bunlar kendi
 * talebini kendi giriyor, "ekibiniz için doldurun" değil "kendi
 * talebinizi girin" hatırlatması alacak.
 */
async function bulDigerBeyazYakalar(sorumluIdSeti: Set<string>): Promise<SorumluAdayi[]> {
  const beyazYakalar = await prisma.personnel.findMany({
    where: {
      yakaRengi: 'BEYAZ',
      aktif: true,
      id: { notIn: Array.from(sorumluIdSeti) },
    },
    select: { id: true, adSoyad: true },
  })
  return beyazYakalar.map((p) => ({ personnelId: p.id, adSoyad: p.adSoyad }))
}

/** KVKK: dry-run önizlemesinde tam e-posta gösterilmez. a***@ilerigroup.com gibi maskelenir. */
function maskEmail(email: string): string {
  const atIndex = email.indexOf('@')
  if (atIndex <= 0) return '***'
  return `${email[0]}***${email.slice(atIndex)}`
}

type PostBody = { dryRun?: boolean }

function gecerliBody(body: unknown): body is PostBody {
  if (body === null || body === undefined) return true
  if (typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return b.dryRun === undefined || typeof b.dryRun === 'boolean'
}

async function personelToAlici(s: SorumluAdayi): Promise<Alici> {
  const dbUser = await prisma.user.findUnique({
    where: { personnelId: s.personnelId },
    select: { id: true, email: true },
  })
  return { ...s, userId: dbUser?.id ?? null, email: dbUser?.email ?? null }
}

/**
 * POST: Ayın 15'inde tetiklenecek cron endpoint'i.
 * İki tetikleme yolu vardır:
 *  1. Sistem cron: `x-cron-secret` header'ı CRON_SECRET ile eşleşirse.
 *  2. Manuel test: sandbox sahibinin (Nurgül) oturumuyla.
 * Varsayılan dryRun:true — gerçek gönderim SADECE açık { dryRun: false }
 * body'siyle tetiklenir.
 */
export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret')
  const isCron = !!cronSecret && cronSecret === process.env.CRON_SECRET

  if (!isCron) {
    const { user, error } = await requireUser()
    if (error) return error
    if (!isSandboxOwner(user.email)) {
      return NextResponse.json(
        { error: 'Bu işlem sadece sandbox sahibi tarafından veya cron ile çalıştırılabilir' },
        { status: 403 }
      )
    }
  }

  const body: unknown = await request.json().catch(() => null)
  if (!gecerliBody(body)) {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })
  }

  const dryRun = (body as PostBody | null)?.dryRun !== false

  const sorumlular = await bulTumSorumlular()
  const sorumluIdSeti = new Set(sorumlular.map((s) => s.personnelId))
  const digerBeyazYakalar = await bulDigerBeyazYakalar(sorumluIdSeti)

  const sorumluAlicilar: Alici[] = await Promise.all(sorumlular.map(personelToAlici))
  const kendiAlicilar: Alici[] = await Promise.all(digerBeyazYakalar.map(personelToAlici))

  const gecerli = (a: Alici): a is Alici & { userId: string; email: string } =>
    !!a.userId && !!a.email

  const sorumluGonderilebilir = sorumluAlicilar.filter(gecerli)
  const kendiGonderilebilir = kendiAlicilar.filter(gecerli)
  const hesapsizSayisi =
    sorumluAlicilar.length - sorumluGonderilebilir.length +
    (kendiAlicilar.length - kendiGonderilebilir.length)

  if (dryRun) {
    const onizleme = [...sorumluAlicilar, ...kendiAlicilar].map((a) => ({
      adSoyad: a.adSoyad,
      mail: a.email ? maskEmail(a.email) : null,
      hesapVar: !!a.userId,
      tur: sorumluIdSeti.has(a.personnelId) ? 'sorumlu' : 'kendi',
    }))

    console.log(
      `[avans-notify][dry-run] sorumlu: ${sorumluAlicilar.length}, kendi-giren: ${kendiAlicilar.length}, hesapsız: ${hesapsizSayisi}`,
      onizleme
    )

    return NextResponse.json({
      dryRun: true,
      sorumluSayisi: sorumluAlicilar.length,
      kendiGirenSayisi: kendiAlicilar.length,
      gonderilebilirSayisi: sorumluGonderilebilir.length + kendiGonderilebilir.length,
      hesapsizSayisi,
      onizleme,
    })
  }

  const sorumluSonuclar = await Promise.all(
    sorumluGonderilebilir.map((a) =>
      dispatchAvansHatirlatma({ id: a.userId, email: a.email, name: a.adSoyad })
    )
  )
  const kendiSonuclar = await Promise.all(
    kendiGonderilebilir.map((a) =>
      dispatchAvansKendiHatirlatma({ id: a.userId, email: a.email, name: a.adSoyad })
    )
  )

  const basariliSayisi =
    sorumluSonuclar.filter((s) => s.ok).length + kendiSonuclar.filter((s) => s.ok).length

  return NextResponse.json({
    dryRun: false,
    gonderildi: basariliSayisi,
    toplam: sorumluGonderilebilir.length + kendiGonderilebilir.length,
    hesapsizSayisi,
  })
}
