// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * KURAL (Melih 27.09): IzinTalep HİÇ SİLİNMEZ — geri çekme / iptal DURUM değişikliğidir (IPTAL).
 * Hiçbir servis/API talep silme sunmaz. Bu test izin kodunda talep silme çağrısını YASAKLAR
 * (Prisma delete/deleteMany ya da ham SQL). İzin kodu yazıldıkça kapsam otomatik genişler.
 */
const KOK = path.resolve(__dirname, '../../..')
const KAPSAM = ['src/lib/izin', 'src/app/api/izin', 'src/app/(dashboard)/izin', 'scripts/izin']
const YASAK = [
  /izinTalep\s*\.\s*delete(Many)?\s*\(/, // prisma.izinTalep.delete / deleteMany (tx dahil)
  /izinTalepGun\s*\.\s*delete(Many)?\s*\(/, // gün satırları talebin parçası — o da silinmez
  /DELETE\s+FROM\s+"?izin_talep(_gun)?"?/i,
]

function dosyalar(dizin: string): string[] {
  const tam = path.join(KOK, dizin)
  if (!fs.existsSync(tam)) return []
  return (fs.readdirSync(tam, { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => path.join(tam, f))
}

describe('IzinTalep silinmez', () => {
  it('izin kodunda talep silme çağrısı YOK', () => {
    const ihlaller: string[] = []
    const taranan = KAPSAM.flatMap(dosyalar)
    for (const f of taranan) {
      const icerik = fs.readFileSync(f, 'utf8')
      for (const r of YASAK) if (r.test(icerik)) ihlaller.push(`${path.relative(KOK, f)} → ${r}`)
    }
    expect(taranan.length).toBeGreaterThan(0) // kapsam boş kalıp test boşa geçmesin
    expect(ihlaller).toEqual([])
  })
  it('desenler gerçekten yakalıyor (kendi kendini doğrulama)', () => {
    for (const ornek of ['await prisma.izinTalep.delete({ where })', 'tx.izinTalep.deleteMany({})', 'tx.izinTalepGun.deleteMany({})', 'DELETE FROM "izin_talep" WHERE']) {
      expect(YASAK.some((r) => r.test(ornek))).toBe(true)
    }
    expect(YASAK.some((r) => r.test("prisma.izinTalep.update({ data: { durum: 'IPTAL' } })"))).toBe(false)
  })
})
