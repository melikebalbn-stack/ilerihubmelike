import 'server-only'
import { createHash } from 'node:crypto'
import * as path from 'node:path'
import { prisma } from '@/lib/prisma'
import {
  ESLESMEYEN_ESIK_VARSAYILAN,
  acilisExcelOku,
  acilisHubVerisi,
  acilisKapisi,
  acilisRaporDizini,
  acilisRaporYaz,
  acilisSiniflandir,
  acilisUygula,
} from './acilis-import'
import { GUN, IzinGirdiHatasi } from './gun-sayimi'

/**
 * Ekrandan açılış import'u (/izin/yonetim/ice-aktarim). Deneme (dry-run) izin.admin; gerçek aktarım
 * izin.bakiye.admin + AYNI dosyanın (sha256) deneme sonucu + eşik kapısı. Rapor <repo>/uploads/izin/ (600).
 */
export const MAKS_DOSYA = 5 * 1024 * 1024

export async function dosyaAl(form: FormData) {
  const f = form.get('dosya')
  if (!(f instanceof File)) throw new IzinGirdiHatasi('Excel dosyası seçilmedi')
  if (f.size === 0 || f.size > MAKS_DOSYA) throw new IzinGirdiHatasi('Dosya boş ya da 5 MB üstü')
  if (!/\.xlsx?$/i.test(f.name)) throw new IzinGirdiHatasi('Yalnız .xlsx / .xls')
  const tarih = String(form.get('tarih') ?? '')
  if (!GUN.test(tarih)) throw new IzinGirdiHatasi('Açılış tarihi seçilmeli')
  const buffer = Buffer.from(await f.arrayBuffer())
  return { buffer, ad: path.basename(f.name), tarih, sha256: createHash('sha256').update(buffer).digest('hex') }
}

async function calistir(d: Awaited<ReturnType<typeof dosyaAl>>, mod: 'DRY-RUN' | 'APPLY', aktorId: string) {
  const okuma = acilisExcelOku(d.buffer)
  const hub = await acilisHubVerisi(prisma)
  const sonuc = acilisSiniflandir(okuma.satirlar, hub.personeller, hub.acilisiOlanlar)
  const etiket = `${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}-${mod === 'APPLY' ? 'apply' : 'dryrun'}-ekran`
  const rapor = acilisRaporYaz(acilisRaporDizini(), sonuc, {
    mod, kaynak: d.ad, kaynakSha256: d.sha256, tarih: d.tarih, aktorId, baslikSatiri: okuma.baslikSatiri,
    sicilSutunu: okuma.sicilSutunu, kalanSutunu: okuma.kalanSutunu, esik: ESLESMEYEN_ESIK_VARSAYILAN, zaman: new Date().toISOString(),
  }, etiket)
  return { okuma, hub, sonuc, rapor }
}

const ekranOzeti = (r: Awaited<ReturnType<typeof calistir>>, d: { sha256: string; tarih: string }) => ({
  sha256: d.sha256,
  tarih: d.tarih,
  gecisTarihi: r.hub.gecisTarihi,
  baslikSatiri: r.okuma.baslikSatiri,
  sutunlar: { sicil: r.okuma.sicilSutunu, kalan: r.okuma.kalanSutunu },
  satir: r.okuma.satirlar.length,
  ozet: r.sonuc.ozet,
  toplamGun: r.sonuc.toplamGun,
  eslesmeyen: r.sonuc.eslesmeyen,
  esik: ESLESMEYEN_ESIK_VARSAYILAN,
  kapi: acilisKapisi(r.sonuc, ESLESMEYEN_ESIK_VARSAYILAN) ?? (r.hub.gecisTarihi && r.hub.gecisTarihi !== d.tarih ? `geçiş tarihi ${r.hub.gecisTarihi} olarak kayıtlı` : null),
  rapor: path.basename(r.rapor.csv),
  sorunlu: r.sonuc.kayitlar
    .filter((k) => k.sinif !== 'ESLESEN')
    .map((k) => ({ satir: k.satir, sicil: k.sicil, deger: k.degerHam, sinif: k.sinif, adSoyad: k.personel?.adSoyad ?? null, aciklama: k.aciklama })),
  eslesen: r.sonuc.kayitlar
    .filter((k) => k.sinif === 'ESLESEN')
    .map((k) => ({ satir: k.satir, sicil: k.sicil, gun: k.gun, adSoyad: k.personel!.adSoyad, departman: k.personel!.departman })),
  hubAktifDosyadaYok: r.sonuc.hubAktifDosyadaYok.map((p) => ({ sicil: p.sicilNo, adSoyad: p.adSoyad, departman: p.departman })),
})

export async function acilisDeneme(form: FormData, aktorId: string) {
  const d = await dosyaAl(form)
  const r = await calistir(d, 'DRY-RUN', aktorId)
  return ekranOzeti(r, d)
}

export async function acilisAktar(form: FormData, aktorId: string) {
  const d = await dosyaAl(form)
  if (String(form.get('denemeSha256') ?? '') !== d.sha256) {
    throw new IzinGirdiHatasi('Önce bu dosyayla deneme çalıştırın (dosya denemeden sonra değişmiş)')
  }
  if (String(form.get('onay') ?? '') !== 'AKTAR') throw new IzinGirdiHatasi('Onay metni eksik')
  const r = await calistir(d, 'APPLY', aktorId)
  const kapi = acilisKapisi(r.sonuc, ESLESMEYEN_ESIK_VARSAYILAN)
  if (kapi) throw new IzinGirdiHatasi(`Aktarım DURDU — ${kapi}; hiçbir şey yazılmadı`)
  const s = await acilisUygula(prisma, { sonuc: r.sonuc, tarih: d.tarih, yillikTurId: r.hub.yillikTurId, aktorId, rapor: r.rapor.csv, kaynakSha256: d.sha256 })
  return { ...s, rapor: path.basename(r.rapor.csv) }
}
