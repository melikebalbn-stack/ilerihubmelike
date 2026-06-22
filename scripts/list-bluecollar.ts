import { PrismaClient } from '../src/generated/prisma';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { employeeId: { not: null } },
    select: { id: true, email: true, name: true, employeeId: true, tcLastFour: true, isActive: true }
  });
  console.log(JSON.stringify(users, null, 2));
}

main().finally(() => prisma.$disconnect());
