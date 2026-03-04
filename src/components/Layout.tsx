import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, LogOut, User, ChevronRight, Menu, X, Home, Wallet,
  FileBarChart2, DoorOpen, ChevronDown, ChevronUp
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutos em ms

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    label: 'Financeiro',
    icon: Wallet,
    path: '/financeiro',
    children: [
      { label: 'Registros', icon: Wallet, path: '/financeiro' },
      { label: 'Relatório Mensal', icon: FileBarChart2, path: '/financeiro/relatorio' },
      { label: 'Índice de Vacância', icon: DoorOpen, path: '/financeiro/vacancia' },
    ],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [financeiroOpen, setFinanceiroOpen] = useState(
    location.pathname.startsWith('/financeiro')
  );
  const inactivityTimer = useRef<number | null>(null);

  // -- Auto-logout por inatividade ------------------------------------------
  const resetTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(async () => {
      await signOut();
      navigate('/login');
    }, INACTIVITY_TIMEOUT);
  }, [signOut, navigate]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // inicia o timer
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetTimer]);

  // Fecha menu mobile ao navegar
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Sidebar colapsa em mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  const userName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Usuário';
  const userEmail = user?.email || '';

  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    return (
      <>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary shrink-0">
            <Home className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="overflow-hidden transition-all duration-300" style={{ width: mobile || sidebarOpen ? 'auto' : 0, opacity: mobile || sidebarOpen ? 1 : 0 }}>
            <p className="text-sm font-bold text-sidebar-accent-foreground leading-tight whitespace-nowrap">Living Gest</p>
            <p className="text-xs whitespace-nowrap" style={{ color: 'hsl(var(--sidebar-foreground))' }}>Gestão de Imóveis</p>
          </div>
          {mobile && (
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="ml-auto p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            if (item.children) {
              return (
                <div key={item.path}>
                  <button
                    onClick={() => {
                      if (!mobile && !sidebarOpen) {
                        setSidebarOpen(true);
                        setFinanceiroOpen(true);
                      } else {
                        setFinanceiroOpen(o => !o);
                      }
                    }}
                    className={`sidebar-nav-item w-full text-left ${isActive ? 'active' : ''}`}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    {(mobile || sidebarOpen) && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {financeiroOpen
                          ? <ChevronUp className="w-4 h-4 ml-auto opacity-60" />
                          : <ChevronDown className="w-4 h-4 ml-auto opacity-60" />}
                      </>
                    )}
                  </button>
                  <div
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{ maxHeight: (mobile || sidebarOpen) && financeiroOpen ? '200px' : '0px' }}
                  >
                    <div className="ml-3 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                      {item.children.map(child => {
                        const childActive = location.pathname === child.path;
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={`sidebar-nav-item py-1.5 text-sm ${childActive ? 'active' : ''}`}
                          >
                            <child.icon className="w-4 h-4 shrink-0" />
                            <span>{child.label}</span>
                            {childActive && <ChevronRight className="w-3 h-3 ml-auto" />}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {(mobile || sidebarOpen) && <span>{item.label}</span>}
                {(mobile || sidebarOpen) && isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
          <Link
            to="/profile"
            className={`sidebar-nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
          >
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
              <User className="w-3 h-3 text-primary-foreground" />
            </div>
            {(mobile || sidebarOpen) && (
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
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {(mobile || sidebarOpen) && <span>Sair</span>}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* -- DESKTOP SIDEBAR - transição suave de largura -- */}
      <aside
        className="hidden md:flex flex-col shrink-0 transition-all duration-300 ease-in-out"
        style={{
          width: sidebarOpen ? '240px' : '68px',
          background: 'hsl(var(--sidebar-background))',
        }}
      >
        <SidebarContent />
      </aside>

      {/* Toggle button desktop */}
      <div className="hidden md:block relative">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 -left-3 z-10 w-6 h-6 rounded-full border border-border bg-card shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
        >
          {sidebarOpen ? <X className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
        </button>
      </div>

      {/* -- MOBILE OVERLAY DRAWER - slide suave -- */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileMenuOpen(false)}
      />
      {/* Drawer */}
      <aside
        className="fixed inset-y-0 left-0 z-50 flex flex-col w-72 md:hidden shadow-xl transition-transform duration-300 ease-in-out"
        style={{
          background: 'hsl(var(--sidebar-background))',
          transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <SidebarContent mobile />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">Living Gest</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
