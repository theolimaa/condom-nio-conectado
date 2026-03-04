import { useState } from 'react';
import { TrendingUp, DollarSign, TrendingDown, CheckCircle, AlertCircle, Receipt, Loader2, ArrowUpDown, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency, MONTHS, YEARS, getPeriodAndDueDate } from '@/lib/utils-app';
import Layout from '@/components/Layout';
import { useCondominiums } from '@/hooks/useCondominiums';
import { useApartments } from '@/hooks/useApartments';
import { useTenants } from '@/hooks/useTenants';
import { useAllFinancialRecords, useUpsertFinancialRecord, FinancialRecordDB } from '@/hooks/useFinancial';
import { useContracts } from '@/hooks/useContracts';
import ReceiptModalDB from '@/components/apartment/ReceiptModalDB';

function getStatus(record: FinancialRecordDB): 'paid' | 'overdue' | 'pending' {
  if (record.paid) return 'paid';
  const today = new Date();
  const [year, month] = record.month.split('-').map(Number);
  if (isNaN(year) || isNaN(month)) return 'pending';
  if (year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth() + 1)) return 'overdue';
  return 'pending';
}

type SortField = 'condo' | 'apt' | 'tenant' | 'period' | 'status' | 'payment_date';
type SortDir = 'asc' | 'desc';

