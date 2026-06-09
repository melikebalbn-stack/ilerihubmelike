export interface AdminPackageListItem {
  id: string;
  name: string;
  description: string | null;
  iconColor: string | null;
  isActive: boolean;
  isIfs: boolean;
  courseCount: number;
  bolumCount: number;
  userAssignmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPackageDetail extends AdminPackageListItem {
  courses: Array<{
    id: string;
    courseId: string;
    courseTitle: string;
    courseDifficulty: string;
    order: number;
    isRequired: boolean;
  }>;
  bolums: Array<{
    id: string;
    bolum: string;
    createdAt: string;
    dueDate: string | null;
  }>;
  userAssignments: Array<{
    id: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    assignedAt: string;
  }>;
}

export interface AdminPackageCreateInput {
  name: string;
  description?: string;
  iconColor?: string;
  isActive?: boolean;
}

export interface AdminPackageUpdateInput {
  name?: string;
  description?: string | null;
  iconColor?: string | null;
  isActive?: boolean;
}

export interface AdminPackageCoursesUpdateInput {
  courses: Array<{
    courseId: string;
    order: number;
    isRequired?: boolean;
  }>;
}

export interface AdminPackageBolumsUpdateInput {
  bolums: string[];
  // Seçili tüm bölümlere uygulanan tek son tarih (opsiyonel). Boş/null = süresiz.
  dueDate?: string | null;
}

export interface AdminPackageUsersAddInput {
  userIds: string[];
}

export interface BolumWithCount {
  bolum: string;
  userCount: number;
}

export interface PackageFormState {
  name: string;
  description: string;
  iconColor: string;
  isActive: boolean;
}

export interface PackageCourseFormItem {
  courseId: string;
  courseTitle: string;
  order: number;
  isRequired: boolean;
}

export interface CourseListItem {
  id: string;
  title: string;
  difficulty: string;
  isActive: boolean;
}
