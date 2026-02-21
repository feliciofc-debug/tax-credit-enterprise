'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { SWRConfig } from 'swr';
import { warmBackend, startKeepAlive, stopKeepAlive } from '@/lib/fetcher';

const menuItems = [
  { label: 'Dashboard', href: '/admin/dashboard', section: 'gestao', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { label: 'Parceiros', href: '/admin/parceiros', section: 'gestao', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { label: 'Clientes', href: '/admin/clientes', section: 'gestao', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { label: 'Viabilidade', href: '/admin/producao/viabilidade', section: 'producao', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { label: 'Análises', href: '/admin/producao/analises', section: 'producao', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { label: 'Convites', href: '/admin/producao/convites', section: 'producao', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { label: 'Contratos', href: '/admin/producao/contratos', section: 'producao', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { label: 'Formalização', href: '/admin/producao/formalizacao', section: 'producao', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
  { label: 'Teses', href: '/admin/producao/teses', section: 'producao', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { label: 'HPC Motor', href: '/admin/producao/hpc', section: 'producao', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
] as const;

function MenuLink({ item, active, open }: { item: typeof menuItems[number]; active: boolean; open: boolean }) {
  const section = item.section;
  const colorActive = section === 'gestao' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'bg-indigo-50 text-indigo-700 font-semibold';
  const colorIcon = section === 'gestao'
    ? (active ? 'bg-emerald-100' : 'bg-gray-100')
    : (active ? 'bg-indigo-100' : 'bg-gray-100');
  const colorSvg = section === 'gestao'
    ? (active ? 'text-emerald-600' : 'text-gray-400')
    : (active ? 'text-indigo-600' : 'text-gray-400');

  return (
    <Link
      href={item.href}
      prefetch={true}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
        active ? colorActive : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
      title={item.label}
    >
      <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${colorIcon}`}>
        <svg className={`w-4 h-4 ${colorSvg}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
        </svg>
      </span>
      {open && item.label}
    </Link>
  );
}

const MemoMenuLink = memo(MenuLink);

const swrGlobalConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  keepPreviousData: true,
  errorRetryCount: 2,
  dedupingInterval: 120000,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [backendReady, setBackendReady] = useState(true);
  const [warming, setWarming] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const savedUser = localStorage.getItem('user');

    if (!token || role !== 'admin') {
      router.push('/admin');
      return;
    }

    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch {}
    }

    const lastPing = sessionStorage.getItem('backendPinged');
    const fiveMin = 5 * 60 * 1000;
    if (!lastPing || Date.now() - Number(lastPing) > fiveMin) {
      setWarming(true);
      const start = Date.now();
      warmBackend().then(() => {
        sessionStorage.setItem('backendPinged', String(Date.now()));
        setWarming(false);
      });
      const timer = setTimeout(() => {
        if (Date.now() - start > 3000) setBackendReady(false);
      }, 3000);
      return () => clearTimeout(timer);
    }

    startKeepAlive();
    return () => stopKeepAlive();
  }, []);

  useEffect(() => {
    if (!warming) setBackendReady(true);
  }, [warming]);

  const handleLogout = useCallback(() => {
    stopKeepAlive();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    sessionStorage.removeItem('backendPinged');
    window.location.href = '/';
  }, []);

  if (pathname === '/admin') return <>{children}</>;

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <SWRConfig value={swrGlobalConfig}>
      <div className="min-h-screen bg-gray-50 flex">
        {!backendReady && warming && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-center gap-2 text-sm text-yellow-800">
            <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
            Conectando ao servidor... aguarde alguns segundos
          </div>
        )}

        <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white border-r border-gray-200 flex flex-col transition-all duration-200 shrink-0 sticky top-0 h-screen`}>
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0 hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <span className="text-white font-bold text-lg">T</span>
              </button>
              {sidebarOpen && (
                <div>
                  <h1 className="text-gray-900 font-bold text-sm">TaxCredit</h1>
                  <p className="text-gray-400 text-xs">Administrador</p>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {sidebarOpen && (
              <p className="text-[10px] text-gray-400 uppercase tracking-widest px-3 py-2 font-bold">Gestao</p>
            )}
            {menuItems.filter(i => i.section === 'gestao').map(item => (
              <MemoMenuLink key={item.href} item={item} active={isActive(item.href)} open={sidebarOpen} />
            ))}

            <div className="pt-2">
              {sidebarOpen && (
                <p className="text-[10px] text-gray-400 uppercase tracking-widest px-3 py-2 font-bold">Producao</p>
              )}
              {menuItems.filter(i => i.section === 'producao').map(item => (
                <MemoMenuLink key={item.href} item={item} active={isActive(item.href)} open={sidebarOpen} />
              ))}
            </div>
          </nav>

          <div className="p-3 border-t border-gray-100">
            {sidebarOpen ? (
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-gray-900 text-sm font-medium truncate">{user?.name || 'Admin'}</p>
                  <p className="text-gray-400 text-xs truncate">{user?.email}</p>
                </div>
                <button onClick={handleLogout} className="text-gray-400 hover:text-red-600 transition-colors ml-2" title="Sair">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                </button>
              </div>
            ) : (
              <button onClick={handleLogout} className="w-full flex justify-center text-gray-400 hover:text-red-600" title="Sair">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
              </button>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </SWRConfig>
  );
}
