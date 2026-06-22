import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - List all departments (no auth required)
export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(departments)
  } catch (error) {
    console.error("Departments fetch error:", error)
    return NextResponse.json(
      { error: "Departmanlar yüklenirken bir hata oluştu" },
      { status: 500 }
    )
  }
}
