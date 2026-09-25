import { describe, it, expect } from "vitest";
import {
  degerlendiriciAtamasiGecerliMi,
  AYNI_DEGERLENDIRICI_SEBEP,
  KENDINI_DEGERLENDIRME_SEBEP,
} from "./deneme-degismezler";

// Saf fonksiyon: DB/oturum yok, kurulum yok. Bu testin varlık sebebi, kuralın
// artık İKİ yerden (zincir kurulumu + İV yönlendirme ucu) çağrılıyor olması.
describe("degerlendiriciAtamasiGecerliMi", () => {
  const KISI = "p-degerlendirilen";

  it("iki farklı değerlendirici geçerlidir", () => {
    expect(
      degerlendiriciAtamasiGecerliMi({ personnelId: KISI, degerlendirici1Id: "a", degerlendirici2Id: "b" }),
    ).toEqual({ ok: true });
  });

  it("tek puanlı yakada 2. değerlendirici null olabilir", () => {
    expect(
      degerlendiriciAtamasiGecerliMi({ personnelId: KISI, degerlendirici1Id: "a", degerlendirici2Id: null }),
    ).toEqual({ ok: true });
  });

  it("1. ve 2. değerlendirici aynı kişi olamaz", () => {
    // 25.09.2026 vakası: yönlendirme hedefi zaten 2. değerlendiriciydi.
    expect(
      degerlendiriciAtamasiGecerliMi({ personnelId: KISI, degerlendirici1Id: "a", degerlendirici2Id: "a" }),
    ).toEqual({ ok: false, sebep: AYNI_DEGERLENDIRICI_SEBEP });
  });

  it("iki null aynı sayılmaz — tek puanlı yaka engellenmez", () => {
    expect(
      degerlendiriciAtamasiGecerliMi({ personnelId: KISI, degerlendirici1Id: null, degerlendirici2Id: null }),
    ).toEqual({ ok: true });
  });

  it("değerlendirici, değerlendirilen kişinin kendisi olamaz (1. sıra)", () => {
    expect(
      degerlendiriciAtamasiGecerliMi({ personnelId: KISI, degerlendirici1Id: KISI, degerlendirici2Id: "b" }),
    ).toEqual({ ok: false, sebep: KENDINI_DEGERLENDIRME_SEBEP });
  });

  it("değerlendirici, değerlendirilen kişinin kendisi olamaz (2. sıra)", () => {
    expect(
      degerlendiriciAtamasiGecerliMi({ personnelId: KISI, degerlendirici1Id: "a", degerlendirici2Id: KISI }),
    ).toEqual({ ok: false, sebep: KENDINI_DEGERLENDIRME_SEBEP });
  });

  it("aynı kişi kuralı, kendini değerlendirme kuralından ÖNCE döner", () => {
    // İkisi birden ihlal edildiğinde mesaj belirleyici olsun (zincir çözücüsünün
    // İV'ye ilettiği sebep metni sabit kalır).
    expect(
      degerlendiriciAtamasiGecerliMi({ personnelId: KISI, degerlendirici1Id: KISI, degerlendirici2Id: KISI }),
    ).toEqual({ ok: false, sebep: AYNI_DEGERLENDIRICI_SEBEP });
  });
});
