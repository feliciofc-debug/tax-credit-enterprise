'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const menuItems = [
  { 
    label: 'Dashboard', 
    href: '/admin/dashboard', 
    icon: 'D',
    section: 'admin',
  },
  { 
    label: 'Viabilidade', 
    href: '/admin/producao/viabilidade', 
    icon: 'V',
    section: 'producao',
  },
  { 
    label: 'Convites', 
    href: '/admin/producao/convites', 
    icon: 'E',
    section: 'producao',
  },
  { 
    label: 'Contratos', 
    href: '/admin/producao/contratos', 
    icon: 'C',
    section: 'producao',
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

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-white font-bold text-sm">TaxCredit</h1>
                <p className="text-gray-500 text-xs">Admin</p>
              </div>
            )}
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-3 space-y-1">
          {sidebarOpen && (
            <p className="text-xs text-gray-600 uppercase tracking-wider px-3 py-2">Gestao</p>
          )}
          {menuItems.filter(i => i.section === 'admin').map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                pathname === item.href 
                  ? 'bg-red-600/20 text-red-400 font-semibold' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${
                pathname === item.href ? 'bg-red-600/30 text-red-400' : 'bg-gray-800 text-gray-500'
              }`}>
                {item.icon}
              </span>
              {sidebarOpen && item.label}
            </Link>
          ))}

          {sidebarOpen && (
            <p className="text-xs text-gray-600 uppercase tracking-wider px-3 py-2 mt-4">Producao</p>
          )}
          {menuItems.filter(i => i.section === 'producao').map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                pathname === item.href 
                  ? 'bg-indigo-600/20 text-indigo-400 font-semibold' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${
                pathname === item.href ? 'bg-indigo-600/30 text-indigo-400' : 'bg-gray-800 text-gray-500'
              }`}>
                {item.icon}
              </span>
              {sidebarOpen && item.label}
            </Link>
          ))}
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
