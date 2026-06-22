/**
 * Akademi modülü — Frontend/API ortak tip tanımları.
 * Prisma tipleri doğrudan kullanılmaz — API response shape'i tasarlanmış:
 * flat structure, derived fields (progressPercent, isCompleted, contentCount).
 */

export type CourseDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type ContentType = "VIDEO" | "PDF" | "DOCUMENT" | "QUIZ" | "GOREV";

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

/** IFS-4: GOREV içeriklerinde dolu olan görev meta verisi (kullanıcı görünümü). */
export interface IfsTaskMetaView {
  modul: string | null;
  altModul: string | null;
  ifsEkran: string | null;
  refDocUrl: string | null;
  refVideoUrl: string | null;
}

/** Kurs içeriği — video / PDF / document / quiz / görev. */
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
  // IFS: kursiyerin "Örnek Yaptım" açıklaması (varsa) — modal prefill için.
  ornekAciklama?: string | null;
  // IFS-4: yalnız type=GOREV içeriklerde dolu.
  ifsMeta?: IfsTaskMetaView | null;
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
