import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Wallet, FileText, FileBarChart2, DoorOpen, Files, History, User,
} from 'lucide-react';
import Layout from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useCondominiums } from '@/hooks/useCondominiums';
import { useApartments } from '@/hooks/useApartments';
import { useTenants } from '@/hooks/useTenants';
import { useAllFinancialRecords, calcReceived } from '@/hooks/useFinancial';
import { useOverdueSummary } from '@/hooks/useOverdueSummary';
import { formatCurrency } from '@/lib/utils-app';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const OVERDUE_PREVIEW_COUNT = 4;

export default function Home() {
  const navigate = useNavigate();
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const { user } = useAuth();
  const { data: condominiums = [] } = useCondominiums();
  const { data: apartments = [] } = useApartments();
  const { data: allTenants = [] } = useTenants();
  const { data: financialRecords = [] } = useAllFinancialRecords();
  const { items: overdueItems, totalCount: overdueCount, totalValue: overdueValue } = useOverdueSummary();

  const userName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Administrador';

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const recebidoMes = financialRecords
    .filter(r => r.paid && r.payment_date?.startsWith(monthKey))
    .reduce((s, r) => s + calcReceived(r), 0);

  const occupiedCount = apartments.filter(a => allTenants.some(t => t.apartment_id === a.id)).length;
  const vacantCount = apartments.length - occupiedCount;
  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  const modules = [
    {
      label: 'Condomínios',
      sub: `${condominiums.length} condomínio${condominiums.length !== 1 ? 's' : ''} · ${apartments.length} unidades`,
      icon: Building2,
      path: '/dashboard',
    },
    { label: 'Financeiro', sub: 'Registros e recebimentos', icon: Wallet, path: '/financeiro' },
    { label: 'Recibos', sub: 'Gerar e baixar em lote', icon: FileText, path: '/recibos' },
    { label: 'Relatório mensal', sub: 'PDF por condomínio', icon: FileBarChart2, path: '/financeiro/relatorio' },
    { label: 'Vacância', sub: `${vacantCount} unidade${vacantCount !== 1 ? 's' : ''} vaga${vacantCount !== 1 ? 's' : ''}`, icon: DoorOpen, path: '/financeiro/vacancia' },
    { label: 'Documentos', sub: 'Contratos e anexos', icon: Files, path: '/documentos' },
    { label: 'Ex-inquilinos', sub: 'Histórico e dívidas', icon: History, path: '/anteriores' },
    { label: 'Perfil', sub: 'Conta e preferências', icon: User, path: '/profile' },
  ];

  return (
    <Layout>
      <div className="page-content">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{getGreeting()}, {userName}</h1>
          <p className="text-muted-foreground text-sm mt-0.5 capitalize">{dateLabel}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">Recebido esse mês</p>
            <p className="text-xl font-extrabold" style={{ color: 'hsl(var(--paid))' }}>{formatCurrency(recebidoMes)}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">Ocupação</p>
            <p className="text-xl font-extrabold">
              {occupiedCount}<span className="text-sm font-medium text-muted-foreground"> / {apartments.length} unidades</span>
            </p>
          </div>
          <div
            className="rounded-xl border p-4"
            style={{
              background: overdueCount > 0 ? 'hsl(var(--overdue) / 0.06)' : 'hsl(var(--card))',
              borderColor: overdueCount > 0 ? 'hsl(var(--overdue) / 0.25)' : 'hsl(var(--border))',
            }}
          >
            <p className="text-xs text-muted-foreground mb-1">Inadimplência</p>
            <p className="text-xl font-extrabold" style={{ color: overdueCount > 0 ? 'hsl(var(--overdue))' : 'hsl(var(--foreground))' }}>
              {overdueCount}
              <span className="text-sm font-medium text-muted-foreground">
                {' '}inquilino{overdueCount !== 1 ? 's' : ''}{overdueCount > 0 ? ` · ${formatCurrency(overdueValue)}` : ''}
              </span>
            </p>
          </div>
        </div>

        {overdueItems.length > 0 && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-sm font-bold">Precisa cobrar</p>
              <button onClick={() => navigate('/financeiro')} className="text-xs text-primary font-semibold hover:underline">
                Ver tudo no Financeiro
              </button>
            </div>
            <ul className="divide-y divide-border">
              {(showAllOverdue ? overdueItems : overdueItems.slice(0, OVERDUE_PREVIEW_COUNT)).map(item => (
                <li key={item.apartmentId}>
                  <button
                    onClick={() => navigate(`/apartments/${item.apartmentId}?tab=financial`)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'hsl(var(--overdue) / 0.12)', color: 'hsl(var(--overdue))' }}
                    >
                      {item.tenantName.charAt(0)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.tenantName}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.condominiumName} · {item.aptUnit} · {item.daysOverdue} dias em atraso</p>
                    </span>
                    <span className="text-sm font-bold shrink-0" style={{ color: 'hsl(var(--overdue))' }}>{formatCurrency(item.totalOverdue)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {overdueItems.length > OVERDUE_PREVIEW_COUNT && (
              <button
                onClick={() => setShowAllOverdue(v => !v)}
                className="w-full px-4 py-2.5 border-t border-border text-xs font-semibold text-primary hover:bg-muted/50 transition-colors"
              >
                {showAllOverdue ? 'Ver menos' : `Ver mais (${overdueItems.length - OVERDUE_PREVIEW_COUNT})`}
              </button>
            )}
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Atalhos</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {modules.map(mod => (
              <button
                key={mod.path}
                onClick={() => navigate(mod.path)}
                className="bg-card rounded-xl border border-border p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5" style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                  <mod.icon className="w-[18px] h-[18px]" />
                </div>
                <p className="text-sm font-bold leading-tight">{mod.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{mod.sub}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
