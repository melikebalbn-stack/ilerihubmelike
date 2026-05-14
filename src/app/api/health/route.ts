import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PR-FAZ-4: buildId + pid alanları eklendi. deploy.sh + rollback.sh
// BUILD_ID filesystem değeriyle runtime'da PM2 bellekteki değeri karşılaştırır
// (stale build koruma).

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'no-build-id'
  version: string
  buildId: string | null
  uptime: number
  pid: number
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
  let databaseStatus: 'up' | 'down' = 'down'
  let databaseLatency: number | undefined
  let databaseError: string | undefined

  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    databaseLatency = Date.now() - dbStart
    databaseStatus = 'up'
  } catch (error) {
    databaseError = error instanceof Error ? error.message : 'Unknown database error'
    databaseStatus = 'down'
  }

  let buildId: string | null = null
  try {
    const buildIdPath = join(process.cwd(), '.next', 'BUILD_ID')
    if (existsSync(buildIdPath)) {
      buildId = readFileSync(buildIdPath, 'utf-8').trim()
    }
  } catch {
    // ignore — buildId null kalır
  }

  let status: HealthCheckResponse['status']
  if (databaseStatus !== 'up') status = 'unhealthy'
  else if (!buildId) status = 'no-build-id'
  else status = 'healthy'

  const response: HealthCheckResponse = {
    status,
    version: process.env.npm_package_version || '0.1.0',
    buildId,
    uptime: process.uptime(),
    pid: process.pid,
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: databaseStatus,
        ...(databaseLatency !== undefined && { latencyMs: databaseLatency }),
        ...(databaseError && { error: databaseError }),
      },
    },
  }

  const statusCode = status === 'healthy' ? 200 : 503

  return NextResponse.json(response, {
    status: statusCode,
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
  })
}

// PR-FAZ-4 controlled fail test (REVERTED IN NEXT COMMIT)
import { kasitliBozukImport } from '@/lib/yok-boyle-bir-modul'
console.log(kasitliBozukImport)
