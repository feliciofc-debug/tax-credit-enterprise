'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SWRConfig } from 'swr';
import PartnerSidebar from '@/components/PartnerSidebar';
import { warmBackend, startKeepAlive, stopKeepAlive } from '@/lib/fetcher';

const swrGlobalConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  keepPreviousData: true,
  errorRetryCount: 2,
  dedupingInterval: 120000,
};

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');
    if (!token || role !== 'partner') {
      router.push('/parceiro-login');
      return;
    }
    warmBackend();
    startKeepAlive();
    return () => stopKeepAlive();
  }, [router]);

  return (
    <SWRConfig value={swrGlobalConfig}>
      <div className="flex min-h-screen">
        <PartnerSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </SWRConfig>
  );
}
