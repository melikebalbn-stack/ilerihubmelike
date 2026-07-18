import { IproAuthMethod } from "@/generated/prisma";

// Aktif giris yontemleri. Default: sadece LIST.
// CARD ileride (RFID formati elde gorulunce) eklenecek.
// Env override ornek: IPRO_AUTH_METHODS="LIST,CARD"
const DEFAULT_METHODS: IproAuthMethod[] = [IproAuthMethod.LIST];

export function enabledAuthMethods(): IproAuthMethod[] {
  const raw = process.env.IPRO_AUTH_METHODS?.trim();
  if (!raw) return DEFAULT_METHODS;
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is IproAuthMethod => s in IproAuthMethod);
  return parsed.length ? parsed : DEFAULT_METHODS;
}

export function isAuthMethodEnabled(m: IproAuthMethod): boolean {
  return enabledAuthMethods().includes(m);
}
