import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Home, TrendingUp, TrendingDown, DollarSign, Pencil, Trash2, ArrowUpDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, MONTHS, YEARS, getRecordStatus, getPeriodAndDueDate } from '@/lib/utils-app';
import { useApp } from '@/lib/store';
import GlobalFilter from '@/components/GlobalFilter';
import Layout from '@/components/Layout';
import { useCondominiums, useAddCondominium, useUpdateCondominium, useDeleteCondominium, CondominiumDB } from '@/hooks/useCondominiums';
import { useApartments } from '@/hooks/useApartments';
import { useAllFinancialRecords, FinancialRecordDB, calcReceived, calcOwed } from '@/hooks/useFinancial';
import { useContracts } from '@/hooks/useContracts';
import { useTenants } from '@/hooks/useTenants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

function getStatus(
  record: FinancialRecordDB,
  paymentDay?: number | null,
  contractStartDate?: string | null,
  desiredPaymentDay?: number | null,
  desiredPaymentDate?: string | null
): 'paid' | 'overdue' | 'pending' {
  if (record.paid) return 'paid';
  return getRecordStatus(record.month, paymentDay, contractStartDate, desiredPaymentDay, desiredPaymentDate);
}

// Extrai o mês (YYYY-MM) da data de vencimento de um registro
function getDueDateMonth(record: FinancialRecordDB, contract?: { start_date?: string | null; payment_day?: number | null; desired_payment_day?: number | null; desired_payment_date?: string | null } | null): string | null {
  if (!contract) return null;
  const { dueDateLabel } = getPeriodAndDueDate(record.month, contract.start_date ?? null, contract.payment_day ?? 1, contract.desired_payment_day, contract.desired_payment_date);
  // dueDateLabel formato: "DD/MM/YYYY"
  if (!dueDateLabel || dueDateLabel === '-') return null;
  const parts = dueDateLabel.split('/');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1]}`; // YYYY-MM
}

function CondominiumModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: CondominiumDB }) {
  const addCond = useAddCondominium();
  const updateCond = useUpdateCondominium();
  const [name, setName] = useState(initial?.name ?? '');
  async function handleSave() {
    if (!name) return;
    if (initial) { await updateCond.mutateAsync({ id: initial.id, name }); }
    else { await addCond.mutateAsync(name); }
    onClose();
  }
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial ? 'Editar Condomínio' : 'Novo Condomínio'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Nome *</Label>
            <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="Residencial Alfa" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={addCond.isPending || updateCond.isPending}>
            {initial ? 'Salvar' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ModalSortField = 'condo' | 'apt' | 'date';
type ModalSortDir = 'asc' | 'desc';

function DetailModal({ open, onClose, title, records, tenants, apartments, condominiums, variant }: {
  open: boolean; onClose: () => void; title: string;
  records: (FinancialRecordDB & { computedStatus: string })[]; tenants: { id: string; first_name: string; last_name: string }[];
  apartments: { id: string; unit_number: string; condominium_id: string }[]; condominiums: { id: string; name: string }[];
  variant: 'pending' | 'overdue' | 'received' | 'debt';
}) {
  const [sortField, setSortField] = useState<ModalSortField | null>(null);
  const [sortDir, setSortDir] = useState<ModalSortDir>('asc');
  const { data: contracts = [] } = useContracts();

  function toggleSort(field: ModalSortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  // Converte DD/MM/YYYY para YYYY-MM-DD para ordenação correta
  function parseDateForSort(dateStr: string): string {
    if (!dateStr || dateStr === '-') return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [d, m, y] = dateStr.split('/');
      return `${y}-${m}-${d}`;
    }
    return dateStr; // já em YYYY-MM-DD
  }

  const enriched = records.map(r => {
    const apt = apartments.find(a => a.id === r.apartment_id);
    const condo = apt ? condominiums.find(c => c.id === apt.condominium_id) : null;
    const contract = contracts.find(ct => ct.id === r.contract_id);
    let dateCol: string;
    if (variant === 'received' || variant === 'debt') {
      dateCol = r.payment_date ?? '-';
    } else {
      const { dueDateLabel } = getPeriodAndDueDate(r.month, contract?.start_date ?? null, contract?.payment_day ?? 1, contract?.desired_payment_day, contract?.desired_payment_date);
      dateCol = dueDateLabel;
    }
    return { ...r, apt, condo, dateCol };
  });

  const sorted = sortField ? [...enriched].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'condo') cmp = (a.condo?.name ?? '').localeCompare(b.condo?.name ?? '');
    else if (sortField === 'apt') cmp = (a.apt?.unit_number ?? '').localeCompare(b.apt?.unit_number ?? '', undefined, { numeric: true });
    else if (sortField === 'date') cmp = parseDateForSort(a.dateCol).localeCompare(parseDateForSort(b.dateCol));
    return sortDir === 'asc' ? cmp : -cmp;
  }) : enriched;

  const lastColLabel = variant === 'received' || variant === 'debt' ? 'Data Pagamento' : 'Vencimento';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {sorted.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum registro encontrado.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('condo')}>
                      Condomínio <ArrowUpDown className={`w-3 h-3 ${sortField === 'condo' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                    </button>
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('apt')}>
                      Apto <ArrowUpDown className={`w-3 h-3 ${sortField === 'apt' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                    </button>
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Inquilino</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Valor</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('date')}>
                      {lastColLabel} <ArrowUpDown className={`w-3 h-3 ${sortField === 'date' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => {
                  const t = tenants.find(t => t.id === r.tenant_id);
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{r.condo?.name ?? '-'}</td>
                      <td className="px-3 py-2">{r.apt?.unit_number ?? '-'}</td>
                      <td className="px-3 py-2">{t ? `${t.first_name} ${t.last_name}` : '-'}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatCurrency(variant === 'received' ? calcReceived(r) : variant === 'debt' ? calcOwed(r) : r.rent_value)}</td>
                      <td className="px-3 py-2 text-center text-xs">{r.dateCol}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { state } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [editCond, setEditCond] = useState<CondominiumDB | null>(null);
  const [deleteCond, setDeleteCond] = useState<CondominiumDB | null>(null);
  const [pendingModal, setPendingModal] = useState(false);
  const [overdueModal, setOverdueModal] = useState(false);
  const [receivedModal, setReceivedModal] = useState(false);
  const [debtModal, setDebtModal] = useState(false);

  const { data: condominiums = [], isLoading: loadingConds } = useCondominiums();
  const { data: apartments = [] } = useApartments();
  const { data: financialRecords = [] } = useAllFinancialRecords();
  const { data: contracts = [] } = useContracts();
  const { data: allTenants = [] } = useTenants();
  const deleteCondo = useDeleteCondominium();

  const { selectedYear, selectedMonth } = state;

  const [chartYear, setChartYear] = useState(String(selectedYear));
  const [chartCondo, setChartCondo] = useState<string>('all');

  // Filtro de mês selecionado no formato YYYY-MM
  const selectedMonthKey = selectedMonth !== null
    ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
    : null;

  // Mapa apartment_id → contrato ativo (do inquilino atual, sem archived_at)
  // Resolve o caso de registros com contract_id=null ou tenant_id=null
  const contractByApartment = new Map<string, typeof contracts[0]>();
  for (const tenant of allTenants) {
    if (!tenant.apartment_id) continue;
    const c = contracts.find(ct => ct.tenant_id === tenant.id);
    if (c) contractByApartment.set(tenant.apartment_id, c);
  }

  // Enriquecer registros e descartar os anteriores ao contrato atual
  const enrichedRecords = financialRecords.flatMap(r => {
    const contract =
      (r.contract_id ? contracts.find(c => c.id === r.contract_id) : undefined) ??
      contractByApartment.get(r.apartment_id);

    // Descarta meses anteriores ao início do contrato atual do apartamento
    if (contract?.start_date) {
      if (r.month < contract.start_date.substring(0, 7)) return [];
    }

    const status = getStatus(r, contract?.payment_day, contract?.start_date, contract?.desired_payment_day, contract?.desired_payment_date);
    const dueDateMonth = getDueDateMonth(r, contract);
    const paymentMonth = r.payment_date ? r.payment_date.substring(0, 7) : null;
    return [{ ...r, computedStatus: status, dueDateMonth, paymentMonth }];
  });

  // Receita Recebida: filtrar pelo mês em que o pagamento foi feito (payment_date)
  const receivedRecords = enrichedRecords.filter(r => {
    if (!r.paid || !r.paymentMonth) return false;
    if (selectedMonthKey) return r.paymentMonth === selectedMonthKey;
    return r.paymentMonth.startsWith(String(selectedYear));
  });

  // A Receber: filtrar pelo mês de vencimento
  const pendingRecords = enrichedRecords.filter(r => {
    if (r.computedStatus !== 'pending') return false;
    if (selectedMonthKey) return r.dueDateMonth === selectedMonthKey;
    return r.dueDateMonth?.startsWith(String(selectedYear)) ?? false;
  });

  // Inadimplente: filtrar pelo mês de vencimento
  const overdueRecords = enrichedRecords.filter(r => {
    if (r.computedStatus !== 'overdue') return false;
    if (selectedMonthKey) return r.dueDateMonth === selectedMonthKey;
    return r.dueDateMonth?.startsWith(String(selectedYear)) ?? false;
  });

  const totalReceived = receivedRecords.reduce((s, r) => s + calcReceived(r), 0);
  const totalPending = pendingRecords.reduce((s, r) => s + r.rent_value, 0);
  const totalOverdue = overdueRecords.reduce((s, r) => s + r.rent_value, 0);

  // Devendo: registros pagos parcialmente (paid=true mas paid_amount < rent_value)
  // Filtra pelo mês do pagamento, igual ao Recebido
  const debtRecords = enrichedRecords.filter(r => {
    if (!r.paid || !r.paymentMonth) return false;
    const owed = calcOwed(r);
    if (owed <= 0) return false;
    if (selectedMonthKey) return r.paymentMonth === selectedMonthKey;
    return r.paymentMonth.startsWith(String(selectedYear));
  });
  const totalOwed = debtRecords.reduce((s, r) => s + calcOwed(r), 0);

  // Gráfico mensal
  const chartData = MONTHS.map((month, idx) => {
    const monthKey = `${chartYear}-${String(idx + 1).padStart(2, '0')}`;
    const matchCondo = (r: typeof enrichedRecords[0]) =>
      chartCondo === 'all' || apartments.find(a => a.id === r.apartment_id)?.condominium_id === chartCondo;

    const rec = enrichedRecords.filter(r => r.paid && r.paymentMonth === monthKey && matchCondo(r)).reduce((s, r) => s + calcReceived(r), 0);
    const pend = enrichedRecords.filter(r => r.computedStatus === 'pending' && r.dueDateMonth === monthKey && matchCondo(r)).reduce((s, r) => s + r.rent_value, 0);
    const over = enrichedRecords.filter(r => r.computedStatus === 'overdue' && r.dueDateMonth === monthKey && matchCondo(r)).reduce((s, r) => s + r.rent_value, 0);
    return { month: month.substring(0, 3), receita: rec, aReceber: pend, inadimplente: over };
  });

  const filterLabel = selectedMonth !== null ? MONTHS[selectedMonth] : 'Ano';

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground text-sm">Visão geral financeira e de imóveis</p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <GlobalFilter />
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="w-4 h-4 mr-2" /> Adicionar Condomínio
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:hidden">
            <div className="flex-1"><GlobalFilter /></div>
            <Button onClick={() => setShowAdd(true)} size="sm" className="shrink-0">
              <Plus className="w-4 h-4 mr-1" /> Cond.
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
          <div className="stat-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setReceivedModal(true)}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Receita Recebida</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--paid)/0.12)' }}>
                <TrendingUp className="w-4 h-4" style={{ color: 'hsl(var(--paid))' }} />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-bold" style={{ color: 'hsl(var(--paid))' }}>{formatCurrency(totalReceived)}</p>
            <p className="text-xs text-muted-foreground mt-1">Clique para detalhes · {filterLabel} {selectedYear}</p>
          </div>

          <div className="stat-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setPendingModal(true)}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">A Receber</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--warning)/0.12)' }}>
                <DollarSign className="w-4 h-4" style={{ color: 'hsl(var(--warning))' }} />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-bold" style={{ color: 'hsl(var(--warning))' }}>{formatCurrency(totalPending)}</p>
            <p className="text-xs text-muted-foreground mt-1">Clique para detalhes · {filterLabel} {selectedYear}</p>
          </div>

          <div className="stat-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setOverdueModal(true)}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Inadimplente</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--overdue)/0.12)' }}>
                <TrendingDown className="w-4 h-4" style={{ color: 'hsl(var(--overdue))' }} />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-bold" style={{ color: 'hsl(var(--overdue))' }}>{formatCurrency(totalOverdue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Clique para detalhes · {filterLabel} {selectedYear}</p>
          </div>

          <div className="stat-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDebtModal(true)}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Devendo</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--overdue)/0.12)' }}>
                <AlertTriangle className="w-4 h-4" style={{ color: 'hsl(var(--overdue))' }} />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-bold" style={{ color: totalOwed > 0 ? 'hsl(var(--overdue))' : 'hsl(var(--paid))' }}>{formatCurrency(totalOwed)}</p>
            <p className="text-xs text-muted-foreground mt-1">Clique para detalhes · {filterLabel} {selectedYear}</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Apartamentos</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
                <Home className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-bold">{apartments.length}</p>
            <p className="text-xs text-muted-foreground mt-1">em {condominiums.length} condomínio(s)</p>
          </div>
        </div>

        {/* Grouped Bar Chart */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Receita Mensal - {chartYear}</h2>
            <div className="flex items-center gap-2">
              <Select value={chartCondo} onValueChange={setChartCondo}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {condominiums.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={chartYear} onValueChange={setChartYear}>
                <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={2} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <RechartsTooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="receita" name="Receita" fill="hsl(142, 71%, 45%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="aReceber" name="A Receber" fill="hsl(38, 92%, 50%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="inadimplente" name="Inadimplente" fill="hsl(0, 84%, 60%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Condominiums grid */}
        <div>
          <h2 className="text-base font-semibold mb-3">Condomínios</h2>
          {loadingConds ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : condominiums.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
              <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum condomínio cadastrado</p>
              <Button className="mt-4" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" /> Adicionar</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {condominiums.map(cond => {
                const condApts = apartments.filter(a => a.condominium_id === cond.id);
                const condReceived = receivedRecords
                  .filter(r => condApts.some(a => a.id === r.apartment_id))
                  .reduce((s, r) => s + calcReceived(r), 0);
                return (
                  // CARD INTEIRO clicável
                  <div
                    key={cond.id}
                    className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/condominiums/${cond.id}`)}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); setEditCond(cond); }}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteCond(cond); }}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-semibold text-base">{cond.name}</h3>
                      <div className="flex items-center justify-between mt-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Apartamentos</p>
                          <p className="font-semibold">{condApts.length}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Receita</p>
                          <p className="font-semibold" style={{ color: 'hsl(var(--paid))' }}>{formatCurrency(condReceived)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-border px-5 py-3">
                      <span className="text-sm text-primary font-medium">Ver apartamentos &rsaquo;</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <DetailModal
        open={debtModal}
        onClose={() => setDebtModal(false)}
        title={`Devendo — ${filterLabel} ${selectedYear}`}
        records={debtRecords}
        tenants={allTenants}
        apartments={apartments}
        condominiums={condominiums}
        variant="debt"
      />

      <CondominiumModal open={showAdd} onClose={() => setShowAdd(false)} />
      {editCond && <CondominiumModal open={!!editCond} onClose={() => setEditCond(null)} initial={editCond} />}

      <AlertDialog open={!!deleteCond} onOpenChange={() => setDeleteCond(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Condomínio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteCond?.name}</strong>? Todos os apartamentos e dados vinculados serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await deleteCondo.mutateAsync(deleteCond!.id); setDeleteCond(null); }} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DetailModal open={pendingModal} onClose={() => setPendingModal(false)} title={`A Receber - ${filterLabel} ${selectedYear}`} records={pendingRecords} tenants={allTenants} apartments={apartments} condominiums={condominiums} variant="pending" />
      <DetailModal open={overdueModal} onClose={() => setOverdueModal(false)} title={`Inadimplentes - ${filterLabel} ${selectedYear}`} records={overdueRecords} tenants={allTenants} apartments={apartments} condominiums={condominiums} variant="overdue" />
      <DetailModal open={receivedModal} onClose={() => setReceivedModal(false)} title={`Receita Recebida - ${filterLabel} ${selectedYear}`} records={receivedRecords} tenants={allTenants} apartments={apartments} condominiums={condominiums} variant="received" />
    </Layout>
  );
}
