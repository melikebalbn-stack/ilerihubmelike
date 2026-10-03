import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { calistir, hataKodlariniKur, type Baglanti } from './servis-tanim-seed-calistir'
import type { TanimPrisma } from './servis-tanim-seed-mantigi'
import type { Sayim } from './servis-tanim-seed-mantigi'

// ----------------------------------------------------------------------------
// Birim: calistir() — hata durumlarında 1, başarıda 0
// ----------------------------------------------------------------------------

const TAM = ['--db=test_db', '--yerleske-kod=YRL', '--yerleske-ad=Test Yerleşke']

/** Tamamen boş sahte DB. */
function bosPrisma(): TanimPrisma {
  const model = { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'x' })) }
  return Object.fromEntries(
    ['servisYerleske', 'servisFirma', 'servisGuzergah', 'servisDurak', 'servisGuzergahDurak', 'servisArac', 'servisSeferDilimi'].map(
      (m) => [m, model],
    ),
  ) as unknown as TanimPrisma
}

function kur(opts: { aktifDb?: () => Promise<string>; kapat?: () => Promise<void> } = {}) {
  const kapat = vi.fn(opts.kapat ?? (async () => undefined))
  const baglanti: Baglanti = {
    prisma: bosPrisma(),
    aktifVeritabani: opts.aktifDb ?? (async () => 'test_db'),
    kapat,
  }
  const baglan = vi.fn(() => baglanti)
  const log = vi.fn()
  const err = vi.fn()
  return { baglan, log, err, kapat, deps: { baglan, log, err } }
}

const stderrMetni = (err: ReturnType<typeof vi.fn>) => err.mock.calls.map((c) => c[0]).join('\n')

describe('calistir() — hata durumlarında exit kodu 1', () => {
  it('a) --yerleske-kod eksik → 1, DB bağlantısı hiç açılmaz, hata stderr\'e', async () => {
    const t = kur()
    expect(await calistir(['--db=test_db', '--yerleske-ad=Y'], t.deps)).toBe(1)
    expect(t.baglan).not.toHaveBeenCalled()
    expect(stderrMetni(t.err)).toMatch(/--yerleske-kod=<deger> ZORUNLU/)
    expect(t.log).not.toHaveBeenCalled()
  })

  it('b) --yerleske-ad eksik → 1', async () => {
    const t = kur()
    expect(await calistir(['--db=test_db', '--yerleske-kod=K'], t.deps)).toBe(1)
    expect(t.baglan).not.toHaveBeenCalled()
    expect(stderrMetni(t.err)).toMatch(/--yerleske-ad=<deger> ZORUNLU/)
  })

  it('c) --db eksik → 1', async () => {
    const t = kur()
    expect(await calistir(['--yerleske-kod=K', '--yerleske-ad=Y'], t.deps)).toBe(1)
    expect(t.baglan).not.toHaveBeenCalled()
    expect(stderrMetni(t.err)).toMatch(/--db=<deger> ZORUNLU/)
  })

  it('d) --db uyuşmazlığı → 1; plan çıkarılmaz, bağlantı yine kapatılır', async () => {
    const t = kur({ aktifDb: async () => 'baska_db' })
    expect(await calistir(TAM, t.deps)).toBe(1)
    expect(stderrMetni(t.err)).toMatch(/UYUŞMUYOR/)
    expect(t.kapat).toHaveBeenCalledTimes(1)
    expect(t.log).not.toHaveBeenCalled() // "doğrulandı" satırı bile basılmaz
  })

  it('e) --firma-ad verilmiş → 1', async () => {
    const t = kur()
    expect(await calistir([...TAM, '--firma-ad=X'], t.deps)).toBe(1)
    expect(t.baglan).not.toHaveBeenCalled()
    expect(stderrMetni(t.err)).toMatch(/--firma-ad KALDIRILDI/)
  })

  it('f) PLACEHOLDER durdurması → 1, DB bağlantısı HİÇ açılmaz', async () => {
    const t = kur()
    const deps = { ...t.deps, veri: { araclar: [{ plaka: '34 T 1', kapasite: 1, firmaAd: 'Firma (PLACEHOLDER)' }] } }
    expect(await calistir(TAM, deps)).toBe(1)
    expect(t.baglan).not.toHaveBeenCalled()
    expect(stderrMetni(t.err)).toMatch(/PLACEHOLDER/)
  })

  it('g) plan ≠ apply uyuşmazlığı → 1, bağlantı kapatılır, hata stderr\'e', async () => {
    const t = kur()
    const yanlis = vi.fn(async (): Promise<Sayim> => ({
      yerleske: 99, firma: 0, guzergah: 0, durak: 0, bag: 0, arac: 0, dilim: 0,
    }))
    expect(await calistir([...TAM, '--apply'], { ...t.deps, uygula: yanlis })).toBe(1)
    expect(yanlis).toHaveBeenCalledTimes(1)
    expect(stderrMetni(t.err)).toMatch(/Plan ile uygulama sayıları FARKLI: yerleske/)
    expect(t.kapat).toHaveBeenCalledTimes(1)
  })

  it('h) beklenmeyen hata (DB bağlantısı yok) → 1, bağlantı kapatılır', async () => {
    const t = kur({
      aktifDb: async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:1')
      },
    })
    expect(await calistir(TAM, t.deps)).toBe(1)
    expect(stderrMetni(t.err)).toMatch(/ECONNREFUSED/)
    expect(t.kapat).toHaveBeenCalledTimes(1)
  })

  it('h2) planlama sırasında beklenmeyen hata → 1', async () => {
    const t = kur()
    const prisma = bosPrisma()
    ;(prisma.servisYerleske.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('tablo yok'))
    t.baglan.mockReturnValue({ prisma, aktifVeritabani: async () => 'test_db', kapat: t.kapat })
    expect(await calistir(TAM, t.deps)).toBe(1)
    expect(stderrMetni(t.err)).toMatch(/tablo yok/)
  })
})

