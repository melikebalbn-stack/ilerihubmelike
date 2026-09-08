import 'server-only'
import { z } from 'zod'

/**
 * Syteline (MSSQL) bağlantı yapılandırması — env'den okunur, zod ile doğrulanır.
 * SERVER-ONLY: MSSQL credential'ları asla client bundle'a sızmamalı (IFS config.ts deseni).
 *
 * Zorunlu env eksikse getSytelineConfig() net, tipli hata fırlatır.
 */
const SytelineConfigSchema = z.object({
  SYTELINE_HOST: z.string().min(1, 'SYTELINE_HOST zorunlu'),
  SYTELINE_PORT: z.coerce.number().int().positive().default(1433),
  SYTELINE_DB: z.string().min(1, 'SYTELINE_DB zorunlu'),
  SYTELINE_USER: z.string().min(1, 'SYTELINE_USER zorunlu'),
  SYTELINE_PASS: z.string().min(1, 'SYTELINE_PASS zorunlu'),
  // Opsiyonel site_ref filtresi — boşsa tüm siteler.
  SYTELINE_SITE: z.string().optional(),
  // TLS: MSSQL sunucusu genelde self-signed → trustServerCertificate=true (env ile aç/kapa).
  SYTELINE_ENCRYPT: z
    .string()
    .optional()
    .transform((v) => v == null || v === '' ? true : v === 'true' || v === '1'),
  SYTELINE_TRUST_CERT: z
    .string()
    .optional()
    .transform((v) => v == null || v === '' ? true : v === 'true' || v === '1'),
  // Bir çalışmada IFS'e yazılacak azami kayıt sayısı.
  SYTE_SYNC_BATCH: z.coerce.number().int().positive().default(50),
})

export interface SytelineConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  site?: string
  encrypt: boolean
  trustServerCertificate: boolean
  batch: number
}

let cached: SytelineConfig | null = null

/**
 * Syteline yapılandırmasını döndürür (ilk çağrıda doğrulanır ve cache'lenir).
 * @throws Error — zorunlu env eksik/geçersizse hangi alanların hatalı olduğunu belirtir.
 */
export function getSytelineConfig(): SytelineConfig {
  if (cached) return cached
  const parsed = SytelineConfigSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
    throw new Error(`Syteline yapılandırması eksik/geçersiz: ${issues}`)
  }
  const d = parsed.data
  cached = {
    host: d.SYTELINE_HOST,
    port: d.SYTELINE_PORT,
    database: d.SYTELINE_DB,
    user: d.SYTELINE_USER,
    password: d.SYTELINE_PASS,
    site: d.SYTELINE_SITE?.trim() || undefined,
    encrypt: d.SYTELINE_ENCRYPT,
    trustServerCertificate: d.SYTELINE_TRUST_CERT,
    batch: d.SYTE_SYNC_BATCH,
  }
  return cached
}
