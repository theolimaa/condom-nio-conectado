import { useState } from 'react';
import { TrendingUp, DollarSign, TrendingDown, CheckCircle, XCircle, AlertCircle, Receipt, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { formatCurrency, MONTHS, YEARS } from '@/lib/utils-app';
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
  if (year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth() + 1)) {
    return 'overdue';
  }
  return 'pending';
}

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

  // Build enriched records
  const enriched = financialRecords.map(r => {
    const apt = apartments.find(a => a.id === r.apartment_id);
    const condo = apt ? condominiums.find(c => c.id === apt.condominium_id) : null;
    const tenant = allTenants.find(t => t.id === r.tenant_id);
    const contract = contracts.find(c => c.id === r.contract_id);
    const status = getStatus(r);
    return { ...r, apt, condo, tenant, contract, computedStatus: status };
  });

  // Apply filters
  const filtered = enriched.filter(r => {
    const [y, m] = r.month.split('-').map(Number);
    if (y !== Number(filterYear)) return false;
    if (filterMonth !== 'all' && m - 1 !== Number(filterMonth)) return false;
    if (filterCondo !== 'all' && r.condo?.id !== filterCondo) return false;
    if (filterStatus !== 'all') {
      if (filterStatus === 'paid' && r.computedStatus !== 'paid') return false;
      if (filterStatus === 'pending' && r.computedStatus !== 'pending') return false;
      if (filterStatus === 'overdue' && r.computedStatus !== 'overdue') return false;
    }
    return true;
  }).sort((a, b) => a.month.localeCompare(b.month));

  const totalToReceive = filtered.filter(r => !r.paid).reduce((s, r) => s + r.rent_value, 0);
  const totalReceived = filtered.filter(r => r.paid).reduce((s, r) => s + r.rent_value, 0);
  const totalOverdue = filtered.filter(r => r.computedStatus === 'overdue').reduce((s, r) => s + r.rent_value, 0);

  async function updatePaymentDate(record: FinancialRecordDB, date: string) {
    const paid = !!date;
    await upsert.mutateAsync({
      ...record,
      paid,
      payment_date: date || null,
      status: paid ? 'Pago' : 'Pendente',
    });
  }

  async function togglePaid(record: FinancialRecordDB) {
    const nowPaid = !record.paid;
    await upsert.mutateAsync({
      ...record,
      paid: nowPaid,
      payment_date: nowPaid ? new Date().toISOString().split('T')[0] : null,
      status: nowPaid ? 'Pago' : 'Pendente',
    });
  }

  // For receipt modal
  const receiptApt = receiptRecord ? apartments.find(a => a.id === receiptRecord.apartment_id) : null;
  const receiptTenant = receiptRecord ? allTenants.find(t => t.id === receiptRecord.tenant_id) : null;
  const receiptContract = receiptRecord ? contracts.find(c => c.id === receiptRecord.contract_id) : null;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground text-sm">Painel de controle de recebimentos</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Total a Receber</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--warning)/0.12)' }}>
                <DollarSign className="w-4 h-4" style={{ color: 'hsl(var(--warning))' }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--warning))' }}>{formatCurrency(totalToReceive)}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Total Recebido</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--paid)/0.12)' }}>
                <TrendingUp className="w-4 h-4" style={{ color: 'hsl(var(--paid))' }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--paid))' }}>{formatCurrency(totalReceived)}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Total Inadimplente</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--overdue)/0.12)' }}>
                <TrendingDown className="w-4 h-4" style={{ color: 'hsl(var(--overdue))' }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--overdue))' }}>{formatCurrency(totalOverdue)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-24 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
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

        {/* Master table */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-muted-foreground">Nenhum registro encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Condomínio</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Apto</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Inquilino</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Período Ref.</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Data Pagamento</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const [y, m] = r.month.split('-').map(Number);
                  const paymentDay = r.contract?.payment_day ?? 1;
                  const startDay = String(paymentDay).padStart(2, '0');
                  const nextMonth = m === 12 ? 1 : m + 1;
                  const nextYear = m === 12 ? y + 1 : y;
                  const periodLabel = `${startDay}/${String(m).padStart(2, '0')}/${y} a ${startDay}/${String(nextMonth).padStart(2, '0')}/${nextYear}`;

                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">{r.condo?.name ?? '—'}</td>
                      <td className="px-4 py-3 font-medium">{r.apt?.unit_number ?? '—'}</td>
                      <td className="px-4 py-3">
                        {r.tenant ? `${r.tenant.first_name} ${r.tenant.last_name}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">{periodLabel}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.rent_value)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => togglePaid(r)} className="cursor-pointer">
                          {r.computedStatus === 'paid' && <span className="badge-paid"><CheckCircle className="w-3 h-3" /> Pago</span>}
                          {r.computedStatus === 'pending' && <span className="badge-unpaid">Pendente</span>}
                          {r.computedStatus === 'overdue' && <span className="badge-overdue"><AlertCircle className="w-3 h-3" /> Inadimplente</span>}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Input
                          type="date"
                          className="h-7 w-36 text-xs mx-auto"
                          value={r.payment_date ?? ''}
                          onChange={e => updatePaymentDate(r, e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setReceiptRecord(r)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors"
                          title="Gerar recibo PDF"
                          style={{ color: 'hsl(var(--primary))' }}
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
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