describe('calistir() — başarı', () => {
  it('i) başarılı dry-run → 0; çıktı stdout\'ta, stderr boş, bağlantı bir kez kapatılır', async () => {
    const t = kur()
    expect(await calistir(TAM, t.deps)).toBe(0)
    const stdout = t.log.mock.calls.map((c) => c[0]).join('\n')
    expect(stdout).toMatch(/DRY-RUN/)
    expect(stdout).toMatch(/guzergah\s+oluşturulacak:\s+10/)
    expect(t.err).not.toHaveBeenCalled()
    expect(t.kapat).toHaveBeenCalledTimes(1)
  })

  it('başarılı apply (plan = apply) → 0', async () => {
    const t = kur()
    expect(await calistir([...TAM, '--apply'], t.deps)).toBe(0)
    expect(t.err).not.toHaveBeenCalled()
  })
})

describe('calistir() — disconnect hatası', () => {
  it('asıl hata varsa disconnect hatası onu YUTMAZ: ikisi de stderr\'de, kod 1', async () => {
    const t = kur({
      aktifDb: async () => 'baska_db',
      kapat: async () => {
        throw new Error('pool kapanmadı')
      },
    })
    expect(await calistir(TAM, t.deps)).toBe(1)
    const metin = stderrMetni(t.err)
    expect(metin).toMatch(/UYUŞMUYOR/) // asıl hata
    expect(metin).toMatch(/\(ek\) Bağlantı kapatılamadı/)
    expect(metin).toMatch(/pool kapanmadı/)
  })

  it('asıl hata yoksa disconnect hatası da başarısızlıktır → 1', async () => {
    const t = kur({
      kapat: async () => {
        throw new Error('pool kapanmadı')
      },
    })
    expect(await calistir(TAM, t.deps)).toBe(1)
    expect(stderrMetni(t.err)).toMatch(/Bağlantı kapatılamadı/)
  })
})

describe('hataKodlariniKur()', () => {
  it('unhandledRejection ve uncaughtException exit(1) çağırır ve stderr\'e yazar', () => {
    const olaylar = new Map<string, (e: unknown) => void>()
    const exit = vi.fn()
    const err = vi.fn()
    hataKodlariniKur({ on: (o, f) => olaylar.set(o, f), exit }, err)

    olaylar.get('unhandledRejection')!(new Error('reddedildi'))
    expect(exit).toHaveBeenLastCalledWith(1)
    expect(err.mock.calls.at(-1)![0]).toMatch(/reddedildi/)

    olaylar.get('uncaughtException')!(new Error('patladı'))
    expect(exit).toHaveBeenLastCalledWith(1)
    expect(err.mock.calls.at(-1)![0]).toMatch(/patladı/)
  })
})

// ----------------------------------------------------------------------------
// Gerçek süreç: seed script'i alt süreç (tsx) olarak çalıştır, çıkış kodunu ölç.
//
// DATABASE_URL her zaman ULAŞILAMAZ bir adrese ayarlı: bu testler hiçbir
// koşulda gerçek DB'ye bağlanamaz. d (--db uyuşmazlığı), f (PLACEHOLDER: veri
// boş olduğu için gerçek süreçte üretilemez), g (plan≠apply: --apply gerçek
// DB ister) ve i (başarılı dry-run: DB okur) alt süreçle TEST EDİLEMEZ — CI'da
// DB yok ve dev DB'ye bu testlerden bağlanılmaz; bunlar yukarıdaki birim
// testlerinde (calistir, sahte DB) sabitlendi.
// ----------------------------------------------------------------------------

