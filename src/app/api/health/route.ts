import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy'
  version: string
  uptime: number
  timestamp: string
  checks: {
    database: {
      status: 'up' | 'down'
      latencyMs?: number
      error?: string
    }
  }
}

export async function GET() {
  const startTime = Date.now()

  let databaseStatus: 'up' | 'down' = 'down'
  let databaseLatency: number | undefined
  let databaseError: string | undefined

  // Database bağlantı kontrolü
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    databaseLatency = Date.now() - dbStart
    databaseStatus = 'up'
  } catch (error) {
    databaseError = error instanceof Error ? error.message : 'Unknown database error'
    databaseStatus = 'down'
  }

  const response: HealthCheckResponse = {
    status: databaseStatus === 'up' ? 'healthy' : 'unhealthy',
    version: process.env.npm_package_version || '0.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: databaseStatus,
        ...(databaseLatency !== undefined && { latencyMs: databaseLatency }),
        ...(databaseError && { error: databaseError }),
      },
    },
  }

  const statusCode = response.status === 'healthy' ? 200 : 503

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
