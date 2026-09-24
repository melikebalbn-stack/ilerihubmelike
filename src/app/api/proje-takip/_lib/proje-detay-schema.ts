import { z } from "zod";
import { yeniProjeSchema } from "./schema";
import { muhendislikDoldurSchema } from "./muhendislik-schema";
import { DURUM_DEGERLERI } from "./sabitler";

// Birleşik detay ekranı (satış + mühendislik + durum) için tek zod şeması —
// yeniProjeSchema + muhendislikDoldurSchema'nın birleşimi. "ileriKod" iki
// şemada da var, aynı tanım (z.string().optional()) olduğu için merge sorunsuz.
export const projeDetaySchema = yeniProjeSchema.merge(muhendislikDoldurSchema).extend({
  durum: z.enum(DURUM_DEGERLERI).optional(),
  // yeniProjeSchema'dan kaldırıldı (satış artık seçmiyor) - detay ekranında
  // ayrıca atanabiliyor, o yüzden burada tekrar tanımlı.
  muhendislikSorumluId: z.string().optional(),
});

export type ProjeDetayValues = z.infer<typeof projeDetaySchema>;
