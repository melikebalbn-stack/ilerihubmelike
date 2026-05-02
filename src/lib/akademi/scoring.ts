import { QuestionType } from '@/generated/prisma';
import { AUTO_SCORED_TYPES as SHARED_AUTO_SCORED_TYPES } from './question-types';

export type QuestionInput = {
  id: string;
  type: QuestionType;
  points: number;
  options: Array<{ id: string; isCorrect: boolean }>;
};

export type AnswerInput = {
  questionId: string;
  selectedOptionIds: string[];
  textAnswer?: string;
  ratingValue?: number;
  scaleValue?: number;
  dateValue?: Date | string;
  fileUrl?: string;
  matrixAnswer?: Record<string, string>;
};

export type QuestionResult = {
  questionId: string;
  earnedPoints: number;
  maxPoints: number;
  isCorrect: boolean;
  isAutoScored: boolean;
  selectedOptionIds: string[];
  correctOptionIds: string[];
};

export type ExamScoreResult = {
  totalEarned: number;
  totalMax: number;
  autoMax: number;
  manualMax: number;
  percentage: number;
  passed: boolean | null;
  hasManualQuestions: boolean;
  questions: QuestionResult[];
};

// Auto-scored tipler artık src/lib/akademi/question-types.ts merkezinden geliyor.
// Sprint 3 PR-2: DROPDOWN da otomatik puanlanır (SINGLE_CHOICE davranışı).

export function isAutoScoredType(type: QuestionType): boolean {
  return SHARED_AUTO_SCORED_TYPES.includes(type);
}

export function scoreQuestion(
  question: QuestionInput,
  answer: AnswerInput | undefined,
): QuestionResult {
  const correctOptionIds = question.options.filter(o => o.isCorrect).map(o => o.id);
  const selectedOptionIds = answer?.selectedOptionIds ?? [];

  if (!isAutoScoredType(question.type)) {
    return {
      questionId: question.id,
      earnedPoints: 0,
      maxPoints: question.points,
      isCorrect: false,
      isAutoScored: false,
      selectedOptionIds,
      correctOptionIds,
    };
  }

  if (selectedOptionIds.length === 0) {
    return {
      questionId: question.id,
      earnedPoints: 0,
      maxPoints: question.points,
      isCorrect: false,
      isAutoScored: true,
      selectedOptionIds,
      correctOptionIds,
    };
  }

  switch (question.type) {
    case QuestionType.SINGLE_CHOICE:
    case QuestionType.TRUE_FALSE:
    case QuestionType.DROPDOWN: {
      const selected = selectedOptionIds[0];
      const isCorrect = correctOptionIds.includes(selected) && selectedOptionIds.length === 1;
      return {
        questionId: question.id,
        earnedPoints: isCorrect ? question.points : 0,
        maxPoints: question.points,
        isCorrect,
        isAutoScored: true,
        selectedOptionIds,
        correctOptionIds,
      };
    }

    case QuestionType.MULTIPLE_CHOICE: {
      const correctSet = new Set(correctOptionIds);
      let correctlySelected = 0;
      let incorrectlySelected = 0;
      for (const id of selectedOptionIds) {
        if (correctSet.has(id)) correctlySelected++;
        else incorrectlySelected++;
      }
      const totalCorrect = correctOptionIds.length;
      if (totalCorrect === 0) {
        return {
          questionId: question.id,
          earnedPoints: 0,
          maxPoints: question.points,
          isCorrect: false,
          isAutoScored: true,
          selectedOptionIds,
          correctOptionIds,
        };
      }
      const ratio = (correctlySelected - incorrectlySelected) / totalCorrect;
      const clampedRatio = Math.max(0, Math.min(1, ratio));
      const earnedPoints = clampedRatio * question.points;
      const isFullyCorrect = correctlySelected === totalCorrect && incorrectlySelected === 0;
      return {
        questionId: question.id,
        earnedPoints,
        maxPoints: question.points,
        isCorrect: isFullyCorrect,
        isAutoScored: true,
        selectedOptionIds,
        correctOptionIds,
      };
    }

    default:
      return {
        questionId: question.id,
        earnedPoints: 0,
        maxPoints: question.points,
        isCorrect: false,
        isAutoScored: false,
        selectedOptionIds,
        correctOptionIds,
      };
  }
}

export function scoreExam(
  questions: QuestionInput[],
  answers: AnswerInput[],
  passingScorePercent: number,
): ExamScoreResult {
  const answerMap = new Map(answers.map(a => [a.questionId, a]));
  const results = questions.map(q => scoreQuestion(q, answerMap.get(q.id)));

  const totalEarned = results.reduce((sum, r) => sum + r.earnedPoints, 0);
  const totalMax = results.reduce((sum, r) => sum + r.maxPoints, 0);
  const autoMax = results.filter(r => r.isAutoScored).reduce((sum, r) => sum + r.maxPoints, 0);
  const manualMax = totalMax - autoMax;
  const hasManualQuestions = results.some(r => !r.isAutoScored);

  const percentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
  const passed = hasManualQuestions ? null : percentage >= passingScorePercent;

  return {
    totalEarned: Math.round(totalEarned * 100) / 100,
    totalMax,
    autoMax,
    manualMax,
    percentage,
    passed,
    hasManualQuestions,
    questions: results,
  };
}

export type GradedAnswer = {
  questionId: string;
  earnedPoints: number;
  maxPoints: number;
};

export function computeFinalScore(
  graded: GradedAnswer[],
  passingScorePercent: number,
): { totalEarned: number; totalMax: number; percentage: number; passed: boolean } {
  const totalEarned = graded.reduce((sum, g) => sum + g.earnedPoints, 0);
  const totalMax = graded.reduce((sum, g) => sum + g.maxPoints, 0);
  const percentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
  return {
    totalEarned: Math.round(totalEarned * 100) / 100,
    totalMax,
    percentage,
    passed: percentage >= passingScorePercent,
  };
}
