import { z } from "zod";

export const yeniProjeSchema = z.object({
  // Adım 1: Müşteri Bilgileri
  musteriFirma: z.string().min(1, "Müşteri firma zorunlu"),
  musteriYetkilisi: z.string().optional(),
  musteriKod: z.string().optional(),
  grupKod: z.string().optional(),
  kategori: z.string().optional(),

  // Adım 2: Proje / Ürün Bilgileri
  ileriKod: z.string().optional(),
  ileriTanim: z.string().min(1, "Ürün tanımı zorunlu"),
  rfpNo: z.string().optional(),
  rfpTarih: z.string().optional(), // ISO string, sunucuda Date'e çevrilecek
  // rfpAcilisHafta artık elle alınmıyor - sunucuda rfpTarih'ten hesaplanıyor (bkz. create/route.ts)
  yil: z.coerce.number().int().optional(),
  kalipFikstur: z.enum(["KALIP_YOK", "MUSTERI", "ILERI"]).optional(),
  kalipKodu: z.string().optional(),
  muhendislikSorumluId: z.string().optional(), // boş bırakılırsa departmandaki herkese bildirim gider

  // Adım 3: Miktar & Fiyat
  yillikAdet: z.coerce.number().optional(),
  minimumSipMiktari: z.coerce.number().optional(),
  numuneAdedi: z.string().optional(),
  prototipFiyati: z.coerce.number().optional(),
  prototipParaBirimi: z.enum(["EUR", "USD", "TRY"]).optional(),
  nre: z.coerce.number().optional(),
  nreParaBirimi: z.enum(["EUR", "USD", "TRY"]).optional(),

  // Adım 4: Notlar
  projeKalipFikstur: z.string().optional(),
  projeBilgisi: z.string().optional(),
});

export type YeniProjeFormValues = z.infer<typeof yeniProjeSchema>;
