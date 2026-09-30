import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getUserPermissions } from '@/lib/auth/get-user-permissions'
import { apiBadRequest, apiForbidden } from '@/lib/api-response'
import {
  MODUL_DURUMLARI,
  MODUL_KATEGORI,
  MODUL_KAYDI,
  durumAnahtari,
  modulBul,
  pilotAnahtari,
  pilotBolumleriYaz,
  type ModulDurum,
} from '@/lib/modul-durum/kayit'
import { modulYayinlari } from '@/lib/modul-durum/sunucu'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Modül yayın durumu yönetimi — Ayarlar > Modül Yayın Durumu ekranı.
// Yetki: admin.system.manage (SystemSetting yazan diğer uçlarla aynı anahtar).
const YETKI = 'admin.system.manage'

async function yetkiliMi() {
  const { user, error } = await requireUser()
  if (error || !user) return { user: null, error }
  const izinler = await getUserPermissions(user.id)
  if (!izinler.has(YETKI)) return { user: null, error: apiForbidden() }
  return { user, error: null }
}

/** GET — kayıttaki modüller + mevcut durumları + pilot seçimi için aktif bölüm listesi. */
export async function GET() {
  const { error } = await yetkiliMi()
  if (error) return error

  const [yayinlar, bolumSatirlari] = await Promise.all([
    modulYayinlari(),
    prisma.personnel.findMany({
      where: { aktif: true, bolum: { not: '' } },
      select: { bolum: true },
      distinct: ['bolum'],
      orderBy: { bolum: 'asc' },
    }),
  ])

  return NextResponse.json({
    moduller: MODUL_KAYDI.map((m) => {
      const y = yayinlar.get(m.anahtar)
      return {
        anahtar: m.anahtar,
        etiket: m.etiket,
        rota: m.rota,
        durum: y?.durum ?? 'ACIK',
        pilotBolumler: y?.pilotBolumler ?? [],
      }
    }),
    bolumler: bolumSatirlari.map((b) => b.bolum).filter(Boolean),
  })
}

/** POST { anahtar, durum, pilotBolumler? } — tek modülün durumunu yazar. */
export async function POST(request: NextRequest) {
  const { error } = await yetkiliMi()
  if (error) return error

  const govde = (await request.json().catch(() => null)) as
    | { anahtar?: unknown; durum?: unknown; pilotBolumler?: unknown }
    | null
  if (!govde) return apiBadRequest('Geçersiz istek gövdesi')

  const anahtar = typeof govde.anahtar === 'string' ? govde.anahtar : ''
  if (!modulBul(anahtar)) return apiBadRequest('Tanınmayan modül anahtarı')

  const durum = typeof govde.durum === 'string' ? govde.durum.toUpperCase() : ''
  if (!(MODUL_DURUMLARI as readonly string[]).includes(durum)) {
    return apiBadRequest(`Durum ${MODUL_DURUMLARI.join(' / ')} olmalı`)
  }

  // pilotBolumler yalnız PILOT'ta anlamlı; diğer durumlarda gelen değer yok sayılmaz,
  // saklanır — PILOT'a geri dönüldüğünde seçim kaybolmasın.
  const pilotBolumler = Array.isArray(govde.pilotBolumler)
    ? govde.pilotBolumler.filter((b): b is string => typeof b === 'string')
    : null
  if (durum === 'PILOT' && (!pilotBolumler || pilotBolumler.length === 0)) {
    return apiBadRequest('PILOT için en az bir bölüm seçilmeli')
  }

  const yaz = (key: string, value: string) =>
    prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value, category: MODUL_KATEGORI },
    })

  await yaz(durumAnahtari(anahtar), durum)
  if (pilotBolumler) await yaz(pilotAnahtari(anahtar), pilotBolumleriYaz(pilotBolumler))

  return NextResponse.json({
    anahtar,
    durum: durum as ModulDurum,
    pilotBolumler: pilotBolumler ?? [],
  })
}
