// Mavi yaka SENTETİK e-posta adresi — TEK KAYNAK.
//
// AD hesabı olmayan mavi yakalar için `bluecollar-users` ucu giriş kimliği olarak
// `<sicil>@bluecollar.ilerigroup.com` üretir. Bu adres bir POSTA KUTUSU DEĞİLDİR;
// oraya gönderilen mail teslim edilmez. Bildirim gönderen modüller bu adresi
// tanıyıp mail adımını atlamalı (in-app bildirim yine oluşturulur).
//
// Kalıp buraya toplandı: üreten (bluecollar-users) ve tüketen (deneme-bildirim)
// aynı sabiti kullanır, iki yerde ayrı string tutulmaz.

export const BLUECOLLAR_EMAIL_DOMAIN = "bluecollar.ilerigroup.com";

/** `<sicil>@bluecollar.ilerigroup.com` üretir (lowercase normalize çağıranda). */
export function bluecollarEmailUret(employeeId: string | number): string {
  return `${employeeId}@${BLUECOLLAR_EMAIL_DOMAIN}`;
}

/** Adres sentetik mi — yani gerçek posta kutusu DEĞİL mi. */
export function sentetikMailMi(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${BLUECOLLAR_EMAIL_DOMAIN}`);
}
