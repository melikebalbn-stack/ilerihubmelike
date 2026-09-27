// @vitest-environment node
import { describe, it, expect } from "vitest";
import { viewCountDelta } from "./view-count";

describe("viewCountDelta — tekil görüntülenme", () => {
  it("ilk kayıt +1, mevcut kayıt +0", () => {
    expect(viewCountDelta(false)).toBe(1);
    expect(viewCountDelta(true)).toBe(0);
  });

  it("goruldu iki kez çağrılınca sayaç 1 kalır", () => {
    let viewCount = 0;
    let hasRead = false; // AnnouncementRead unique kaydı henüz yok

    // 1. çağrı (goruldu): kayıt yok → +1, sonra kayıt oluşur
    viewCount += viewCountDelta(hasRead);
    hasRead = true;

    // 2. çağrı (goruldu, aynı kişi): kayıt var → +0
    viewCount += viewCountDelta(hasRead);

    expect(viewCount).toBe(1);
  });

  it("aynı kişi görüldü sonra onay → yine 1 (tek tekil okuyucu)", () => {
    let viewCount = 0;
    let hasRead = false;
    viewCount += viewCountDelta(hasRead); // goruldu: +1
    hasRead = true;
    viewCount += viewCountDelta(hasRead); // acknowledge (kayıt var): +0
    expect(viewCount).toBe(1);
  });
});
