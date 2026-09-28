import { hesaplaYilHafta } from "@/lib/proje-takip/tarih-hesapla";
import { PROJE_FIYAT_ALANLARI } from "@/lib/proje-takip/can-see-fiyat";
import type { ProjeDetayValues } from "./proje-detay-schema";

// create/route.ts (POST) ve [id]/route.ts (PATCH) aynı tam alan setini
// yazıyor - tek kaynak burada, iki route'un birbirinden sapmasını önler.
// undefined = Prisma o alana dokunmaz (PATCH'te "değiştirme" anlamına gelir;
// create'te zaten tüm alanlar create data'sında ilk kez set ediliyor).
// canSeeFiyat false ise fiyat alanları undefined'a çekilir — body'de gelse bile
// yazılmaz, mevcut değer korunur (bkz. can-see-fiyat.ts).
export function projeDetayAlanlari(
  v: ProjeDetayValues,
  { canSeeFiyat }: { canSeeFiyat: boolean }
) {
  const rfpHesap = hesaplaYilHafta(v.rfpTarih);
  const sevkiyatHesap = hesaplaYilHafta(v.sevkiyatTrh);
  const onayHesap = hesaplaYilHafta(v.onayTrh);

  const alanlar = {
    // ── Proje Bilgileri (satış) ──
    musteriFirma: v.musteriFirma,
    musteriYetkilisi: v.musteriYetkilisi,
    musteriKod: v.musteriKod,
    grupKod: v.grupKod,
    kategori: v.kategori,
    ileriKod: v.ileriKod,
    ileriTanim: v.ileriTanim,
    rfpNo: v.rfpNo,
    rfpTarih: v.rfpTarih ? new Date(v.rfpTarih) : undefined,
    rfpAcilisHafta: rfpHesap?.hafta ?? undefined,
    yil: v.yil,
    kalipFikstur: v.kalipFikstur,
    kalipKodu: v.kalipKodu,
    yillikAdet: v.yillikAdet,
    minimumSipMiktari: v.minimumSipMiktari,
    numuneAdedi: v.numuneAdedi,
    prototipFiyati: v.prototipFiyati,
    prototipParaBirimi: v.prototipParaBirimi,
    nre: v.nre,
    nreParaBirimi: v.nreParaBirimi,
    projeKalipFikstur: v.projeKalipFikstur,
    projeBilgisi: v.projeBilgisi,
    muhendislikSorumluId: v.muhendislikSorumluId,

    // ── Plant Parametreleri (mühendislik) ──
    revizeTerminTrh: v.revizeTerminTrh ? new Date(v.revizeTerminTrh) : undefined,
    terminProjeTrh: v.terminProjeTrh ? new Date(v.terminProjeTrh) : undefined,
    poNumarasi: v.poNumarasi,
    projeDurumTipi: v.projeDurumTipi,
    sevkiyatTrh: v.sevkiyatTrh ? new Date(v.sevkiyatTrh) : undefined,
    sevkiyatYil: sevkiyatHesap?.yil ?? undefined,
    sevkiyatHafta: sevkiyatHesap?.hafta ?? undefined,
    onayTrh: v.onayTrh ? new Date(v.onayTrh) : undefined,
    onayYil: onayHesap?.yil ?? undefined,
    onayHafta: onayHesap?.hafta ?? undefined,
    aciklama: v.aciklama,
    lokasyon: v.lokasyon,
    birimFiyat: v.birimFiyat,
    birimFiyatParaBirimi: v.birimFiyatParaBirimi,
    hedefYillik: v.hedefYillik,
    kalipTutar: v.kalipTutar,
    kickOffStatu: v.kickOffStatu,
    poKalip: v.poKalip,
    kickoffCW: v.kickoffCW,
    kickoffYil: v.kickoffYil,
    istemeTrhCW: v.istemeTrhCW,
    istemeTrhYil: v.istemeTrhYil,
    sevkTrhCW: v.sevkTrhCW,
    sevkYil: v.sevkYil,
    poTrhCW: v.poTrhCW,
    poYil: v.poYil,
    poOngCW: v.poOngCW,
    poOngYil: v.poOngYil,
  };

  if (!canSeeFiyat) {
    for (const alan of PROJE_FIYAT_ALANLARI) alanlar[alan] = undefined;
  }
  return alanlar;
}
