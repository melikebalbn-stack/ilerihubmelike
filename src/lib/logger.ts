/**
 * FIX #29: Yapısal logger utility
 * Production'da debug logları kapalı, emoji yok
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

const CURRENT_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL]
}

function formatMessage(module: string, message: string, data?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString()
  const dataStr = data ? ` ${JSON.stringify(data)}` : ''
  return `[${timestamp}] [${module}] ${message}${dataStr}`
}

export const logger = {
  debug(module: string, message: string, data?: Record<string, unknown>) {
    if (shouldLog('debug')) {
      console.log(formatMessage(module, message, data))
    }
  },

  info(module: string, message: string, data?: Record<string, unknown>) {
    if (shouldLog('info')) {
      console.log(formatMessage(module, message, data))
    }
  },

  warn(module: string, message: string, data?: Record<string, unknown>) {
    if (shouldLog('warn')) {
      console.warn(formatMessage(module, message, data))
    }
  },

  error(module: string, message: string, data?: Record<string, unknown>) {
    if (shouldLog('error')) {
      console.error(formatMessage(module, message, data))
    }
  }
}

// API error response helper
export function logApiError(
  endpoint: string,
  error: unknown,
  userId?: string
): void {
  logger.error('API', `${endpoint} failed`, {
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: process.env.NODE_ENV !== 'production' && error instanceof Error
      ? error.stack?.split('\n').slice(0, 3).join(' -> ')
      : undefined,
    userId
  })
}
