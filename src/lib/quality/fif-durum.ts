/**
 * FİF (KAL-FR-10) durum makinesi — TEK KAYNAK (Faz 2).
 *
 * `gecisYapabilirMi(ctx, fif, hedef)` SAF fonksiyon: yetki + ön koşulu birlikte
 * değerlendirir, {ok, sebep?} döner. UI ve API AYNI fonksiyonu çağırır; kural
 * hiçbir yerde tekrarlanmaz. Rol eşleşmesi fif alanlarından (düz string userId)
 * + ctx'ten hesaplanır; "sorumlu bölüm müdürü" User id'si DB'den çözülüp ctx'e
 * konur (saf fonksiyon DB'ye inmez).
 */
import { FifDurum, FifSonuc } from '@/generated/prisma'

/** Geçiş kararı için gereken bağlam. */
export type FifGecisCtx = {
  userId: string | null
  isManage: boolean
  /** Sorumlu bölümün müdürünün User id'si (DB'den çözülür; yoksa null). */
  sorumluBolumMudurUserId?: string | null
}

/** Geçiş kararı için gereken FİF alanları (DB'siz test edilebilir). */
export type FifGecisState = {
  durum: FifDurum
  createdById: string | null
  hazirlayanUserId: string | null
  yayinlayanOnaylayanUserId: string | null
  sorumluOnaylayanUserId: string | null
  izlemeSorumlusuUserId: string | null
  takipSorumlusuUserId: string | null
  sorumluBolumId: string | null
  uygunsuzlukTanimi: string | null
  tur: string | null
  faaliyetler: { hedefTarih: Date | string | null }[]
  etkinlikler: { madde: string; uygun: boolean | null }[]
}

export type GecisSonuc = { ok: true } | { ok: false; sebep: string }

const OK: GecisSonuc = { ok: true }
const no = (sebep: string): GecisSonuc => ({ ok: false, sebep })

/** Kullanıcı bu FİF'te belirli bir "rol" tutuyor mu (userId eşleşmesi + manage). */
function esitVeyaManage(ctx: FifGecisCtx, userId: string | null): boolean {
  if (ctx.isManage) return true
  return !!ctx.userId && ctx.userId === userId
}
function hazirlayanMi(ctx: FifGecisCtx, s: FifGecisState): boolean {
  return esitVeyaManage(ctx, s.createdById) || esitVeyaManage(ctx, s.hazirlayanUserId)
}

/** Bir geçişin izin + ön koşul kuralı. */
type GecisKural = {
  from: FifDurum
  to: FifDurum
  /** Kısa etiket (UI buton metni). */
  etiket: string
  izinli: (ctx: FifGecisCtx, s: FifGecisState) => boolean
  onKosul?: (s: FifGecisState) => GecisSonuc
}

/** Zorunlu alanlar (validator ile TEK kaynak — fif-validators FIF_ZORUNLU_ALANLAR). */
function zorunluAlanlarTam(s: FifGecisState): GecisSonuc {
  if (!s.tur) return no('Tür zorunlu')
  if (!s.sorumluBolumId) return no('Sorumlu bölüm zorunlu')
  if (!s.uygunsuzlukTanimi || !s.uygunsuzlukTanimi.trim()) return no('Tespit (uygunsuzluk tanımı) zorunlu')
  return OK
}

export const FIF_GECISLER: GecisKural[] = [
  {
    from: FifDurum.TASLAK, to: FifDurum.ONAY_BEKLIYOR, etiket: 'Onaya Gönder',
    izinli: (c, s) => hazirlayanMi(c, s),
    onKosul: zorunluAlanlarTam,
  },
  {
    from: FifDurum.ONAY_BEKLIYOR, to: FifDurum.FAALIYET, etiket: 'Onayla',
    izinli: (c, s) => esitVeyaManage(c, s.yayinlayanOnaylayanUserId),
  },
  {
    from: FifDurum.ONAY_BEKLIYOR, to: FifDurum.TASLAK, etiket: 'Reddet',
    izinli: (c, s) => esitVeyaManage(c, s.yayinlayanOnaylayanUserId),
    // redNedeni API tarafında zorunlu (aciklama).
  },
  {
    from: FifDurum.FAALIYET, to: FifDurum.KAPATMA_BEKLIYOR, etiket: 'Kapatmaya Gönder',
    izinli: (c, s) =>
      esitVeyaManage(c, s.izlemeSorumlusuUserId) ||
      (!!c.sorumluBolumMudurUserId && esitVeyaManage(c, c.sorumluBolumMudurUserId)) ||
      c.isManage,
    onKosul: (s) => {
      if (s.faaliyetler.length === 0) return no('En az bir faaliyet satırı gerekli')
      if (s.faaliyetler.some((f) => !f.hedefTarih)) return no('Her faaliyet satırında hedef tarih gerekli')
      return OK
    },
  },
  {
    from: FifDurum.KAPATMA_BEKLIYOR, to: FifDurum.ETKINLIK, etiket: 'Kapatmayı Onayla',
    izinli: (c, s) => esitVeyaManage(c, s.sorumluOnaylayanUserId),
  },
  {
    from: FifDurum.KAPATMA_BEKLIYOR, to: FifDurum.FAALIYET, etiket: 'Reddet',
    izinli: (c, s) => esitVeyaManage(c, s.sorumluOnaylayanUserId),
  },
  {
    from: FifDurum.ETKINLIK, to: FifDurum.KAPANDI, etiket: 'Kapat (Etkin)',
    izinli: (c, s) => esitVeyaManage(c, s.takipSorumlusuUserId),
    onKosul: (s) => {
      const kap = s.etkinlikler.find((e) => e.madde === 'KAPATMA')
      const tek = s.etkinlikler.find((e) => e.madde === 'TEKRAR_ETMEME')
      if (!kap || !tek) return no('İki etkinlik satırı (Kapatma + Tekrar Etmeme) gerekli')
      if (kap.uygun !== true || tek.uygun !== true) return no('Her iki etkinlik de "uygun" olmalı')
      return OK
    },
  },
  {
    from: FifDurum.ETKINLIK, to: FifDurum.FAALIYET, etiket: 'Etkin Değil (Yeniden Aç)',
    izinli: (c, s) => esitVeyaManage(c, s.takipSorumlusuUserId),
    // uygun=false → yeniden açılır; API faaliyet sonuc=YT işaretler.
  },
]

