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
