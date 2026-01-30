import { PrismaClient } from "../src/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import * as dotenv from "dotenv"

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function reset() {
  console.log("Tüm kontroller sıfırlanıyor...")

  const result = await prisma.iso27001Control.updateMany({
    data: {
      status: "NOT_IMPLEMENTED",
      applicability: true,
      implementationNotes: null,
      justification: null,
    }
  })

  console.log(`${result.count} kontrol sıfırlandı`)
  await prisma.$disconnect()
  await pool.end()
}

reset().catch(console.error)
