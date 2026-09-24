import { z } from "zod";
import { PROJE_DURUM_TIPI_DEGERLERI } from "./sabitler";

export const muhendislikDoldurSchema = z.object({
  ileriKod: z.string().optional(),
  revizeTerminTrh: z.string().optional(),
  terminProjeTrh: z.string().optional(),
  poNumarasi: z.string().optional(),
  projeDurumTipi: z.enum(PROJE_DURUM_TIPI_DEGERLERI).optional(),

  sevkiyatTrh: z.string().optional(),
  // sevkiyatYil/sevkiyatHafta artık elle alınmıyor - sunucuda sevkiyatTrh'ten hesaplanıyor
  onayTrh: z.string().optional(),
  // onayYil/onayHafta artık elle alınmıyor - sunucuda onayTrh'ten hesaplanıyor

  aciklama: z.string().optional(),
  lokasyon: z.string().optional(),
  birimFiyat: z.coerce.number().optional(),
  birimFiyatParaBirimi: z.enum(["EUR", "USD", "TRY"]).optional(),
  hedefYillik: z.coerce.number().optional(),
  kalipTutar: z.coerce.number().optional(),
  kickOffStatu: z.string().optional(),
  poKalip: z.string().optional(),

  kickoffCW: z.coerce.number().int().optional(),
  kickoffYil: z.coerce.number().int().optional(),
  istemeTrhCW: z.coerce.number().int().optional(),
  istemeTrhYil: z.coerce.number().int().optional(),
  sevkTrhCW: z.coerce.number().int().optional(),
  sevkYil: z.coerce.number().int().optional(),
  poTrhCW: z.coerce.number().int().optional(),
  poYil: z.coerce.number().int().optional(),
  poOngCW: z.coerce.number().int().optional(),
  poOngYil: z.coerce.number().int().optional(),
});

export type MuhendislikDoldurValues = z.infer<typeof muhendislikDoldurSchema>;