const KOK = process.cwd()
const TSX = resolve(KOK, 'node_modules/.bin/tsx')
const SEED = resolve(KOK, 'prisma/seed-servis-tanim.ts')
const ULASILAMAZ_DB = 'postgresql://yok:yok@127.0.0.1:1/yok'

function calistirSurec(args: string[]) {
  const r = spawnSync(TSX, [SEED, ...args], {
    cwd: KOK,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: ULASILAMAZ_DB },
    timeout: 60_000,
  })
  return { kod: r.status, stdout: r.stdout, stderr: r.stderr }
}

describe('gerçek süreç (tsx alt süreç) — çıkış kodu', () => {
  it('a) --yerleske-kod eksik → exit 1, stdout boş, mesaj stderr\'de', () => {
    const r = calistirSurec(['--db=x', '--yerleske-ad=Y'])
    expect(r.kod).toBe(1)
    expect(r.stdout).toBe('')
    expect(r.stderr).toMatch(/--yerleske-kod=<deger> ZORUNLU/)
  }, 60_000)

  it('b) --yerleske-ad eksik → exit 1', () => {
    const r = calistirSurec(['--db=x', '--yerleske-kod=K'])
    expect(r.kod).toBe(1)
    expect(r.stdout).toBe('')
    expect(r.stderr).toMatch(/--yerleske-ad=<deger> ZORUNLU/)
  }, 60_000)

  it('c) --db eksik → exit 1', () => {
    const r = calistirSurec(['--yerleske-kod=K', '--yerleske-ad=Y'])
    expect(r.kod).toBe(1)
    expect(r.stdout).toBe('')
    expect(r.stderr).toMatch(/--db=<deger> ZORUNLU/)
  }, 60_000)

  it('e) --firma-ad verilmiş → exit 1', () => {
    const r = calistirSurec(['--db=x', '--yerleske-kod=K', '--yerleske-ad=Y', '--firma-ad=Z'])
    expect(r.kod).toBe(1)
    expect(r.stdout).toBe('')
    expect(r.stderr).toMatch(/--firma-ad KALDIRILDI/)
  }, 60_000)

  it('h) DB\'ye bağlanılamıyor (beklenmeyen hata) → exit 1, stdout boş, hata stderr\'de', () => {
    const r = calistirSurec(['--db=x', '--yerleske-kod=K', '--yerleske-ad=Y'])
    expect(r.kod).toBe(1)
    expect(r.stdout).toBe('')
    expect(r.stderr.length).toBeGreaterThan(0)
  }, 60_000)

  it('zincir kanıtı: hatalı parametreyle `script && echo SONRAKI` → SONRAKI görünmez', () => {
    const r = spawnSync('bash', ['-c', `"${TSX}" "${SEED}" --db=x && echo SONRAKI`], {
      cwd: KOK,
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: ULASILAMAZ_DB },
      timeout: 60_000,
    })
    expect(r.status).not.toBe(0)
    expect(r.stdout).not.toContain('SONRAKI')
  }, 60_000)

  it('zincir yöntemi kontrolü (pozitif): başarılı komutla `&& echo SONRAKI` → SONRAKI görünür', () => {
    const r = spawnSync('bash', ['-c', 'true && echo SONRAKI'], { encoding: 'utf8' })
    expect(r.stdout).toContain('SONRAKI')
  })

  it('yakalanmamış promise reddi ve uncaughtException gerçek süreçte exit 1 verir', () => {
    const dizin = mkdtempSync(join(tmpdir(), 'seed-exit-'))
    try {
      const lib = resolve(KOK, 'src/lib/servis-yonetimi/servis-tanim-seed-calistir.ts')
      const f1 = join(dizin, 'reddet.ts')
      const f2 = join(dizin, 'patla.ts')
      const f0 = join(dizin, 'saglam.ts')
      const baslik = `import { hataKodlariniKur } from '${lib}'\nhataKodlariniKur(process, console.error)\n`
      writeFileSync(f1, `${baslik}Promise.reject(new Error('reddedildi'))\n`)
      writeFileSync(f2, `${baslik}setTimeout(() => { throw new Error('patladi') }, 10)\n`)
      writeFileSync(f0, `${baslik}console.log('tamam')\n`)

      const calis = (f: string) => spawnSync(TSX, [f], { cwd: KOK, encoding: 'utf8', timeout: 60_000 })
      const r1 = calis(f1)
      expect(r1.status).toBe(1)
      expect(r1.stderr).toMatch(/reddedildi/)
      const r2 = calis(f2)
      expect(r2.status).toBe(1)
      expect(r2.stderr).toMatch(/patladi/)
      const r0 = calis(f0) // pozitif kontrol: hata yoksa 0
      expect(r0.status).toBe(0)
    } finally {
      rmSync(dizin, { recursive: true, force: true })
    }
  }, 120_000)
})
