// Paket-seviyesi referans PDF (IFS paket detayında alan kartlarının üstünde gösterilir).
export interface PackageReferenceDocItem {
  id: string;
  title: string;
  fileUrl: string;
  sortOrder: number;
}

// Form/payload'da gönderilen referans doküman (id yok — replace-all reconcile).
export interface PackageReferenceDocInput {
  title: string;
  fileUrl: string;
  sortOrder: number;
}

export interface AdminPackageListItem {
  id: string;
  name: string;
  description: string | null;
  iconColor: string | null;
  coverImageUrl: string | null;
  isActive: boolean;
  isIfs: boolean;
  courseCount: number;
  bolumCount: number;
  userAssignmentCount: number;
  referenceDocs: PackageReferenceDocItem[];
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
  coverImageUrl?: string | null;
  isActive?: boolean;
  referenceDocs?: PackageReferenceDocInput[];
}

export interface AdminPackageUpdateInput {
  name?: string;
  description?: string | null;
  iconColor?: string | null;
  coverImageUrl?: string | null;
  isActive?: boolean;
  // Verildiğinde tüm referans dokümanlar bu liste ile değiştirilir (replace-all).
  // undefined ise dokümanlara dokunulmaz (örn. yalnız isActive toggle).
  referenceDocs?: PackageReferenceDocInput[];
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
  coverImageUrl: string | null;
  isActive: boolean;
  referenceDocs: PackageReferenceDocInput[];
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
