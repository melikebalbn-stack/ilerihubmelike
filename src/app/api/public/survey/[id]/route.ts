import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - Public endpoint to fetch survey details (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const survey = await prisma.survey.findUnique({
      where: { id },
      select: {
        id: true,
        surveyNumber: true,
        title: true,
        description: true,
        isAnonymous: true,
        status: true,
        questions: {
          select: {
            id: true,
            questionText: true,
            questionType: true,
            sortOrder: true,
            isRequired: true,
            options: {
              select: {
                id: true,
                optionText: true,
                sortOrder: true,
              },
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    })

    if (!survey) {
      return NextResponse.json(
        { error: "Anket bulunamadı" },
        { status: 404 }
      )
    }

    if (survey.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Bu anket şu anda aktif değil" },
        { status: 400 }
      )
    }

    return NextResponse.json(survey)
  } catch (error) {
    console.error("Public survey fetch error:", error)
    return NextResponse.json(
      { error: "Anket yüklenirken bir hata oluştu" },
      { status: 500 }
    )
  }
}
