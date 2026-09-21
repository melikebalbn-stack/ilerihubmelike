import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { postgresSorguCalistir, sqlDenetle } from '@/lib/rapor/veri-seti'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const Govde = z.object({
  /** $1,$2… biçiminde (istemci {p.x}'i çevirir). */
  sorgu: z.string().min(1),
  /** Sıralı parametre adları ($1 → [0]). */
  parametreler: z.array(z.string()).default([]),
  degerler: z.record(z.string(), z.object({ tip: z.enum(['metin', 'sayi', 'tarih']), deger: z.string() })).default({}),
})
const SATIR = 20

/** POST — SQL kaynağı denemesi: READ ONLY + 30 sn işlemde koşar, ilk 20 satır + kolon adları. */
export async function POST(req: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const govde = Govde.safeParse(await req.json().catch(() => null))
  if (!govde.success) return NextResponse.json({ error: 'Geçersiz gövde' }, { status: 400 })
  const { sorgu, parametreler, degerler } = govde.data
  const denetim = sqlDenetle(sorgu)
  if (denetim) return NextResponse.json({ error: `SQL: ${denetim}` }, { status: 400 })
  const args: unknown[] = []
  for (const ad of parametreler) {
    const v = degerler[ad]
    if (!v || v.deger.trim() === '') return NextResponse.json({ error: `'${ad}' parametresi için değer girin` }, { status: 400 })
    if (v.tip === 'sayi') { const n = Number(v.deger.replace(',', '.')); if (!Number.isFinite(n)) return NextResponse.json({ error: `'${ad}' sayı olmalı` }, { status: 400 }); args.push(n) }
    else if (v.tip === 'tarih') { const d = new Date(v.deger); if (Number.isNaN(d.getTime())) return NextResponse.json({ error: `'${ad}' geçerli tarih olmalı` }, { status: 400 }); args.push(d) }
    else args.push(v.deger)
  }
  const t0 = Date.now()
  try {
    const satirlar = await postgresSorguCalistir(sorgu, args)
    const kolonlar = satirlar.length ? Object.keys(satirlar[0]) : []
    return NextResponse.json({ kolonlar, satirlar: satirlar.slice(0, SATIR), toplamSatir: satirlar.length, sureMs: Date.now() - t0, ...(kolonlar.length === 0 ? { uyari: 'Satır dönmedi; kolon adları alınamadı' } : {}) })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    const kisa = /statement timeout|canceling statement/i.test(m) ? 'Sorgu 30 sn zaman aşımına uğradı' : /read-only transaction/i.test(m) ? 'Yalnız okuma: veri değiştiren ifade reddedildi' : m.split('\n').slice(-3).join(' ').slice(0, 400)
    return NextResponse.json({ error: kisa }, { status: 400 })
  }
}
