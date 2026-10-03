import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'

// ============================================================================
// EXPORT GUARD TABLOSU (Ders 94) — GERÇEK requireAllPermissions ile, her export ucu için:
//   • gereken anahtar kümesi KALIR (ekranın anahtarlarını genişletmez/daraltmaz),
//   • kümenin herhangi bir ELEMANI eksikse 403, hiçbiri yoksa 403, oturum yoksa 401,
//   • "servis.view + servis.export YETMEZ" (şikâyet, acil durum),
//   • rol eşlemesi: bu anahtar kümesine sahip olup ekranı göremeyen rol YOK.
// Veri katmanı (prisma) ve denetim KASITLI olarak patlatılır: 403 yolunda veriye
// dokunulmadığı, 200 yolunda guard'ın geçildiği bu sayede kanıtlanır.
// ============================================================================

const mocks = vi.hoisted(() => ({ getServerSession: vi.fn(), getUserPermissions: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('@/lib/auth/get-user-permissions', () => ({ getUserPermissions: mocks.getUserPermissions }))
vi.mock('@/lib/audit-log', () => ({ logAuditEvent: vi.fn(async () => ({ ok: false })) }))
vi.mock('@/lib/prisma', () => ({
  prisma: new Proxy({}, { get: () => new Proxy({}, { get: () => () => { throw new Error('veri katmanı çağrıldı') } }) }),
}))

import { GET as guzergahListesi } from './export/guzergah-listesi/route'
import { GET as personelAtama } from './export/personel-atama-listesi/route'
import { GET as guzergahDetay } from './export/guzergah-detay/[id]/route'
import { GET as kapasite } from './export/kapasite/route'
import { GET as guzergahListesiPdf } from './export/guzergah-listesi-pdf/route'
import { GET as operasyonelExcel } from './operasyonel-servis-listesi/export/route'
import { GET as operasyonelPdf } from './operasyonel-servis-listesi/export-pdf/route'
import { GET as veriKalite } from './veri-kalite/export/route'
import { GET as sikayetExcel } from './sikayet/export/route'
import { GET as sikayetPdf } from './sikayet/export/pdf/route'
import { GET as acilDurumPdf } from './acil-durum-listesi/export-pdf/route'

type Uc = {
  ad: string
  /** ÖNCE (Paket A ucu 5560d808) → SONRA (B ucu). */
  once: string
  gereken: string[]
  /** Aynı verinin ekranını açan anahtarlar. */
  ekran: string[]
  cagir: (r: NextRequest) => Promise<Response>
}
const R = (q = '') => new NextRequest(`http://localhost/x${q}`)
const ctx = { params: Promise.resolve({ id: 'g1' }) }

const UCLAR: Uc[] = [
  { ad: 'export/guzergah-listesi (xlsx)', once: 'servis.export', gereken: ['servis.view', 'servis.export'], ekran: ['servis.view'], cagir: () => guzergahListesi() },
  { ad: 'export/personel-atama-listesi (xlsx)', once: 'servis.export', gereken: ['servis.view', 'servis.export'], ekran: ['servis.view'], cagir: () => personelAtama() },
  { ad: 'export/guzergah-detay/[id] (pdf)', once: 'servis.export', gereken: ['servis.view', 'servis.export'], ekran: ['servis.view'], cagir: (r) => guzergahDetay(r, ctx) },
  { ad: 'operasyonel-servis-listesi/export (xlsx)', once: 'servis.export', gereken: ['servis.view', 'servis.export'], ekran: ['servis.view'], cagir: (r) => operasyonelExcel(r) },
  { ad: 'operasyonel-servis-listesi/export-pdf', once: 'servis.export', gereken: ['servis.view', 'servis.export'], ekran: ['servis.view'], cagir: (r) => operasyonelPdf(r) },
  { ad: 'veri-kalite/export (xlsx)', once: 'servis.view + servis.export', gereken: ['servis.view', 'servis.export'], ekran: ['servis.view'], cagir: () => veriKalite() },
  { ad: 'export/kapasite (xlsx) [YENİ]', once: '—', gereken: ['servis.view', 'servis.export'], ekran: ['servis.view'], cagir: (r) => kapasite(r) },
  { ad: 'export/guzergah-listesi-pdf [YENİ]', once: '—', gereken: ['servis.view', 'servis.export'], ekran: ['servis.view'], cagir: () => guzergahListesiPdf() },
  { ad: 'sikayet/export (xlsx)', once: 'servis.sikayet.view + servis.export', gereken: ['servis.sikayet.view', 'servis.export'], ekran: ['servis.sikayet.view'], cagir: (r) => sikayetExcel(r) },
  { ad: 'sikayet/export/pdf', once: 'servis.sikayet.view + servis.export', gereken: ['servis.sikayet.view', 'servis.export'], ekran: ['servis.sikayet.view'], cagir: (r) => sikayetPdf(r) },
  { ad: 'acil-durum-listesi/export-pdf', once: 'servis.view + servis.kvkk.view', gereken: ['servis.view', 'servis.kvkk.view'], ekran: ['servis.view', 'servis.kvkk.view'], cagir: (r) => acilDurumPdf(r) },
]

function oturum(izinler: string[] | null) {
  if (izinler === null) return mocks.getServerSession.mockResolvedValue(null)
  mocks.getServerSession.mockResolvedValue({ user: { id: 'u1' } })
  mocks.getUserPermissions.mockResolvedValue(new Set(izinler))
}

beforeEach(() => vi.clearAllMocks())

describe.each(UCLAR)('$ad', (uc) => {
  const istek = () => R('?guzergahId=g1&dilimId=d1')

  it(`guard KÜMESİ sabit: gereken anahtarların hepsi → guard geçilir (403/401 DEĞİL)`, async () => {
    oturum(uc.gereken)
    const res = await uc.cagir(istek()).catch(() => ({ status: 500 }))
    expect([401, 403]).not.toContain(res.status)
  })

  it('oturum yok → 401', async () => {
    oturum(null)
    expect((await uc.cagir(istek())).status).toBe(401)
  })

  it('izin yok → 403 ve veri katmanına dokunulmaz', async () => {
    oturum([])
    expect((await uc.cagir(istek())).status).toBe(403)
  })

  for (const eksik of uc.gereken) {
    it(`🔴 yalnız "${eksik}" eksik → 403`, async () => {
      oturum(uc.gereken.filter((k) => k !== eksik))
      expect((await uc.cagir(istek())).status).toBe(403)
    })
  }

  it('🔴 gerekenden FAZLASI (tüm servis.* anahtarları) guard\'ı geçer; ama kümenin dışındaki tek anahtar yetmez', async () => {
    const diger = ['servis.view', 'servis.export', 'servis.sikayet.view', 'servis.kvkk.view'].filter((k) => !uc.gereken.includes(k))
    oturum(diger)
    expect((await uc.cagir(istek())).status).toBe(403)
  })
})

describe('🔴 "servis.view + servis.export YETMEZ" — admin rolü senaryosu', () => {
  const admin = ['servis.view', 'servis.export']
  for (const ad of ['sikayet/export (xlsx)', 'sikayet/export/pdf', 'acil-durum-listesi/export-pdf']) {
    it(`${ad} → 403`, async () => {
      oturum(admin)
      const uc = UCLAR.find((u) => u.ad === ad)!
      expect((await uc.cagir(R('?guzergahId=g1&dilimId=d1'))).status).toBe(403)
    })
  }
})

describe('rol eşlemesi (prisma/seed-servis-role-mapping.ts) — export anahtar kümesine sahip olup EKRANI göremeyen rol YOK', () => {
  const kaynak = readFileSync(join(__dirname, '..', '..', '..', '..', 'prisma/seed-servis-role-mapping.ts'), 'utf-8')
  const blok = kaynak.split('const ROLE_MAPPING: Record<string, string[]> = {')[1].split('\n}')[0]
  const eslesme = new Map<string, string[]>(
    [...blok.matchAll(/'(servis\.[a-z.]+)'\s*:\s*\[([^\]]*)\]/g)].map((m) => [m[1], [...m[2].matchAll(/'([a-z-]+)'/g)].map((x) => x[1])]),
  )
  const roller = (anahtarlar: string[]) =>
    [...new Set([...eslesme.values()].flat())].filter((r) => anahtarlar.every((k) => eslesme.get(k)?.includes(r)))

  it('eşleme okundu', () => {
    expect(eslesme.get('servis.export')).toEqual(['super-admin', 'admin', 'hr-yoneticisi'])
  })

  for (const uc of UCLAR) {
    it(`${uc.ad}: gereken kümeye sahip her rol ekranın anahtarlarına da sahip`, () => {
      const sahip = roller(uc.gereken)
      expect(sahip.length).toBeGreaterThan(0)
      for (const r of sahip) expect(roller(uc.ekran)).toContain(r)
    })
  }

  it('sikayet/acil durum: servis.view+servis.export sahibi admin bu uçların kümesinde YOK', () => {
    expect(roller(['servis.sikayet.view', 'servis.export'])).not.toContain('admin')
    expect(roller(['servis.view', 'servis.kvkk.view'])).not.toContain('admin')
  })

  it('B3 öncesi export-only (view yok) rol: yok → AND\'e geçiş hiçbir tanımlı rolü kaybettirmez', () => {
    const exportOnly = (eslesme.get('servis.export') ?? []).filter((r) => !eslesme.get('servis.view')?.includes(r))
    expect(exportOnly).toEqual([])
  })
})
