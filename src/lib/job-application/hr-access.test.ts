import { describe, it, expect } from "vitest";
import { canViewJobAppSensitive, maskTc, VIEW_ROLES } from "./hr-access";

describe("canViewJobAppSensitive (rol-gate)", () => {
  it("VIEW_ROLES içindekiler → true", () => {
    for (const r of VIEW_ROLES) expect(canViewJobAppSensitive(r)).toBe(true);
  });
  it("VIEW_ROLES dışı (EMPLOYEE dahil) → false", () => {
    expect(canViewJobAppSensitive("EMPLOYEE")).toBe(false);
    expect(canViewJobAppSensitive("RECRUITER")).toBe(false);
    expect(canViewJobAppSensitive(null)).toBe(false);
    expect(canViewJobAppSensitive(undefined)).toBe(false);
    expect(canViewJobAppSensitive("")).toBe(false);
  });
});

describe("maskTc", () => {
  it("11 haneli TC → ilk3 + **** + son3", () => {
    expect(maskTc("12345678901")).toBe("123****901");
  });
  it("kısa değer → ***", () => {
    expect(maskTc("123")).toBe("***");
    expect(maskTc("123456")).toBe("***");
  });
  it("null/undefined → null", () => {
    expect(maskTc(null)).toBeNull();
    expect(maskTc(undefined)).toBeNull();
  });
});