export default function Financial() {
  const { data: condominiums = [] } = useCondominiums();
  const { data: apartments = [] } = useApartments();
  const { data: allTenants = [] } = useTenants();
  const { data: financialRecords = [], isLoading } = useAllFinancialRecords();
  const { data: contracts = [] } = useContracts();
  const upsert = useUpsertFinancialRecord();

  const [filterYear, setFilterYear] = useState('2026');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterCondo, setFilterCondo] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [receiptRecord, setReceiptRecord] = useState<FinancialRecordDB | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showFilters, setShowFilters] = useState(false);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  const enriched = financialRecords.map(r => {
    const apt = apartments.find(a => a.id === r.apartment_id);
    const condo = apt ? condominiums.find(c => c.id === apt.condominium_id) : null;
    const tenant = allTenants.find(t => t.id === r.tenant_id);
    const contract = contracts.find(c => c.id === r.contract_id);
    return { ...r, apt, condo, tenant, contract, computedStatus: getStatus(r) };
  });

  let filtered = enriched.filter(r => {
    const [y, m] = r.month.split('-').map(Number);
    if (y !== Number(filterYear)) return false;
    if (filterMonth !== 'all' && m - 1 !== Number(filterMonth)) return false;
    if (filterCondo !== 'all' && r.condo?.id !== filterCondo) return false;
    if (filterStatus !== 'all' && r.computedStatus !== filterStatus) return false;
    return true;
  });

  if (sortField) {
    filtered = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'condo': cmp = (a.condo?.name ?? '').localeCompare(b.condo?.name ?? ''); break;
        case 'apt': cmp = (a.apt?.unit_number ?? '').localeCompare(b.apt?.unit_number ?? '', undefined, { numeric: true }); break;
        case 'tenant': cmp = (`${a.tenant?.first_name} ${a.tenant?.last_name}`).localeCompare(`${b.tenant?.first_name} ${b.tenant?.last_name}`); break;
        case 'period': cmp = a.month.localeCompare(b.month); break;
        case 'status': cmp = a.computedStatus.localeCompare(b.computedStatus); break;
        case 'payment_date': cmp = (a.payment_date ?? '').localeCompare(b.payment_date ?? ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  } else {
    filtered.sort((a, b) => a.month.localeCompare(b.month));
  }

  const totalToReceive = filtered.filter(r => !r.paid).reduce((s, r) => s + r.rent_value, 0);
  const totalReceived = filtered.filter(r => r.paid).reduce((s, r) => s + r.rent_value, 0);
  const totalOverdue = filtered.filter(r => r.computedStatus === 'overdue').reduce((s, r) => s + r.rent_value, 0);

  async function updatePaymentDate(record: FinancialRecordDB, date: string) {
    const paid = !!date;
    await upsert.mutateAsync({ ...record, paid, payment_date: date || null, status: paid ? 'Pago' : 'Pendente' });
  }

  async function togglePaid(record: FinancialRecordDB) {
    const nowPaid = !record.paid;
    await upsert.mutateAsync({ ...record, paid: nowPaid, payment_date: nowPaid ? new Date().toISOString().split('T')[0] : null, status: nowPaid ? 'Pago' : 'Pendente' });
  }

  const receiptApt = receiptRecord ? apartments.find(a => a.id === receiptRecord.apartment_id) : null;
  const receiptTenant = receiptRecord ? allTenants.find(t => t.id === receiptRecord.tenant_id) : null;
  const receiptContract = receiptRecord ? contracts.find(c => c.id === receiptRecord.contract_id) : null;

  function SortHeader({ field, children }: { field: SortField; children: React.ReactNode }) {
    return (
      <button className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort(field)}>
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-primary' : 'text-muted-foreground/50'}`} />
      </button>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground text-sm">Painel de controle de recebimentos</p>
        </div>

        {/* Summary cards — 1 col mobile, 3 desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">A Receber</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--warning)/0.12)' }}>
                <DollarSign className="w-4 h-4" style={{ color: 'hsl(var(--warning))' }} />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-bold" style={{ color: 'hsl(var(--warning))' }}>{formatCurrency(totalToReceive)}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Recebido</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--paid)/0.12)' }}>
                <TrendingUp className="w-4 h-4" style={{ color: 'hsl(var(--paid))' }} />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-bold" style={{ color: 'hsl(var(--paid))' }}>{formatCurrency(totalReceived)}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Inadimplente</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--overdue)/0.12)' }}>
                <TrendingDown className="w-4 h-4" style={{ color: 'hsl(var(--overdue))' }} />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-bold" style={{ color: 'hsl(var(--overdue))' }}>{formatCurrency(totalOverdue)}</p>
          </div>
        </div>

        {/* Filtros — toggle em mobile */}
        <div>
          <Button
            variant="outline"
            size="sm"
            className="md:hidden mb-3 flex items-center gap-2"
            onClick={() => setShowFilters(f => !f)}
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Ocultar filtros' : 'Filtros'}
          </Button>
          <div className={`flex items-center gap-2 flex-wrap ${showFilters ? 'flex' : 'hidden md:flex'}`}>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-24 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCondo} onValueChange={setFilterCondo}>
              <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos condomínios</SelectItem>
                {condominiums.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="overdue">Inadimplente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Resultados */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-muted-foreground">Nenhum registro encontrado.</p>
          </div>
        ) : (
          <>
            {/* ── MOBILE: Cards ── */}
            <div className="md:hidden space-y-3">
              {filtered.map(r => {
                const paymentDay = r.contract?.payment_day ?? 1;
                const { periodLabel } = getPeriodAndDueDate(r.month, r.contract?.start_date ?? null, paymentDay);
                const tenantName = r.tenant ? `${r.tenant.first_name} ${r.tenant.last_name}` : '—';
                return (
                  <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{r.condo?.name ?? '—'} · Apto {r.apt?.unit_number ?? '—'}</p>
                        <p className="text-sm text-muted-foreground">{tenantName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{formatCurrency(r.rent_value)}</p>
                        <button onClick={() => togglePaid(r)} className="mt-1">
                          {r.computedStatus === 'paid' && <span className="badge-paid"><CheckCircle className="w-3 h-3" /> Pago</span>}
                          {r.computedStatus === 'pending' && <span className="badge-unpaid">Pendente</span>}
                          {r.computedStatus === 'overdue' && <span className="badge-overdue"><AlertCircle className="w-3 h-3" /> Inadimplente</span>}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-border">
                      <Input
                        type="date"
                        className="h-8 text-xs flex-1"
                        value={r.payment_date ?? ''}
                        onChange={e => updatePaymentDate(r, e.target.value)}
                      />
                      <button
                        onClick={() => setReceiptRecord(r)}
                        className="p-2 rounded-md hover:bg-muted transition-colors"
                        style={{ color: 'hsl(var(--primary))' }}
                      >
                        <Receipt className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── DESKTOP: Tabela ── */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground"><SortHeader field="condo">Condomínio</SortHeader></th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground"><SortHeader field="apt">Apto</SortHeader></th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground"><SortHeader field="tenant">Inquilino</SortHeader></th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground"><SortHeader field="period">Período Ref.</SortHeader></th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground"><SortHeader field="status">Status</SortHeader></th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground"><SortHeader field="payment_date">Data Pagamento</SortHeader></th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const paymentDay = r.contract?.payment_day ?? 1;
                    const { periodLabel, dueDateLabel } = getPeriodAndDueDate(r.month, r.contract?.start_date ?? null, paymentDay);
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">{r.condo?.name ?? '—'}</td>
                        <td className="px-4 py-3 font-medium">{r.apt?.unit_number ?? '—'}</td>
                        <td className="px-4 py-3">{r.tenant ? `${r.tenant.first_name} ${r.tenant.last_name}` : '—'}</td>
                        <td className="px-4 py-3 text-xs">{periodLabel}</td>
                        <td className="px-4 py-3 text-center text-xs">{dueDateLabel}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.rent_value)}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => togglePaid(r)}>
                            {r.computedStatus === 'paid' && <span className="badge-paid"><CheckCircle className="w-3 h-3" /> Pago</span>}
                            {r.computedStatus === 'pending' && <span className="badge-unpaid">Pendente</span>}
                            {r.computedStatus === 'overdue' && <span className="badge-overdue"><AlertCircle className="w-3 h-3" /> Inadimplente</span>}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Input type="date" className="h-7 w-36 text-xs mx-auto" value={r.payment_date ?? ''} onChange={e => updatePaymentDate(r, e.target.value)} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => setReceiptRecord(r)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Gerar recibo PDF" style={{ color: 'hsl(var(--primary))' }}>
                            <Receipt className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {receiptRecord && receiptApt && receiptTenant && (
        <ReceiptModalDB
          open={!!receiptRecord}
          onClose={() => setReceiptRecord(null)}
          record={receiptRecord}
          apartment={receiptApt}
          tenant={receiptTenant}
          contract={receiptContract ?? null}
          allRecords={financialRecords.filter(r => r.apartment_id === receiptRecord.apartment_id && r.tenant_id === receiptRecord.tenant_id)}
        />
      )}
    </Layout>
  );
}
