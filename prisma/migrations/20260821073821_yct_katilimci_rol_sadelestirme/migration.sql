-- AlterEnum
BEGIN;
CREATE TYPE "YillikTakvimKatilimciRol_new" AS ENUM ('ANA_SORUMLU', 'YEDEK_SORUMLU', 'ONAYLAYAN', 'IKINCI_ONAYLAYAN', 'BILGILENDIRILECEK');
ALTER TABLE "public"."YillikTakvimBildirimKurali" ALTER COLUMN "aliciRoller" DROP DEFAULT;
ALTER TABLE "YillikTakvimKatilimci" ALTER COLUMN "rol" TYPE "YillikTakvimKatilimciRol_new" USING ("rol"::text::"YillikTakvimKatilimciRol_new");
ALTER TABLE "YillikTakvimBildirimKurali" ALTER COLUMN "aliciRoller" TYPE "YillikTakvimKatilimciRol_new"[] USING ("aliciRoller"::text::"YillikTakvimKatilimciRol_new"[]);
ALTER TYPE "YillikTakvimKatilimciRol" RENAME TO "YillikTakvimKatilimciRol_old";
ALTER TYPE "YillikTakvimKatilimciRol_new" RENAME TO "YillikTakvimKatilimciRol";
DROP TYPE "public"."YillikTakvimKatilimciRol_old";
ALTER TABLE "YillikTakvimBildirimKurali" ALTER COLUMN "aliciRoller" SET DEFAULT ARRAY[]::"YillikTakvimKatilimciRol"[];
COMMIT;

