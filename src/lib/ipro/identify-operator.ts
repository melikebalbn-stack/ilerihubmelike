import { prisma } from "@/lib/prisma";
import { IproAuthMethod } from "@/generated/prisma";
import { isAuthMethodEnabled } from "./auth-methods";

export type IdentifyInput =
  | { method: "LIST"; personnelId: string; tezgahId: string }
  | { method: "CARD"; cardUid: string; tezgahId: string };

export type IdentifiedOperator = {
  personnelId: string;
  sicilNo: string; // IFS EmployeeId — runtime kullanim (TeamEmployee); DB'ye snapshot YAZILMAZ
};

export class OperatorIdentifyError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "OperatorIdentifyError";
  }
}

export async function identifyOperator(input: IdentifyInput): Promise<IdentifiedOperator> {
  if (!isAuthMethodEnabled(input.method as IproAuthMethod)) {
    throw new OperatorIdentifyError("METHOD_NOT_ENABLED", `Giris yontemi kapali: ${input.method}`);
  }

  if (input.method === "CARD") {
    // C fazi. Kart->sicil eslemesi henuz yok (RFID formati bilinmiyor).
    throw new OperatorIdentifyError("METHOD_NOT_ENABLED", "Kartli giris henuz aktif degil");
  }

  // LIST
  const personnel = await prisma.personnel.findUnique({
    where: { id: input.personnelId },
    select: { id: true, sicilNo: true, aktif: true },
  });

  if (!personnel) {
    throw new OperatorIdentifyError("NOT_FOUND", "Personel bulunamadi");
  }
  // Ayrilmis personel operator ekraninda olu isim uretir (bkz. import-operator-tezgah.ts).
  if (!personnel.aktif) {
    throw new OperatorIdentifyError("INACTIVE", "Personel pasif");
  }
  if (!personnel.sicilNo) {
    throw new OperatorIdentifyError("NO_SICIL", "Personelin sicil numarasi yok (IFS EmployeeId eksik)");
  }

  // SEAM 2 — tezgah yetki kontrolu (IproOperatorTezgah): IPRO ayarlarinda yetki modeli
  // netlesince eklenecek. Bilincli olarak su an gate DEGIL.

  return { personnelId: personnel.id, sicilNo: personnel.sicilNo };
}
