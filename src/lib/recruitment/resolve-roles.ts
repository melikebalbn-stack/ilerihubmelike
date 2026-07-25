// Başvuru Değerlendirme Workflow — kullanıcının bir başvuru üzerindeki ROL(ler)i.
//
// TEK KAYNAK: Hem POST /transition (geçiş yetkisi) hem GET /stage-log (okuma yetkisi)
// bu helper'dan geçer; rol belirleme mantığı iki route'ta KOPYALANMAZ.
//
// Bir kullanıcı BİRDEN ÇOK role sahip olabilir (hem İK hem atanan müdür).
// - İK: recruitment.admin veya hr.admin izni
// - MUDUR: başvuruya atanan müdür (assignedManagerId === session.user.id)
// (session.user.id bu repoda DB User.id'dir; assignedManagerId → User.id.)

import type { TransitionRole } from "@/lib/recruitment/transitions";

export function resolveTransitionRoles(args: {
  permissions: string[] | undefined;
  userId: string;
  assignedManagerId: string | null;
}): TransitionRole[] {
  const perms = args.permissions ?? [];
  const roles: TransitionRole[] = [];
  if (perms.includes("recruitment.admin") || perms.includes("hr.admin")) roles.push("IK");
  if (args.assignedManagerId && args.assignedManagerId === args.userId) roles.push("MUDUR");
  return roles;
}
