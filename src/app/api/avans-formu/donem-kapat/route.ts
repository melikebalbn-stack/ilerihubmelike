import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import { donemAcikMi, donemManuelDurum, donemOtomatikDurum } from '@/lib/avans/donem-kilidi'

export const dynamic = 'force-dynamic'

/**
 * Avans dönem kapatma/açma — SADECE İK.
 *
 * POST   { yil, ay, aciklama? }  → dönemi kapatır (AvansDonemKapanis satırı).
 * DELETE { yil, ay }             → dönemi açar (satır varsa siler, yoksa
 *                                   sadece log'a 'AC' düşer) — HİÇBİR
 *                                   KOŞULDA reddedilmez, otomatik dönem
 *                                   kilidini (bkz. donem-kilidi.ts) ezer.
 * GET ?yil=&ay=                  → TEK bir dönemin birleşik kilit durumu
 *                                   (sonuclar/page.tsx'teki rozet/buton için).
 * GET (parametresiz)             → kapalı dönem listesi (yönetim ekranı için).
 *
 * Kapatma bilgisi AvansDonemKapanis satırında (kapatanId, kapatmaTarihi),
 * kapatma+açma geçmişi ise AvansDonemKapanisLog'da kalıcı tutulur — açılışta
 * satır silindiği için "kim açtı, ne zaman" bilgisi orada durur.
 *
 * Kilidin kendisi bu uçta DEĞİL, yazma uçlarında (bkz. src/lib/avans/
 * donem-kilidi.ts) uygulanır; bu uç yalnızca kilidi kurar/kaldırır.
 */

// sonuclar/route.ts DELETE ile AYNI İK kapısı (HR_MANAGER | SUPER_ADMIN) —
// ayrı bir yetki deseni uydurulmadı.
function ikYetkisiVar(role: string): boolean {
  return role === 'HR_MANAGER' || role === 'SUPER_ADMIN'
}

function gecerliDonem(body: unknown): body is { yil: number; ay: number; aciklama?: string } {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (typeof b.yil !== 'number' || !Number.isInteger(b.yil) || b.yil < 2000 || b.yil > 2100) {
    return false
  }
  if (typeof b.ay !== 'number' || !Number.isInteger(b.ay) || b.ay < 1 || b.ay > 12) {
    return false
  }
  if (b.aciklama !== undefined && typeof b.aciklama !== 'string') return false
  return true
}

export async function GET(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  if (!ikYetkisiVar(user.role)) {
    return NextResponse.json({ error: 'Bu ekrana sadece İK erişebilir.' }, { status: 403 })
  }

  const searchParams = new URL(request.url).searchParams
  const yilParam = searchParams.get('yil')
  const ayParam = searchParams.get('ay')

  if (yilParam !== null && ayParam !== null) {
    const yil = Number(yilParam)
    const ay = Number(ayParam)
    if (!Number.isInteger(yil) || !Number.isInteger(ay) || ay < 1 || ay > 12) {
      return NextResponse.json({ error: 'Geçersiz yil/ay.' }, { status: 400 })
    }
    return NextResponse.json({
      yil,
      ay,
      manuelDurum: await donemManuelDurum(yil, ay),
      otomatikDurum: donemOtomatikDurum(yil, ay),
      donemAcik: await donemAcikMi(yil, ay),
    })
  }

  const kapaliDonemler = await prisma.avansDonemKapanis.findMany({
    orderBy: [{ yil: 'desc' }, { ay: 'desc' }],
    select: {
      yil: true,
      ay: true,
      kapatmaTarihi: true,
      aciklama: true,
      kapatan: { select: { name: true } },
    },
  })

  return NextResponse.json(kapaliDonemler)
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  if (!ikYetkisiVar(user.role)) {
    return NextResponse.json({ error: 'Bu işlem sadece İK tarafından yapılabilir.' }, { status: 403 })
  }

  const body: unknown = await request.json().catch(() => null)
  if (!gecerliDonem(body)) {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi (yil/ay).' }, { status: 400 })
  }

  const mevcut = await prisma.avansDonemKapanis.findUnique({
    where: { yil_ay: { yil: body.yil, ay: body.ay } },
    select: { id: true },
  })
  if (mevcut) {
    return NextResponse.json(
      { error: `${body.yil}/${body.ay} dönemi zaten kapalı.` },
      { status: 409 }
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.avansDonemKapanis.create({
      data: {
        yil: body.yil,
        ay: body.ay,
        kapatanId: user.id,
        aciklama: body.aciklama ?? null,
      },
    })
    await tx.avansDonemKapanisLog.create({
      data: {
        yil: body.yil,
        ay: body.ay,
        islem: 'KAPAT',
        kullaniciId: user.id,
        aciklama: body.aciklama ?? null,
      },
    })
  })

  return NextResponse.json({ success: true, yil: body.yil, ay: body.ay, durum: 'KAPALI' })
}

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  if (!ikYetkisiVar(user.role)) {
    return NextResponse.json({ error: 'Bu işlem sadece İK tarafından yapılabilir.' }, { status: 403 })
  }

  const body: unknown = await request.json().catch(() => null)
  if (!gecerliDonem(body)) {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi (yil/ay).' }, { status: 400 })
  }

  const mevcut = await prisma.avansDonemKapanis.findUnique({
    where: { yil_ay: { yil: body.yil, ay: body.ay } },
    select: { id: true },
  })

  // İK'nın "aç" işlemi ARTIK HİÇBİR KOŞULDA reddedilmez — otomatik dönem
  // durumu (bkz. donem-kilidi.ts) ne olursa olsun (geçmiş dönem dahil),
  // İK manuel yetkisiyle her zaman açabilir; bu tercih Melih Bey'in kararı
  // (bordro geç kapanırsa İK'nın düzeltme yapabilmesi gerekiyor). Kapalı
  // satır yoksa (zaten manuel kapatılmamışsa) sadece log'a 'AC' düşülür —
  // bu, otomatik kilidi ezen kalıcı bir override kaydı olarak iş görür
  // (bkz. donemManuelDurum).
  await prisma.$transaction(async (tx) => {
    if (mevcut) {
      await tx.avansDonemKapanis.delete({ where: { id: mevcut.id } })
    }
    await tx.avansDonemKapanisLog.create({
      data: {
        yil: body.yil,
        ay: body.ay,
        islem: 'AC',
        kullaniciId: user.id,
        aciklama: body.aciklama ?? null,
      },
    })
  })

  return NextResponse.json({ success: true, yil: body.yil, ay: body.ay, durum: 'ACIK' })
}