/** IPTAL her durumdan: TASLAK'ta hazırlayan, aksi hâlde yalnız manage. */
function iptalIzinli(ctx: FifGecisCtx, s: FifGecisState): boolean {
  if (ctx.isManage) return true
  if (s.durum === FifDurum.TASLAK) return hazirlayanMi(ctx, s)
  return false
}

/** Ana karar. */
export function gecisYapabilirMi(ctx: FifGecisCtx, s: FifGecisState, hedef: FifDurum): GecisSonuc {
  if (hedef === FifDurum.IPTAL) {
    if (s.durum === FifDurum.KAPANDI) return no('Kapanmış FİF iptal edilemez')
    if (s.durum === FifDurum.IPTAL) return no('Zaten iptal')
    return iptalIzinli(ctx, s) ? OK : no('İptal yetkiniz yok')
  }
  const kural = FIF_GECISLER.find((g) => g.from === s.durum && g.to === hedef)
  if (!kural) return no(`Geçersiz geçiş: ${s.durum} → ${hedef}`)
  if (!kural.izinli(ctx, s)) return no('Bu geçiş için yetkiniz yok')
  if (kural.onKosul) {
    const k = kural.onKosul(s)
    if (!k.ok) return k
  }
  return OK
}

/** UI için: bu kullanıcının şu an yapabileceği geçişler (IPTAL dahil). */
export function uygunGecisler(ctx: FifGecisCtx, s: FifGecisState): { hedef: FifDurum; etiket: string }[] {
  const list = FIF_GECISLER.filter((g) => g.from === s.durum && gecisYapabilirMi(ctx, s, g.to).ok)
    .map((g) => ({ hedef: g.to, etiket: g.etiket }))
  if (gecisYapabilirMi(ctx, s, FifDurum.IPTAL).ok) list.push({ hedef: FifDurum.IPTAL, etiket: 'İptal Et' })
  return list
}

/** Faaliyet/etkinlik düzenleme kilidi: KAPANDI/IPTAL kilitli; manage her zaman. */
export function altKayitDuzenlenebilir(ctx: FifGecisCtx, durum: FifDurum): boolean {
  if (ctx.isManage) return true
  return durum !== FifDurum.KAPANDI && durum !== FifDurum.IPTAL
}

/** ES (ek süre) faaliyet güncellemesi: FAALIYET durumunda sonuc=ES ise ekTerminNedeni zorunlu. */
export function esKuraliGecerli(durum: FifDurum, sonuc: FifSonuc | null | undefined, ekTerminNedeni: string | null | undefined): GecisSonuc {
  if (sonuc === FifSonuc.ES) {
    if (durum !== FifDurum.FAALIYET) return no('Ek süre (ES) yalnız FAALIYET durumunda verilebilir')
    if (!ekTerminNedeni || !ekTerminNedeni.trim()) return no('Ek süre için ek termin nedeni zorunlu')
  }
  return OK
}


/** ES (ek süre) geçmiş açıklaması — FifGecmis.aciklama için TEK KAYNAK biçim. */
export function esGecmisAciklamasi(eskiTarih: string | null, yeniTarih: string, neden: string): string {
  return `ES: ${eskiTarih ?? '—'} → ${yeniTarih}, neden: ${neden}`
}


/** TASLAK + alt kaydı YOK ise hard delete edilebilir (aksi hâlde IPTAL akışı). */
export function hardDeleteEdilebilir(durum: FifDurum, altKayitVar: boolean): boolean {
  return durum === FifDurum.TASLAK && !altKayitVar
}
