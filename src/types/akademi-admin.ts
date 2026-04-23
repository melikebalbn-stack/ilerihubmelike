export type CourseDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface AdminCourseListItem {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  category: string | null;
  difficulty: CourseDifficulty;
  duration: number | null;
  isActive: boolean;
  contentCount: number;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCourseCreateInput {
  title: string;
  description?: string;
  thumbnail?: string | null;
  category?: string | null;
  difficulty: CourseDifficulty;
  duration?: number | null;
  isActive?: boolean;
}

export type AdminCourseUpdateInput = Partial<AdminCourseCreateInput>;

export interface AdminCourseListResponse {
  courses: AdminCourseListItem[];
}

export interface AdminCategoriesResponse {
  categories: string[];
}

// =========================================================
// Assignment types
// =========================================================

export interface AdminAssignmentListItem {
  userAssignmentId: string;
  assignmentId: string;
  courseId: string;
  courseTitle: string;
  courseIsActive: boolean;
  userId: string;
  userName: string;
  userEmail: string;
  userDepartment: string | null;
  assignedAt: string;
  dueDate: string | null;
  progressPercent: number;
  isCompleted: boolean;
}

export interface AdminAssignmentCreateInput {
  courseId: string;
  userIds: string[];
  dueDate?: string | null;
}

export interface AdminAssignmentListResponse {
  assignments: AdminAssignmentListItem[];
}

export interface AdminAssignmentCreateResponse {
  createdCount: number;
  skippedCount: number;
  message: string;
}

// =========================================================
// User list types
// =========================================================

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  totalXp: number;
  level: number;
  assignmentCount: number;
  completedCount: number;
  completionRate: number;
}

export interface AdminUserListResponse {
  users: AdminUserListItem[];
}

// =========================================================
// User detail types
// =========================================================

export interface AdminUserCourseProgress {
  assignmentId: string;
  courseId: string;
  courseTitle: string;
  courseIsActive: boolean;
  assignedAt: string;
  dueDate: string | null;
  progressPercent: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface AdminUserXpHistoryItem {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface AdminUserProgressResponse {
  user: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    jobTitle: string | null;
  };
  totalXp: number;
  level: number;
  levelTitle: string;
  courses: AdminUserCourseProgress[];
  recentHistory: AdminUserXpHistoryItem[];
}

// =========================================================
// Content types (admin side)
// =========================================================

export type AdminContentType = "VIDEO" | "PDF" | "DOCUMENT" | "QUIZ";

export interface AdminContentItem {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  type: AdminContentType;
  filePath: string | null;
  fileUrl: string | null;
  duration: number | null;
  fileSize: number | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminContentListResponse {
  contents: AdminContentItem[];
}

export interface AdminContentCreateInput {
  courseId: string;
  title: string;
  description?: string;
  type: AdminContentType;
  duration?: number | null;
  filePath?: string | null;
  fileSize?: number | null;
}

export type AdminContentUpdateInput = Partial<
  Omit<AdminContentCreateInput, "courseId">
> & {
  order?: number;
  isActive?: boolean;
};

export interface AdminUploadResponse {
  filePath: string;
  fileSize: number;
  message: string;
}
