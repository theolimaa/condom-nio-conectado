import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, LogOut, User, ChevronRight, Menu, X, Home, Wallet
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Financeiro', icon: Wallet, path: '/financeiro' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  const userName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Usuário';
  const userEmail = user?.email || '';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className="flex flex-col transition-all duration-300 shrink-0"
        style={{
          width: sidebarOpen ? '240px' : '68px',
          background: 'hsl(var(--sidebar-background))',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary shrink-0">
            <Home className="w-5 h-5 text-primary-foreground" />
          </div>
          {sidebarOpen && (
            <div>
              <p className="text-sm font-bold text-sidebar-accent-foreground leading-tight">Living Gest</p>
              <p className="text-xs" style={{ color: 'hsl(var(--sidebar-foreground))' }}>Gestão de Imóveis</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
          <Link
            to="/profile"
            className={`sidebar-nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
            title={!sidebarOpen ? 'Perfil' : undefined}
          >
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
              <User className="w-3 h-3 text-primary-foreground" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-xs font-semibold text-sidebar-accent-foreground truncate">{userName}</p>
                <p className="text-xs truncate" style={{ color: 'hsl(var(--sidebar-foreground))' }}>{userEmail}</p>
              </div>
            )}
          </Link>
          <button
            onClick={handleLogout}
            className="sidebar-nav-item w-full text-left"
            style={{ color: 'hsl(var(--overdue))' }}
            title={!sidebarOpen ? 'Sair' : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Toggle button */}
      <div className="relative">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 -left-3 z-10 w-6 h-6 rounded-full border border-border bg-card shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
        >
          {sidebarOpen ? <X className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
