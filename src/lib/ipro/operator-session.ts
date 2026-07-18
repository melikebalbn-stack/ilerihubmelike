import { prisma } from "@/lib/prisma";
import { IproAuthMethod } from "@/generated/prisma";
import { identifyOperator, type IdentifyInput } from "./identify-operator";

// Oturum ac. Idempotent + yaris-guvenli:
// ayni (operator, tezgah) ACTIVE ise yeni kayit acmaz, mevcudu dondurur.
export async function openSession(input: IdentifyInput) {
  const { personnelId } = await identifyOperator(input);
  const tezgahId = input.tezgahId;

  try {
    return await prisma.iproOperatorSession.create({
      data: { personnelId, tezgahId, authMethod: input.method as IproAuthMethod },
    });
  } catch (err) {
    // INSERT reddedildi. Partial unique index reddettiyse mevcut ACTIVE vardir.
    // Hata koduna bagli degil: mevcut ACTIVE varsa onu dondur, yoksa hatayi firlat.
    const existing = await prisma.iproOperatorSession.findFirst({
      where: { personnelId, tezgahId, cikisAt: null },
    });
    if (existing) return existing;
    throw err;
  }
}

// Oturum kapat. Yalniz ACTIVE satirda cikisAt = now().
// Donus: 1 = kapatildi, 0 = zaten kapali / bulunamadi.
export async function closeSession(sessionId: string): Promise<number> {
  const res = await prisma.iproOperatorSession.updateMany({
    where: { id: sessionId, cikisAt: null },
    data: { cikisAt: new Date() },
  });
  return res.count;
}
