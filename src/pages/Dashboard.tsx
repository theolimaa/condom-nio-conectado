import { useState } from ‘react’;
import { useNavigate } from ‘react-router-dom’;
import { Plus, Building2, Home, TrendingUp, TrendingDown, DollarSign, Pencil, Trash2, ArrowUpDown } from ‘lucide-react’;
import { Button } from ‘@/components/ui/button’;
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from ‘@/components/ui/dialog’;
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from ‘@/components/ui/alert-dialog’;
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from ‘@/components/ui/select’;
import { Input } from ‘@/components/ui/input’;
import { Label } from ‘@/components/ui/label’;
import { formatCurrency, MONTHS, YEARS, getRecordStatus, getPeriodAndDueDate } from ‘@/lib/utils-app’;
import { useApp } from ‘@/lib/store’;
import GlobalFilter from ‘@/components/GlobalFilter’;
import Layout from ‘@/components/Layout’;
import { useCondominiums, useAddCondominium, useUpdateCondominium, useDeleteCondominium, CondominiumDB } from ‘@/hooks/useCondominiums’;
import { useApartments } from ‘@/hooks/useApartments’;
import { useAllFinancialRecords, FinancialRecordDB } from ‘@/hooks/useFinancial’;
import { useContracts } from ‘@/hooks/useContracts’;
import { useTenants } from ‘@/hooks/useTenants’;
import {
BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from ‘recharts’;

function getStatus(record: FinancialRecordDB, paymentDay?: number | null): ‘paid’ | ‘overdue’ | ‘pending’ {
if (record.paid) return ‘paid’;
return getRecordStatus(record.month, paymentDay);
}

function CondominiumModal({ open, onClose, initial }: {
open: boolean; onClose: () => void; initial?: CondominiumDB;
}) {
const addCond = useAddCondominium();
const updateCond = useUpdateCondominium();
const [name, setName] = useState(initial?.name ?? ‘’);

async function handleSave() {
if (!name) return;
if (initial) {
await updateCond.mutateAsync({ id: initial.id, name });
} else {
await addCond.mutateAsync(name);
}
onClose();
}

return (
<Dialog open={open} onOpenChange={onClose}>
<DialogContent className="max-w-md">
<DialogHeader>
<DialogTitle>{initial ? ‘Editar Condomínio’ : ‘Novo Condomínio’}</DialogTitle>
</DialogHeader>
<div className="space-y-4 py-2">
<div>
<Label>Nome *</Label>
<Input className=“mt-1” value={name} onChange={e => setName(e.target.value)} placeholder=“Residencial Alfa” />
</div>
</div>
<DialogFooter>
<Button variant="outline" onClick={onClose}>Cancelar</Button>
<Button onClick={handleSave} disabled={addCond.isPending || updateCond.isPending}>
{initial ? ‘Salvar’ : ‘Adicionar’}
</Button>
</DialogFooter>
</DialogContent>
</Dialog>
);
}

// Detail modal for clickable cards with sorting and Condomínio column
type ModalSortField = ‘condo’ | ‘apt’;
type ModalSortDir = ‘asc’ | ‘desc’;

function DetailModal({ open, onClose, title, records, tenants, apartments, condominiums, variant }: {
open: boolean; onClose: () => void; title: string;
records: (FinancialRecordDB & { computedStatus: string })[];
tenants: { id: string; first_name: string; last_name: string }[];
apartments: { id: string; unit_number: string; condominium_id: string }[];
condominiums: { id: string; name: string }[];
variant: ‘pending’ | ‘overdue’ | ‘received’;
}) {
const [sortField, setSortField] = useState<ModalSortField | null>(null);
const [sortDir, setSortDir] = useState<ModalSortDir>(‘asc’);
const { data: contracts = [] } = useContracts();

function toggleSort(field: ModalSortField) {
if (sortField === field) setSortDir(d => d === ‘asc’ ? ‘desc’ : ‘asc’);
else { setSortField(field); setSortDir(‘asc’); }
}

const enriched = records.map(r => {
const apt = apartments.find(a => a.id === r.apartment_id);
const condo = apt ? condominiums.find(c => c.id === apt.condominium_id) : null;
return { …r, apt, condo };
});

const sorted = sortField ? […enriched].sort((a, b) => {
let cmp = 0;
if (sortField === ‘condo’) cmp = (a.condo?.name ?? ‘’).localeCompare(b.condo?.name ?? ‘’);
else cmp = (a.apt?.unit_number ?? ‘’).localeCompare(b.apt?.unit_number ?? ‘’, undefined, { numeric: true });
return sortDir === ‘asc’ ? cmp : -cmp;
}) : enriched;

const lastColLabel = variant === ‘pending’ ? ‘Data de Vencimento’ : variant === ‘overdue’ ? ‘Vencimento Inadimplente’ : ‘Data Pagamento’;

return (
<Dialog open={open} onOpenChange={onClose}>
<DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
<DialogHeader>
<DialogTitle>{title}</DialogTitle>
</DialogHeader>
{sorted.length === 0 ? (
<p className="text-muted-foreground text-center py-8">Nenhum registro encontrado.</p>
) : (
<div className="overflow-x-auto rounded-lg border border-border">
<table className="w-full text-sm">
<thead>
<tr className="bg-muted/50 border-b border-border">
<th className="text-left px-3 py-2 font-medium text-muted-foreground">
<button className=“inline-flex items-center gap-1” onClick={() => toggleSort(‘condo’)}>
Condomínio <ArrowUpDown className={`w-3 h-3 ${sortField === 'condo' ? 'text-primary' : 'text-muted-foreground/50'}`} />
</button>
</th>
<th className="text-left px-3 py-2 font-medium text-muted-foreground">
<button className=“inline-flex items-center gap-1” onClick={() => toggleSort(‘apt’)}>
Apto <ArrowUpDown className={`w-3 h-3 ${sortField === 'apt' ? 'text-primary' : 'text-muted-foreground/50'}`} />
</button>
</th>
<th className="text-left px-3 py-2 font-medium text-muted-foreground">Inquilino</th>
<th className="text-right px-3 py-2 font-medium text-muted-foreground">Valor</th>
<th className="text-center px-3 py-2 font-medium text-muted-foreground">{lastColLabel}</th>
</tr>
</thead>
<tbody>
{sorted.map(r => {
const t = tenants.find(t => t.id === r.tenant_id);
let dateCol: string;
if (variant === ‘received’) {
dateCol = r.payment_date ?? ‘—’;
} else if (variant === ‘overdue’) {
const contract = contracts.find(ct => ct.id === r.contract_id);
const { dueDateLabel } = getPeriodAndDueDate(r.month, contract?.start_date ?? null, contract?.payment_day ?? 1);
dateCol = dueDateLabel;
} else {
const contract = contracts.find(ct => ct.id === r.contract_id);
const { dueDateLabel } = getPeriodAndDueDate(r.month, contract?.start_date ?? null, contract?.payment_day ?? 1);
dateCol = dueDateLabel;
}
return (
<tr key={r.id} className="border-b border-border last:border-0">
<td className="px-3 py-2">{r.condo?.name ?? ‘—’}</td>
<td className="px-3 py-2">{r.apt?.unit_number ?? ‘—’}</td>
<td className="px-3 py-2">{t ? `${t.first_name} ${t.last_name}` : ‘—’}</td>
<td className="px-3 py-2 text-right font-semibold">{formatCurrency(r.rent_value)}</td>
<td className="px-3 py-2 text-center text-xs">{dateCol}</td>
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

const { data: condominiums = [], isLoading: loadingConds } = useCondominiums();
const { data: apartments = [] } = useApartments();
const { data: financialRecords = [] } = useAllFinancialRecords();
const { data: contracts = [] } = useContracts();
const { data: allTenants = [] } = useTenants();
const deleteCondo = useDeleteCondominium();

const { selectedYear, selectedMonth } = state;

// Chart-specific filters
const [chartYear, setChartYear] = useState(String(selectedYear));
const [chartCondo, setChartCondo] = useState<string>(‘all’);

// Enrich records with computed status
const enrichedRecords = financialRecords.map(r => {
const contract = contracts.find(c => c.id === r.contract_id);
return { …r, computedStatus: getStatus(r, contract?.payment_day) };
});

// Current month key for filtering
const now = new Date();
const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

// Filtered records based on global filter (year/month)
const filteredRecords = enrichedRecords.filter(r => {
const [year, month] = r.month.split(’-’).map(Number);
return year === selectedYear && (selectedMonth === null || month - 1 === selectedMonth);
});

// Card values — all scoped to the filtered period
const totalReceived = filteredRecords.filter(r => r.paid).reduce((s, r) => s + r.rent_value, 0);
const totalPending = filteredRecords.filter(r => r.computedStatus === ‘pending’).reduce((s, r) => s + r.rent_value, 0);
// Inadimplente: only current filtered period, NOT all history
const totalOverdue = filteredRecords.filter(r => r.computedStatus === ‘overdue’).reduce((s, r) => s + r.rent_value, 0);

// Records for modals
const pendingRecords = filteredRecords.filter(r => r.computedStatus === ‘pending’);
const overdueRecords = filteredRecords.filter(r => r.computedStatus === ‘overdue’);
const receivedRecords = filteredRecords.filter(r => r.paid);

// Grouped bar chart data
const chartData = MONTHS.map((month, idx) => {
const monthRecords = enrichedRecords.filter(r => {
const [y, m] = r.month.split(’-’).map(Number);
const matchYear = y === Number(chartYear);
const matchMonth = m - 1 === idx;
const matchCondo = chartCondo === ‘all’ || apartments.find(a => a.id === r.apartment_id)?.condominium_id === chartCondo;
return matchYear && matchMonth && matchCondo;
});
return {
month: month.substring(0, 3),
receita: monthRecords.filter(r => r.paid).reduce((s, r) => s + r.rent_value, 0),
aReceber: monthRecords.filter(r => r.computedStatus === ‘pending’).reduce((s, r) => s + r.rent_value, 0),
inadimplente: monthRecords.filter(r => r.computedStatus === ‘overdue’).reduce((s, r) => s + r.rent_value, 0),
};
});

const filterLabel = selectedMonth !== null ? MONTHS[selectedMonth] : ‘Ano’;

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
{/* Desktop */}
<div className="hidden sm:flex items-center gap-2">
<GlobalFilter />
<Button onClick={() => setShowAdd(true)}>
<Plus className="w-4 h-4 mr-2" /> Adicionar Condomínio
</Button>
</div>
</div>
{/* Mobile: filtro + botão compacto */}
<div className="flex items-center gap-2 sm:hidden">
<div className="flex-1"><GlobalFilter /></div>
<Button onClick={() => setShowAdd(true)} size=“sm” className=“shrink-0”>
<Plus className="w-4 h-4 mr-1" /> Cond.
</Button>
</div>
</div>

```
    {/* Stat cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      <div
        className="stat-card cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setReceivedModal(true)}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">Receita Recebida</p>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--paid)/0.12)' }}>
            <TrendingUp className="w-4 h-4" style={{ color: 'hsl(var(--paid))' }} />
          </div>
        </div>
        <p className="text-xl md:text-2xl font-bold" style={{ color: 'hsl(var(--paid))' }}>{formatCurrency(totalReceived)}</p>
        <p className="text-xs text-muted-foreground mt-1">Clique para detalhes • {filterLabel} {selectedYear}</p>
      </div>
      <div
        className="stat-card cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setPendingModal(true)}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">A Receber</p>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--warning)/0.12)' }}>
            <DollarSign className="w-4 h-4" style={{ color: 'hsl(var(--warning))' }} />
          </div>
        </div>
        <p className="text-xl md:text-2xl font-bold" style={{ color: 'hsl(var(--warning))' }}>{formatCurrency(totalPending)}</p>
        <p className="text-xs text-muted-foreground mt-1">Clique para detalhes • {filterLabel} {selectedYear}</p>
      </div>
      <div
        className="stat-card cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setOverdueModal(true)}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">Inadimplente</p>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--overdue)/0.12)' }}>
            <TrendingDown className="w-4 h-4" style={{ color: 'hsl(var(--overdue))' }} />
          </div>
        </div>
        <p className="text-xl md:text-2xl font-bold" style={{ color: 'hsl(var(--overdue))' }}>{formatCurrency(totalOverdue)}</p>
        <p className="text-xs text-muted-foreground mt-1">Clique para detalhes • {filterLabel} {selectedYear}</p>
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
        <h2 className="text-base font-semibold">Receita Mensal — {chartYear}</h2>
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
          <RechartsTooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          />
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
            const condRecords = filteredRecords.filter(r =>
              condApts.some(a => a.id === r.apartment_id)
            );
            const condReceived = condRecords.filter(r => r.paid).reduce((s, r) => s + r.rent_value, 0);

            return (
              <div key={cond.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow">
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
                  <button
                    onClick={() => navigate(`/condominiums/${cond.id}`)}
                    className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                  >
                    Ver apartamentos →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>

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
        <AlertDialogAction
          onClick={async () => {
            await deleteCondo.mutateAsync(deleteCond!.id);
            setDeleteCond(null);
          }}
          className="bg-destructive hover:bg-destructive/90"
        >
          Excluir
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  {/* Pending Modal */}
  <DetailModal
    open={pendingModal}
    onClose={() => setPendingModal(false)}
    title={`A Receber — ${filterLabel} ${selectedYear}`}
    records={pendingRecords}
    tenants={allTenants}
    apartments={apartments}
    condominiums={condominiums}
    variant="pending"
  />

  {/* Overdue Modal */}
  <DetailModal
    open={overdueModal}
    onClose={() => setOverdueModal(false)}
    title={`Inadimplentes — ${filterLabel} ${selectedYear}`}
    records={overdueRecords}
    tenants={allTenants}
    apartments={apartments}
    condominiums={condominiums}
    variant="overdue"
  />

  {/* Received Modal */}
  <DetailModal
    open={receivedModal}
    onClose={() => setReceivedModal(false)}
    title={`Receita Recebida — ${filterLabel} ${selectedYear}`}
    records={receivedRecords}
    tenants={allTenants}
    apartments={apartments}
    condominiums={condominiums}
    variant="received"
  />
</Layout>
```

);
}
