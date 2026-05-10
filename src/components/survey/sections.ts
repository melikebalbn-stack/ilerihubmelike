// PR-SURVEY-UI-REFACTOR: Soru listesini bölümlere ayır.
//
// 1) Eğer questionText "A. BAŞLIK - 1. ..." prefix'i içeriyorsa,
//    aynı harfle başlayan sorular bir bölümde toplanır (data-driven).
// 2) Aksi halde QUESTIONS_PER_SECTION ile mekanik chunk.
//
// İleride Survey schema'sına SurveySection modeli eklenirse bu helper
// kaldırılır; şimdilik mevcut veriyle doğal bölümleme.

export interface SurveyQuestionLite {
  id: string
  questionText: string
  questionType: string
  sortOrder: number
  isRequired: boolean
  options: Array<{ id: string; optionText: string; sortOrder: number }>
}

export interface SurveySection {
  title: string
  questions: SurveyQuestionLite[]
}

const QUESTIONS_PER_SECTION = 4
const SECTION_PREFIX_RE = /^([A-ZĞÜŞİÖÇ])\.\s+([^-\n]+?)\s*-\s*\d+\.\s*/i

/** Bir soru metnindeki "A. BAŞLIK - N. " prefix'ini soyutlanmış metinle döndürür. */
export function stripQuestionPrefix(text: string): string {
  return text.replace(SECTION_PREFIX_RE, '').trim()
}

/** Soru metninden bölüm harfi + başlığı çıkarır (eşleşmezse null). */
function extractSectionMeta(text: string): { letter: string; title: string } | null {
  const m = text.match(SECTION_PREFIX_RE)
  if (!m) return null
  return { letter: m[1].toUpperCase(), title: m[2].trim() }
}

export function chunkQuestionsBySections(questions: SurveyQuestionLite[]): SurveySection[] {
  if (!questions.length) return []

  const sorted = [...questions].sort((a, b) => a.sortOrder - b.sortOrder)

  // Strateji 1: prefix-based gruplama (data-driven)
  const groups = new Map<string, { title: string; questions: SurveyQuestionLite[] }>()
  let allHavePrefix = true
  for (const q of sorted) {
    const meta = extractSectionMeta(q.questionText)
    if (!meta) {
      allHavePrefix = false
      break
    }
    const existing = groups.get(meta.letter)
    if (existing) {
      existing.questions.push(q)
    } else {
      groups.set(meta.letter, { title: meta.title, questions: [q] })
    }
  }

  if (allHavePrefix && groups.size >= 2) {
    return Array.from(groups.values()).map((g) => ({
      title: g.title,
      questions: g.questions,
    }))
  }

  // Strateji 2: mekanik chunk (fallback)
  const sections: SurveySection[] = []
  for (let i = 0; i < sorted.length; i += QUESTIONS_PER_SECTION) {
    sections.push({
      title: `Bölüm ${sections.length + 1}`,
      questions: sorted.slice(i, i + QUESTIONS_PER_SECTION),
    })
  }
  return sections
}
