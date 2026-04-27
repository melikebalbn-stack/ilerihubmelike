export interface AdminPackageListItem {
  id: string;
  name: string;
  description: string | null;
  iconColor: string | null;
  isActive: boolean;
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
}

export interface AdminPackageUsersAddInput {
  userIds: string[];
}

export interface BolumWithCount {
  bolum: string;
  userCount: number;
}
