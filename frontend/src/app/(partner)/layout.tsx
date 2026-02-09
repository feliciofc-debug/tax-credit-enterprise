'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PartnerSidebar from '@/components/PartnerSidebar';

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');
    if (!token || role !== 'partner') {
      router.push('/parceiro-login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen">
      <PartnerSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
