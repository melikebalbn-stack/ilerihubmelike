// Başvuru Değerlendirme Workflow — kullanıcının bir başvuru üzerindeki ROL(ler)i.
//
// TEK KAYNAK: Hem POST /transition (geçiş yetkisi) hem GET /stage-log (okuma yetkisi)
// bu helper'dan geçer; rol belirleme mantığı iki route'ta KOPYALANMAZ.
//
// Bir kullanıcı BİRDEN ÇOK role sahip olabilir (hem İK hem atanan müdür).
// - İK: recruitment.admin veya hr.admin izni
// - MUDUR: başvuruya atanan müdür (assignedManagerId === session.user.id)
// (session.user.id bu repoda DB User.id'dir; assignedManagerId → User.id.)
//
// İKİ KATMAN:
//   resolveTransitionRoles      — SAF/SENKRON. İzin + assignedManagerId'den türeyen roller.
//                                 (IK, MUDUR, DEGERLENDIRICI). DB'ye gitmez.
//   resolveTransitionRolesFull  — ASYNC. Yukarıdakilere ek olarak DEPARTMAN tabanlı
//                                 rolleri (URETIM_MUDUR_YRD, FABRIKA_MUDURU) ekler.
// Yalnız workflow otoritesi gereken uçlar (transition + stage-log) Full çağırır; diğer
// çağıranlar saf sürümde kalır (gereksiz DB turu ve mevcut akışlara risk yok).

import type { TransitionRole } from "@/lib/recruitment/transitions";
import { uretimDepartmaniCozOrNull } from "@/lib/recruitment/otomatik-atama";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

type RolArgs = {
  permissions: string[] | undefined;
  userId: string;
  assignedManagerId: string | null;
};

export function resolveTransitionRoles(args: RolArgs): TransitionRole[] {
  const perms = args.permissions ?? [];
  const roles: TransitionRole[] = [];
  if (perms.includes("recruitment.admin") || perms.includes("hr.admin")) roles.push("IK");
  const atanan = !!args.assignedManagerId && args.assignedManagerId === args.userId;
  if (atanan) roles.push("MUDUR");
  // Mavi yaka zinciri: değerlendirici de "atanan kişi" desenidir (MUDUR ile aynı koşul).
  // İkisinin birlikte verilmesi zararsızdır: matriste bir statünün MUDUR ve DEGERLENDIRICI
  // satırları ayrıktır, yani rol karışması yetki genişletmez.
  if (atanan) roles.push("DEGERLENDIRICI");
  return roles;
}

/**
 * Saf rollere ek olarak departman tabanlı rolleri çözer.
 * Kişi adı GÖMÜLMEZ — kim olduğu DepartmentDefinition'dan gelir (bkz. otomatik-atama.ts).
 *
 * Departman yapılandırması eksikse (env yok / kayıt yok) sessizce yalnız saf roller döner.
 * Bu bilinçlidir: okuma/mevcut akışlar env unutulduğu için KIRILMAZ. Yapılandırma eksikliği,
 * asıl önemli olduğu yerde — otomatik atamalı geçiş anında — 400 ile yüzeye çıkar.
 */
export async function resolveTransitionRolesFull(
  args: RolArgs,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<TransitionRole[]> {
  const roles = resolveTransitionRoles(args);

  const dep = await uretimDepartmaniCozOrNull(db);
  if (!dep) return roles;

  if (dep.MUDUR_YRD.userId && dep.MUDUR_YRD.userId === args.userId) roles.push("URETIM_MUDUR_YRD");
  if (dep.MUDUR.userId && dep.MUDUR.userId === args.userId) roles.push("FABRIKA_MUDURU");

  return roles;
}
