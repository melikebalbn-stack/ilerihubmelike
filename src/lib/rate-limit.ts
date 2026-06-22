// Basit in-memory rate limiter
// Production'da Redis kullanılabilir

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Her 5 dakikada bir eski kayıtları temizle
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetTime < now) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  windowMs?: number;  // Zaman penceresi (ms)
  maxAttempts?: number;  // Maksimum deneme sayısı
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number;  // Saniye cinsinden
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const {
    windowMs = 15 * 60 * 1000,  // 15 dakika
    maxAttempts = 5  // 5 deneme
  } = options;

  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  // Yeni kayıt veya süresi dolmuş
  if (!entry || entry.resetTime < now) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      remaining: maxAttempts - 1,
      resetIn: Math.ceil(windowMs / 1000),
    };
  }

  // Limit aşıldı
  if (entry.count >= maxAttempts) {
    return {
      success: false,
      remaining: 0,
      resetIn: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  // Sayacı artır
  entry.count++;
  return {
    success: true,
    remaining: maxAttempts - entry.count,
    resetIn: Math.ceil((entry.resetTime - now) / 1000),
  };
}

// Başarılı login sonrası sayacı sıfırla
export function resetRateLimit(identifier: string): void {
  rateLimitMap.delete(identifier);
}

// IP + username bazlı rate limit key oluştur
export function getRateLimitKey(ip: string, username?: string): string {
  if (username) {
    return `login:${ip}:${username}`;
  }
  return `login:${ip}`;
}
