// PR-3: Departman panosu saf aggregation çekirdeği.
// Route bu fonksiyona DB sonuçlarını (düzleştirilmiş) verir; burada hiç DB
// erişimi yoktur — böylece bağımsız test edilebilir ve route ince kalır.

export type DeptBoardStatus =
  | "completed"
  | "overdue"
  | "in_progress"
  | "not_started";

export interface DeptBoardUserInput {
  id: string;
  name: string | null;
  email: string | null;
}

export interface DeptBoardAssignment {
  userId: string;
  courseId: string;
  dueDate: Date | null;
}

export interface DeptBoardProgress {
  userId: string;
  courseId: string;
  percentage: number;
  completedAt: Date | null;
}

export interface DeptBoardRow {
  userId: string;
  name: string;
  assigned: number;
  completed: number;
  percent: number;
  nearestDueDate: string | null;
  overdueCount: number;
  status: DeptBoardStatus;
}

export interface DeptBoardSummary {
  totalUsers: number;
  totalAssignments: number;
  completed: number;
  inProgress: number;
  overdue: number;
  completionPct: number;
}

const RANK: Record<DeptBoardStatus, number> = {
  overdue: 0,
  in_progress: 1,
  not_started: 2,
  completed: 3,
};

export function buildDepartmentBoard(
  users: DeptBoardUserInput[],
  assignments: DeptBoardAssignment[],
  progresses: DeptBoardProgress[],
  now: Date
): { summary: DeptBoardSummary; users: DeptBoardRow[] } {
  const progMap = new Map<
    string,
    { percentage: number; completedAt: Date | null }
  >();
  for (const p of progresses) {
    progMap.set(`${p.userId}:${p.courseId}`, {
      percentage: p.percentage,
      completedAt: p.completedAt,
    });
  }

  const byUser = new Map<string, DeptBoardAssignment[]>();
  for (const a of assignments) {
    const list = byUser.get(a.userId) ?? [];
    list.push(a);
    byUser.set(a.userId, list);
  }

  let sumAssigned = 0;
  let sumCompleted = 0;
  let sumInProgress = 0;
  let sumOverdue = 0;

  const rows: DeptBoardRow[] = users.map((u) => {
    const list = byUser.get(u.id) ?? [];
    const assigned = list.length;
    let completed = 0;
    let overdueCount = 0;
    let inProgress = 0;
    let pctSum = 0;
    let nearest: Date | null = null;

    for (const a of list) {
      const prog = progMap.get(`${u.id}:${a.courseId}`);
      const isCompleted = Boolean(prog?.completedAt);
      const pct = isCompleted ? 100 : prog?.percentage ?? 0;
      pctSum += pct;

      if (isCompleted) {
        completed++;
      } else if (a.dueDate && a.dueDate < now) {
        overdueCount++;
      } else if (pct > 0) {
        inProgress++;
      }

      if (!isCompleted && a.dueDate) {
        if (!nearest || a.dueDate < nearest) nearest = a.dueDate;
      }
    }

    sumAssigned += assigned;
    sumCompleted += completed;
    sumInProgress += inProgress;
    sumOverdue += overdueCount;

    let status: DeptBoardStatus;
    if (assigned > 0 && completed === assigned) status = "completed";
    else if (overdueCount > 0) status = "overdue";
    else if (completed > 0 || inProgress > 0) status = "in_progress";
    else status = "not_started";

    return {
      userId: u.id,
      name: u.name ?? u.email ?? u.id,
      assigned,
      completed,
      percent: assigned > 0 ? Math.round(pctSum / assigned) : 0,
      nearestDueDate: nearest ? nearest.toISOString() : null,
      overdueCount,
      status,
    };
  });

  // Sorun olanlar üstte: geciken -> devam -> başlamadı -> tamamlandı, sonra isim.
  rows.sort(
    (a, b) =>
      RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name, "tr")
  );

  return {
    summary: {
      totalUsers: users.length,
      totalAssignments: sumAssigned,
      completed: sumCompleted,
      inProgress: sumInProgress,
      overdue: sumOverdue,
      completionPct:
        sumAssigned > 0 ? Math.round((sumCompleted / sumAssigned) * 100) : 0,
    },
    users: rows,
  };
}
