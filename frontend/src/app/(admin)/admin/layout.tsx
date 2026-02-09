'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const menuItems = [
  // Gestao
  { 
    label: 'Dashboard', 
    href: '/admin/dashboard', 
    section: 'gestao',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  { 
    label: 'Parceiros', 
    href: '/admin/parceiros', 
    section: 'gestao',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  { 
    label: 'Clientes', 
    href: '/admin/clientes', 
    section: 'gestao',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  // Producao
  { 
    label: 'Viabilidade', 
    href: '/admin/producao/viabilidade', 
    section: 'producao',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  { 
    label: 'Convites', 
    href: '/admin/producao/convites', 
    section: 'producao',
    icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  { 
    label: 'Contratos', 
    href: '/admin/producao/contratos', 
    section: 'producao',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    router.push('/login');
  };

  // Don't wrap the login page itself
  if (pathname === '/admin') return <>{children}</>;

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200 shrink-0`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shrink-0 hover:bg-red-700 transition-colors"
            >
              <span className="text-white font-bold text-lg">T</span>
            </button>
            {sidebarOpen && (
              <div>
                <h1 className="text-white font-bold text-sm">TaxCredit</h1>
                <p className="text-gray-500 text-xs">Administrador</p>
              </div>
            )}
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {sidebarOpen && (
            <p className="text-[10px] text-gray-600 uppercase tracking-widest px-3 py-2 font-bold">Gestao</p>
          )}
          {menuItems.filter(i => i.section === 'gestao').map(item => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-red-600/20 text-red-400 font-semibold' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
                title={item.label}
              >
                <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                  active ? 'bg-red-600/30' : 'bg-gray-800'
                }`}>
                  <svg className={`w-4 h-4 ${active ? 'text-red-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                </span>
                {sidebarOpen && item.label}
              </Link>
            );
          })}

          <div className="pt-2">
            {sidebarOpen && (
              <p className="text-[10px] text-gray-600 uppercase tracking-widest px-3 py-2 font-bold">Producao</p>
            )}
            {menuItems.filter(i => i.section === 'producao').map(item => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-indigo-600/20 text-indigo-400 font-semibold' 
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                  title={item.label}
                >
                  <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                    active ? 'bg-indigo-600/30' : 'bg-gray-800'
                  }`}>
                    <svg className={`w-4 h-4 ${active ? 'text-indigo-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                  </span>
                  {sidebarOpen && item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User */}
        <div className="p-3 border-t border-gray-800">
          {sidebarOpen ? (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{user?.name || 'Admin'}</p>
                <p className="text-gray-500 text-xs truncate">{user?.email}</p>
              </div>
              <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition-colors ml-2" title="Sair">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="w-full flex justify-center text-gray-500 hover:text-red-400" title="Sair">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
