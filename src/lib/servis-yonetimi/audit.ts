import type { Prisma, ServisIslemHedefTipi, ServisIslemTuru } from '@/generated/prisma'

// ServisIslemGecmisi — 13 modelin (Firma, Yerleşke, Güzergah, Durak, Araç,
// Şoför, Sefer Dilimi, Güzergah-Durak+Saat, Araç/Şoför Varsayılan, Sorumlusu,
// Personel Durum, Personel Atama+Dilim) create/update/pasifleştir/geri-al
// işlemlerini TEK bir çapraz-kesit tabloda loglayan paylaşılan yazma
// fonksiyonu (bkz. schema.prisma ServisIslemGecmisi, ServisIslemHedefTipi).
//
// tx ZORUNLU: mutasyonla AYNI transaction'da çağrılmalı — aksi halde
// mutasyon başarılı olup audit kaydı sessizce eksik kalabilir (bkz.
// yillik-calisma-takvimi/audit.ts'teki aynı desen).
//
// KVKK/madde 23: oncekiDeger/yeniDeger'e YALNIZ hedef satırın kendi
// skaler/FK kolonları yazılır (örn. personnelId bir FK olarak zaten o
// satırda var — yeni bir PII kopyası değil). JOIN'lenmiş/denormalize
// alan (personel.adSoyad, guzergah.ad vb.) KESİNLİKLE yazılmaz. Tam satır
// değil, yalnız FİİLEN DEĞİŞEN alanlar yazılır — bkz. degisenAlanlar().
export async function kaydetIslemGecmisi(params: {
  tx: Prisma.TransactionClient
  hedefTipi: ServisIslemHedefTipi
  hedefId: string
  islem: ServisIslemTuru
  yapanId?: string | null
  oncekiDeger?: Record<string, unknown> | null
  yeniDeger?: Record<string, unknown> | null
  aciklama?: string | null
}) {
  const { tx, hedefTipi, hedefId, islem, yapanId, oncekiDeger, yeniDeger, aciklama } = params
  await tx.servisIslemGecmisi.create({
    data: {
      hedefTipi,
      hedefId,
      islem,
      userId: yapanId || null,
      oncekiDeger: (oncekiDeger as Prisma.InputJsonValue) ?? undefined,
      yeniDeger: (yeniDeger as Prisma.InputJsonValue) ?? undefined,
      aciklama: aciklama || null,
    },
  })
}

// Yalnız fiilen değişen alanları döner (tam satır değil — KVKK madde 23,
// gereksiz genişlik yok). `yeni` içinde bulunmayan alanlar hiç
// değerlendirilmez (kısmi güncelleme desteği). Hiçbir alan değişmediyse
// null döner — çağıran taraf bu durumda kaydetIslemGecmisi'yi hiç
// çağırmamalı (anlamsız/boş audit satırı yazılmasın).
// Prisma.Decimal (enlem/boylam gibi @db.Decimal alanları) JSON.stringify'da
// STRING olur ("40.123456"), form'dan gelen plain number ise NUMBER olur
// (40.123456) — aynı değer olsa da iki farklı JSON çıktısı üretir ve
// değişmemiş bir alanı yanlışlıkla "değişti" olarak işaretler. toNumber()
// duck-type kontrolüyle Decimal'i number'a normalize ederek karşılaştırıyoruz.
function normalizeKarsilastirma(deger: unknown): unknown {
  if (deger !== null && typeof deger === 'object' && 'toNumber' in deger && typeof (deger as { toNumber: unknown }).toNumber === 'function') {
    return (deger as { toNumber: () => number }).toNumber()
  }
  return deger
}

export function degisenAlanlar<T extends Record<string, unknown>>(
  eski: T,
  yeni: Record<string, unknown>,
  alanlar: (keyof T)[],
): { oncekiDeger: Record<string, unknown>; yeniDeger: Record<string, unknown> } | null {
  const oncekiDeger: Record<string, unknown> = {}
  const yeniDegerSonuc: Record<string, unknown> = {}
  for (const alan of alanlar) {
    if (!(alan in yeni)) continue
    const eskiDeger = eski[alan]
    const yeniD = yeni[alan as string]
    if (JSON.stringify(normalizeKarsilastirma(eskiDeger)) !== JSON.stringify(normalizeKarsilastirma(yeniD))) {
      oncekiDeger[alan as string] = eskiDeger
      yeniDegerSonuc[alan as string] = yeniD
    }
  }
  if (Object.keys(yeniDegerSonuc).length === 0) return null
  return { oncekiDeger, yeniDeger: yeniDegerSonuc }
}
