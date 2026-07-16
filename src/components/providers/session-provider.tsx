'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function SessionProvider({ children }: Props) {
  // PR-SR401-B: Kayan oturum istemci tarafı.
  // refetchInterval=5dk → aktif sekmede session periyodik yenilenir (updateAge ile token
  // yeniden yazılır = sliding). refetchOnWindowFocus → sekmeye dönüşte oturumu erken doğrular,
  // dolmuşsa kullanıcı bir sonraki istekte 401 yemeden fark eder.
  return (
    <NextAuthSessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={true}>
      {children}
    </NextAuthSessionProvider>
  );
}
