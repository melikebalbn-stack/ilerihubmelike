import 'server-only'
import sql from 'mssql'
import { getSytelineConfig } from './config'

/**
 * Syteline MSSQL bağlantısı — tek (singleton) ConnectionPool. SERVER-ONLY, SALT OKUMA.
 * Parametreli sorgu ZORUNLU (string birleştirme yasak) → sytePool().request().input(...).query(...).
 *
 * Havuz süreç ömrü boyunca paylaşılır; eşzamanlı çağrılarda tek in-flight bağlanma promise'i.
 */
let pool: sql.ConnectionPool | null = null
let inFlight: Promise<sql.ConnectionPool> | null = null

function poolConfig(): sql.config {
  const c = getSytelineConfig()
  return {
    server: c.host,
    port: c.port,
    database: c.database,
    user: c.user,
    password: c.password,
    options: {
      encrypt: c.encrypt,
      trustServerCertificate: c.trustServerCertificate,
      // Salt okuma entegrasyonu — büyük tablolarda akış için makul havuz.
      enableArithAbort: true,
    },
    pool: { max: 4, min: 0, idleTimeoutMillis: 30_000 },
    requestTimeout: 60_000,
    connectionTimeout: 15_000,
  }
}

/** Bağlı MSSQL havuzunu döndürür (yoksa açar). Bağlantı koparsa bir sonraki çağrıda yeniden açılır. */
export async function sytePool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool
  if (inFlight) return inFlight
  inFlight = (async () => {
    const p = new sql.ConnectionPool(poolConfig())
    p.on('error', () => {
      // Havuz hatası → referansı düşür ki sonraki çağrı yeniden bağlansın.
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
export async function syteClose(): Promise<void> {
  if (pool) {
    const p = pool
    pool = null
    await p.close().catch(() => {})
  }
}

// mssql tip yardımcıları re-export (çağıranlar input tiplerini buradan alsın).
export { sql }
