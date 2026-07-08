import { describe, it, expect } from "vitest";
import { validateTcKimlik } from "./tc-kimlik";

describe("validateTcKimlik", () => {
  it("algoritmaya uygun geçerli TC → true", () => {
    // Algoritmayı sağlayan örnekler (gerçek kişi değil).
    expect(validateTcKimlik("10000000146")).toBe(true);
    expect(validateTcKimlik("11111111110")).toBe(true);
  });

  it("ilk hane 0 → false", () => {
    expect(validateTcKimlik("01234567890")).toBe(false);
  });

  it("11 haneden farklı uzunluk → false", () => {
    expect(validateTcKimlik("1234567890")).toBe(false); // 10
    expect(validateTcKimlik("100000001460")).toBe(false); // 12
    expect(validateTcKimlik("")).toBe(false);
  });

  it("rakam olmayan karakter → false", () => {
    expect(validateTcKimlik("1000000014a")).toBe(false);
    expect(validateTcKimlik("abcdefghijk")).toBe(false);
  });

  it("10. hane checksum uyuşmazlığı → false", () => {
    // 10000000146 geçerli; 10. haneyi boz (4→5).
    expect(validateTcKimlik("10000000156")).toBe(false);
  });

  it("11. hane checksum uyuşmazlığı → false", () => {
    // 10000000146 geçerli; 11. haneyi boz (6→7).
    expect(validateTcKimlik("10000000147")).toBe(false);
  });
});
