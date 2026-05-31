'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { useVisualViewport } from '@/hooks/useVisualViewport';

function VisualViewportProvider({ children }: { children: React.ReactNode }) {
  useVisualViewport();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 2,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <VisualViewportProvider>{children}</VisualViewportProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

