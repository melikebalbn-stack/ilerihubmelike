import 'server-only'
import sql from 'mssql'
import { getMasConfig } from './config'

/**
 * MAS MES MSSQL bağlantısı — tek (singleton) ConnectionPool. SERVER-ONLY, SALT OKUMA (hub_ro).
 * Parametreli sorgu ZORUNLU (string birleştirme yasak) → masPool().request().input(...).query(...).
 * syteline/client.ts deseni; havuz süreç ömrü boyunca paylaşılır, kopunca yeniden açılır.
 */
let pool: sql.ConnectionPool | null = null
let inFlight: Promise<sql.ConnectionPool> | null = null

function poolConfig(): sql.config {
  const c = getMasConfig()
  return {
    server: c.host,
    port: c.port,
    database: c.database,
    user: c.user,
    password: c.password,
    options: {
      encrypt: c.encrypt,
      trustServerCertificate: c.trustServerCertificate,
      enableArithAbort: true,
    },
    pool: { max: 4, min: 0, idleTimeoutMillis: 30_000 },
    requestTimeout: 60_000,
    connectionTimeout: 15_000,
  }
}

/** Bağlı MSSQL havuzunu döndürür (yoksa açar). Bağlantı koparsa bir sonraki çağrıda yeniden açılır. */
export async function masPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool
  if (inFlight) return inFlight
  inFlight = (async () => {
    const p = new sql.ConnectionPool(poolConfig())
    p.on('error', () => {
      if (pool === p) pool = null
    })
    await p.connect()
    pool = p
    return p
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}

/** Test/geçici kullanım — havuzu kapatır. */
export async function masClose(): Promise<void> {
  if (pool) {
    const p = pool
    pool = null
    await p.close().catch(() => {})
  }
}

export { sql }
