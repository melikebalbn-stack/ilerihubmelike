// 'server-only' paketi npm'de KURULU DEĞİL. Next.js bu specifier'ı derleme
// katmanında alias'lar (bkz. next/dist/build/webpack-config.js → /^server-only$/):
// modül bir client bundle'a sızarsa BUILD-TIME hata verir. Aşağıdaki tip-only
// ambient bildirim yalnızca tsc'nin modülü çözebilmesi içindir — yeni bir runtime
// bağımlılığı DEĞİLDİR (paket eklenmez).
declare module 'server-only'
