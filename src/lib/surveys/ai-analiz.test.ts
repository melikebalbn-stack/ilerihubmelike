import { describe, it, expect } from "vitest"
import { hesaplaAIAnaliz, type AIAnalizQuestion } from "./ai-analiz"

// Gerçek ANK-2026-002 yapısını taklit eden fixture (cuid id'ler — sabit ai001.. YOK).
function opt(id: string, text: string) { return { id, optionText: text } }
function mkAns(optionId: string | null, textAnswer: string | null = null) { return { optionId, textAnswer } }

// 13 katılımcı: araç (MC), sıklık (SC), amaç (MC), değer (MC), ihtiyaç (MC), görev (TEXT_LONG)
const araclar = {
  questionText: "Hangi yapay zekâ araçlarını kullanıyorsunuz?", questionType: "MULTIPLE_CHOICE",
  options: [opt("t1", "ChatGPT"), opt("t2", "Claude"), opt("tH", "Hiçbirini kullanmıyorum")],
  answers: [
    // 12 kişi ChatGPT, 5 kişi Claude, 1 kişi hiçbiri → aiUsers = 13 - 1 = 12
    ...Array.from({ length: 12 }, () => mkAns("t1")),
    ...Array.from({ length: 5 }, () => mkAns("t2")),
    mkAns("tH"),
  ],
} as AIAnalizQuestion
const siklik = {
  questionText: "Ne sıklıkla kullanıyorsunuz?", questionType: "SINGLE_CHOICE",
  options: [opt("f1", "Günlük"), opt("f2", "Haftada birkaç kez"), opt("f3", "Çok nadir"), opt("f4", "Hiç kullanmıyorum")],
  answers: [
    ...Array.from({ length: 6 }, () => mkAns("f1")),  // 6 günlük
    ...Array.from({ length: 4 }, () => mkAns("f2")),  // 4 haftada birkaç → aktif = 10
    ...Array.from({ length: 2 }, () => mkAns("f3")),
    mkAns("f4"),
  ],
} as AIAnalizQuestion
const amac = {
  questionText: "Hangi amaçlarla kullanıyorsunuz?", questionType: "MULTIPLE_CHOICE",
  options: [opt("a1", "Rapor yazma"), opt("a2", "Kod")],
  answers: [...Array.from({ length: 8 }, () => mkAns("a1")), ...Array.from({ length: 3 }, () => mkAns("a2"))],
} as AIAnalizQuestion
const gorev = {
  questionText: "Yapay zekânın en çok zaman kazandırdığı bir görevi kısaca yazın", questionType: "TEXT_LONG",
  options: [], answers: [mkAns(null, "Rapor taslağı"), mkAns(null, "E-posta"), mkAns(null, "  ")],
} as AIAnalizQuestion
const bolum = {
  questionText: "Hangi bölümde çalışıyorsunuz?", questionType: "DROPDOWN",
  options: [opt("b1", "Kalite")], answers: Array.from({ length: 13 }, () => mkAns("b1")),
} as AIAnalizQuestion

describe("hesaplaAIAnaliz — cuid id'li anket (sabit ai id YOK)", () => {
  const r = hesaplaAIAnaliz([bolum, araclar, siklik, amac, gorev], 13)

  it("araç dağılımı doldu (ChatGPT 12, Claude 5), 'Hiçbiri' hariç", () => {
    expect(r.aiToolsUsage["ChatGPT"]).toBe(12)
    expect(r.aiToolsUsage["Claude"]).toBe(5)
    expect(r.aiToolsUsage["Hiçbirini kullanmıyorum"]).toBeUndefined()
  })
  it("AI kullanım oranı = (13-1)/13 = %92", () => {
    expect(r.aiAdoptionRate).toBe(Math.round((12 / 13) * 100))
  })
  it("aktif kullanıcı = Günlük(6)+Haftada birkaç(4)=10/13 → %77 (Haftalık etiketi olmasa da)", () => {
    expect(r.activeUserRate).toBe(Math.round((10 / 13) * 100))
  })
  it("sıklık dağılımı gerçek etiketlerle doldu", () => {
    expect(r.frequencyDist["Günlük"]).toBe(6)
    expect(r.frequencyDist["Haftada birkaç kez"]).toBe(4)
  })
  it("amaç dağılımı doldu", () => {
    expect(r.purposeDist["Rapor yazma"]).toBe(8)
    expect(r.purposeDist["Kod"]).toBe(3)
  })
  it("görev serbest metinleri (boş olan elenir)", () => {
    expect(r.taskDescriptions).toEqual(["Rapor taslağı", "E-posta"])
  })
  it("sayısal öncesi/sonrası soru YOK → Zaman Tasarrufu %0 (kırılmaz)", () => {
    expect(r.avgTimeSavedPercent).toBe(0)
    expect(r.avgBefore).toBe(0)
  })
  it("totalResponses = katılım sayısı", () => {
    expect(r.totalResponses).toBe(13)
  })
})

describe("hesaplaAIAnaliz — soru yoksa boş, çökme yok", () => {
  it("boş sorularda tüm dağılımlar boş, oranlar 0", () => {
    const r = hesaplaAIAnaliz([], 0)
    expect(r.aiToolsUsage).toEqual({})
    expect(r.aiAdoptionRate).toBe(0)
    expect(r.activeUserRate).toBe(0)
  })
})
