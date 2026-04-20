/**
 * Akademi modülü — Frontend/API ortak tip tanımları.
 * Prisma tipleri doğrudan kullanılmaz — API response shape'i tasarlanmış:
 * flat structure, derived fields (progressPercent, isCompleted, contentCount).
 */

export type CourseDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type ContentType = "VIDEO" | "PDF" | "DOCUMENT" | "QUIZ";

/** Kurs liste görünümü (dashboard + /akademi/courses). */
export interface CourseListItem {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  category: string | null;
  difficulty: CourseDifficulty;
  duration: number | null;       // dakika
  contentCount: number;
  progressPercent: number;       // 0-100
  isCompleted: boolean;
  isAssigned: boolean;
}

/** Kurs detay sayfası — içerikler dahil. */
export interface CourseDetail extends CourseListItem {
  contents: ContentItem[];
}

/** Kurs içeriği — video / PDF / document / quiz. */
export interface ContentItem {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  type: ContentType;
  filePath: string | null;
  fileUrl: string | null;
  duration: number | null;
  order: number;
  completedByCurrentUser: boolean;
}

/** Leaderboard satırı. */
export interface LeaderboardEntry {
  userId: string;
  rank: number;
  name: string;
  avatarInitials: string;
  department: string | null;
  xp: number;
  level: number;
  levelTitle: string | null;
  streakDays: number;
  isCurrentUser: boolean;
}

/** Leaderboard endpoint response. */
export interface LeaderboardResponse {
  top: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
}

/** XP özeti (dashboard + profile). */
export interface XpSummary {
  xp: number;
  level: number;
  levelTitle: string;
  nextLevelAt: number | null;    // minXp of level+1, null if max
  streakDays: number;
  recentHistory: XpHistoryItem[];
}

export interface XpHistoryItem {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;              // ISO
}

/** Progress mark endpoint response. */
export interface ProgressMarkResponse {
  success: boolean;
  percentage: number;
  isCompleted: boolean;
  xpGranted: number;              // 0 if already completed
}
