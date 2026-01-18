import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface SearchResult {
  id: string
  title: string
  subtitle?: string
  type: 'task' | 'announcement' | 'suggestion' | 'user' | 'device' | 'ticket'
  url: string
  icon?: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] })
    }

    const searchTerm = query.toLowerCase()
    const results: SearchResult[] = []

    // Parallel search
    const [tasks, announcements, suggestions, tickets] = await Promise.all([
      // Tasks
      prisma.plannedTask.findMany({
        where: {
          isActive: true,
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          category: { select: { name: true } },
        },
        take: 5,
      }),

      // Announcements
      prisma.announcement.findMany({
        where: {
          status: 'PUBLISHED',
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { summary: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          summary: true,
          publishedAt: true,
        },
        take: 5,
      }),

      // Suggestions
      prisma.suggestion.findMany({
        where: {
          isActive: true,
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { suggestionNumber: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          suggestionNumber: true,
          title: true,
          status: true,
        },
        take: 5,
      }),

      // IT Tickets
      prisma.ticket.findMany({
        where: {
          isActive: true,
          OR: [
            { subject: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { ticketNumber: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
        },
        take: 5,
      }),
    ])

    // Format tasks
    tasks.forEach(task => {
      results.push({
        id: task.id,
        title: task.title,
        subtitle: task.category?.name || task.status,
        type: 'task',
        url: '/tasks?id=' + task.id,
        icon: 'ClipboardList',
      })
    })

    // Format announcements
    announcements.forEach(ann => {
      results.push({
        id: ann.id,
        title: ann.title,
        subtitle: ann.summary?.substring(0, 50) || undefined,
        type: 'announcement',
        url: '/announcements/' + ann.id,
        icon: 'Megaphone',
      })
    })

    // Format suggestions
    suggestions.forEach(sug => {
      results.push({
        id: sug.id,
        title: sug.suggestionNumber + ' - ' + sug.title,
        subtitle: sug.status,
        type: 'suggestion',
        url: '/suggestions?id=' + sug.id,
        icon: 'Lightbulb',
      })
    })

    // Format tickets
    tickets.forEach(ticket => {
      results.push({
        id: ticket.id,
        title: ticket.ticketNumber + ' - ' + ticket.subject,
        subtitle: ticket.status,
        type: 'ticket',
        url: '/it-support?ticket=' + ticket.id,
        icon: 'Headphones',
      })
    })

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Arama hatasi' }, { status: 500 })
  }
}
