import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

/**
 * Session → DB User.id resolution.
 *
 * ILERIHub'ın LDAP provider'ı `session.user.id`'ye Distinguished Name
 * değerini atıyor (örn. "CN=Melih Dilben,OU=..."), bu DB'deki
 * User.id ile eşleşmiyor.
 *
 * Email üzerinden lookup yapıp gerçek User.id'yi döndürür.
 * User.email @unique olduğu için güvenli.
 */
export async function resolveAkademiUserId(
  session: Session | null
): Promise<string | null> {
  const email = session?.user?.email;
  if (!email) return null;

  // Case-insensitive: LDAP session email casing'i DB casing'inden farklı olabilir
  // (Postgres karşılaştırması case-sensitive) → insensitive eşleşme ile blok önlenir.
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });

  return user?.id ?? null;
}
