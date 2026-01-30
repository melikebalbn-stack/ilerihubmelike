'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Loader2, AlertCircle, Briefcase, HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');

  // White-collar (LDAP) state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Blue-collar state
  const [employeeId, setEmployeeId] = useState('');
  const [tcLastFour, setTcLastFour] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    error === 'CredentialsSignin' ? 'Geçersiz kullanıcı adı veya şifre' : null
  );

  const handleWhiteCollarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signIn('ldap', {
        username,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setErrorMessage('Geçersiz kullanıcı adı veya şifre');
        setIsLoading(false);
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setErrorMessage('Giriş yapılırken bir hata oluştu');
      setIsLoading(false);
    }
  };

  const handleBlueCollarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    // TC son 4 hane doğrulama
    if (!/^\d{4}$/.test(tcLastFour)) {
      setErrorMessage('TC son 4 hane 4 rakamdan oluşmalıdır');
      setIsLoading(false);
      return;
    }

    try {
      const result = await signIn('bluecollar', {
        employeeId,
        tcLastFour,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        // API'den gelen hata mesajını göster
        if (result.error.includes('Sicil numarası bulunamadı')) {
          setErrorMessage('Sicil numarası bulunamadı');
        } else if (result.error.includes('TC son 4 hane')) {
          setErrorMessage('TC son 4 hane hatalı');
        } else if (result.error.includes('aktif değil')) {
          setErrorMessage('Kullanıcı hesabı aktif değil');
        } else if (result.error.includes('fazla başarısız')) {
          setErrorMessage(result.error);
        } else {
          setErrorMessage('Giriş bilgileri hatalı');
        }
        setIsLoading(false);
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setErrorMessage('Giriş yapılırken bir hata oluştu');
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-10 w-10" />
          </div>
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">
            ILERI<span className="text-primary">Hub</span>
          </CardTitle>
          <CardDescription className="mt-2">
            Kurumsal Portalınıza Hoş Geldiniz
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="whitecollar" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="whitecollar" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Beyaz Yaka
            </TabsTrigger>
            <TabsTrigger value="bluecollar" className="flex items-center gap-2">
              <HardHat className="h-4 w-4" />
              Mavi Yaka
            </TabsTrigger>
          </TabsList>

          {/* White-collar login (LDAP) */}
          <TabsContent value="whitecollar">
            <form onSubmit={handleWhiteCollarSubmit} className="space-y-4">
              {errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Kullanıcı Adı</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="ornek.kullanici"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="username"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Active Directory kullanıcı adınızı girin
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  'Giriş Yap'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-xs text-muted-foreground">
              <p>Şifrenizi unuttuysanız lütfen IT Departmanı ile iletişime geçin.</p>
            </div>
          </TabsContent>

          {/* Blue-collar login (Sicil No + TC) */}
          <TabsContent value="bluecollar">
            <form onSubmit={handleBlueCollarSubmit} className="space-y-4">
              {errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="employeeId">Sicil Numarası</Label>
                <Input
                  id="employeeId"
                  type="text"
                  placeholder="12345"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  İK tarafından verilen sicil numaranızı girin
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tcLastFour">TC Kimlik No (Son 4 Hane)</Label>
                <Input
                  id="tcLastFour"
                  type="text"
                  placeholder="1234"
                  maxLength={4}
                  value={tcLastFour}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setTcLastFour(value);
                  }}
                  required
                  disabled={isLoading}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  TC Kimlik numaranızın son 4 hanesini girin
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  'Giriş Yap'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-xs text-muted-foreground">
              <p>Sicil numaranızı bilmiyorsanız İK Departmanı ile iletişime geçin.</p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function LoginLoading() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-10 w-10" />
          </div>
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">
            ILERI<span className="text-primary">Hub</span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 p-4">
      <Suspense fallback={<LoginLoading />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
