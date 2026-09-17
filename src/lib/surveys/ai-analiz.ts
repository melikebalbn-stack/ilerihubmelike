/**
 * Yapay Zeka Kullanım Anketi analizi — SAF fonksiyon (test edilebilir).
 *
 * Kartları soru id'siyle DEĞİL, soru TİPİ + metin anahtarıyla (Türkçe normalize)
 * eşler; anket yeniden kurulup soru id'leri cuid olsa da kırılmaz. Eskiden
 * results/page.tsx içinde sabit "ai001".. eşleşmesi vardı; yeni ankette bütün
 * kartlar boş kalıyordu (kök sebep).
 */
export interface AIAnalizOption { id: string; optionText: string }
export interface AIAnalizAnswer { optionId: string | null; textAnswer: string | null }
export interface AIAnalizQuestion {
  questionText: string
  questionType: string
  options: AIAnalizOption[]
  answers: AIAnalizAnswer[]
}

export interface AIAnalizSonuc {
  totalResponses: number
  aiAdoptionRate: number
  activeUserRate: number
  aiToolsUsage: Record<string, number>
  frequencyDist: Record<string, number>
  purposeDist: Record<string, number>
  valueDist: Record<string, number>
  needsDist: Record<string, number>
  taskDescriptions: string[]
  strategicExamples: string[]
  potentialAreas: string[]
  avgBefore: number
  avgAfter: number
  avgTimeSavedPercent: number
  monthlyTimeSaved: number
  avgFrequency: number
}

const norm = (t: string) => (t || "").toLocaleLowerCase("tr-TR")

function secenekDagilimi(q: AIAnalizQuestion | undefined): Record<string, number> {
  const dist: Record<string, number> = {}
  if (!q) return dist
  for (const a of q.answers) {
    if (!a.optionId) continue
    const opt = q.options.find(o => o.id === a.optionId)
    if (opt) dist[opt.optionText] = (dist[opt.optionText] || 0) + 1
  }
  return dist
}

function serbestMetinler(q: AIAnalizQuestion | undefined): string[] {
  if (!q) return []
  return q.answers.map(a => a.textAnswer).filter((t): t is string => !!t && t.trim().length > 0)
}

function sayisal(q: AIAnalizQuestion | undefined): number[] {
  if (!q) return []
  const out: number[] = []
  for (const a of q.answers) {
    if (!a.textAnswer) continue
    const n = parseFloat(a.textAnswer.replace(/[^0-9.,]/g, "").replace(",", "."))
    if (!isNaN(n)) out.push(n)
  }
  return out
}

export function hesaplaAIAnaliz(questions: AIAnalizQuestion[], toplamKatilim: number): AIAnalizSonuc {
  const findQ = (types: string[], ...keys: string[]) =>
    questions.find(
      q => (types.length === 0 || types.includes(q.questionType)) &&
           keys.some(k => norm(q.questionText).includes(k)),
    )

  const aiToolsQuestion = findQ(["MULTIPLE_CHOICE"], "araç")
  const frequencyQuestion = findQ(["SINGLE_CHOICE", "DROPDOWN"], "sıklık")
  const purposeQuestion = findQ(["MULTIPLE_CHOICE"], "amaç")
  const valueQuestion = findQ(["MULTIPLE_CHOICE", "SINGLE_CHOICE"], "kazandığınız zaman", "nasıl değerlendir")
  const needsQuestion = findQ(["MULTIPLE_CHOICE"], "ihtiyac")
  const taskQ = findQ(["TEXT_LONG", "TEXT_SHORT"], "zaman kazandır")
  const stratQ = findQ(["TEXT_LONG"], "stratejik", "proje örne")
  const potentialQ = findQ(["TEXT_LONG"], "potansiyel", "kullanılabile", "eklemek istedik")
  // Sayısal öncesi/sonrası/frekans: yeniden kurulan ankette YOK; eşleşmezse 0.
  const beforeQ = findQ(["TEXT_SHORT", "SCALE"], "önce", "eski süre")
  const afterQ = findQ(["TEXT_SHORT", "SCALE"], "sonra", "yeni süre")
  const freqQ = findQ(["TEXT_SHORT", "SCALE"], "kaç kez", "haftalık tekrar")

  // Araçlar: "Hiçbirini kullanmıyorum" ayrı sayılır (AI kullanmayan).
  const aiToolsUsage: Record<string, number> = {}
  let noToolUsers = 0
  if (aiToolsQuestion) {
    for (const a of aiToolsQuestion.answers) {
      if (a.optionId) {
        const opt = aiToolsQuestion.options.find(o => o.id === a.optionId)
        if (opt) {
          if (norm(opt.optionText).includes("hiçbir")) noToolUsers++
          else aiToolsUsage[opt.optionText] = (aiToolsUsage[opt.optionText] || 0) + 1
        }
      }
      if (a.textAnswer) aiToolsUsage[a.textAnswer] = (aiToolsUsage[a.textAnswer] || 0) + 1
    }
  }

  const frequencyDist = secenekDagilimi(frequencyQuestion)
  const purposeDist = secenekDagilimi(purposeQuestion)
  const valueDist = secenekDagilimi(valueQuestion)
  const needsDist = secenekDagilimi(needsQuestion)

  const beforeTimes = sayisal(beforeQ)
  const afterTimes = sayisal(afterQ)
  const frequencies = sayisal(freqQ)

  let avgTimeSavedPercent = 0
  const validPairs = Math.min(beforeTimes.length, afterTimes.length)
  if (validPairs > 0) {
    let acc = 0
    for (let i = 0; i < validPairs; i++) if (beforeTimes[i] > 0) acc += ((beforeTimes[i] - afterTimes[i]) / beforeTimes[i]) * 100
    avgTimeSavedPercent = acc / validPairs
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
  const avgBefore = avg(beforeTimes), avgAfter = avg(afterTimes), avgFrequency = avg(frequencies)
  const monthlyTimeSaved = (avgBefore - avgAfter) * avgFrequency

  const aiUsers = toplamKatilim - noToolUsers
  const aiAdoptionRate = toplamKatilim > 0 ? Math.round((aiUsers / toplamKatilim) * 100) : 0

  // Aktif: "Günlük" + "Hafta..." içeren sıklık etiketleri (etiket "Haftalık" değil
  // "Haftada birkaç kez"; sabit eşleşme yerine normalize includes).
  let regularUsers = 0
  for (const [label, count] of Object.entries(frequencyDist)) {
    const nl = norm(label)
    if (nl.includes("günlük") || nl.includes("hafta")) regularUsers += count
  }
  const activeUserRate = toplamKatilim > 0 ? Math.round((regularUsers / toplamKatilim) * 100) : 0

  return {
    totalResponses: toplamKatilim,
    aiAdoptionRate,
    activeUserRate,
    aiToolsUsage,
    frequencyDist,
    purposeDist,
    valueDist,
    needsDist,
    taskDescriptions: serbestMetinler(taskQ),
    strategicExamples: serbestMetinler(stratQ),
    potentialAreas: serbestMetinler(potentialQ),
    avgBefore: Math.round(avgBefore * 10) / 10,
    avgAfter: Math.round(avgAfter * 10) / 10,
    avgTimeSavedPercent: Math.round(avgTimeSavedPercent),
    monthlyTimeSaved: Math.round(monthlyTimeSaved),
    avgFrequency: Math.round(avgFrequency * 10) / 10,
  }
}
