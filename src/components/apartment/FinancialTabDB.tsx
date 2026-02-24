import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Receipt, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/lib/store';
import { formatCurrency, MONTHS, YEARS, getPeriodAndDueDate } from '@/lib/utils-app';
import { useFinancialRecords, useUpsertFinancialRecord, FinancialRecordDB } from '@/hooks/useFinancial';
import { useContract } from '@/hooks/useContracts';
import { useTenants } from '@/hooks/useTenants';
import { useApartment } from '@/hooks/useApartments';
import ReceiptModalDB from './ReceiptModalDB';

function getStatus(record: FinancialRecordDB): 'paid' | 'overdue' | 'pending' {
  if (record.paid) return 'paid';
  const today = new Date();
  const [year, month] = record.month.split('-').map(Number);
  if (year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth() + 1)) {
    return 'overdue';
  }
  return 'pending';
}

export default function FinancialTabDB({ apartmentId, tenantId, tenantName, tenantCpf }: {
  apartmentId: string;
  tenantId: string;
  tenantName: string;
  tenantCpf: string;
}) {
  const { state } = useApp();
  const { data: records = [], isLoading } = useFinancialRecords(apartmentId);
  const { data: contract } = useContract(tenantId);
  const { data: apartment } = useApartment(apartmentId);
  const { data: tenants = [] } = useTenants(apartmentId);
  const upsert = useUpsertFinancialRecord();

  const [filterYear, setFilterYear] = useState(String(state.selectedYear));
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [receiptRecord, setReceiptRecord] = useState<FinancialRecordDB | null>(null);

  const tenantRecords = records.filter(r => r.tenant_id === tenantId);
  const currentTenant = tenants.find(t => t.id === tenantId);

  const filteredRecords = tenantRecords.filter(r => {
    const [y, m] = r.month.split('-').map(Number);
    const matchYear = y === Number(filterYear);
    const matchMonth = filterMonth === 'all' || m - 1 === Number(filterMonth);
    return matchYear && matchMonth;
  }).sort((a, b) => a.month.localeCompare(b.month));

  const totalPaid = filteredRecords.filter(r => r.paid).reduce((s, r) => s + r.rent_value, 0);
  const totalOverdue = filteredRecords.filter(r => getStatus(r) === 'overdue').reduce((s, r) => s + r.rent_value, 0);
  const totalPending = filteredRecords.filter(r => !r.paid && getStatus(r) === 'pending').reduce((s, r) => s + r.rent_value, 0);

  const paymentDay = contract?.payment_day ?? 1;
  const contractStartDate = contract?.start_date ?? null;

  async function togglePaid(record: FinancialRecordDB) {
    const nowPaid = !record.paid;
    await upsert.mutateAsync({
      ...record,
      paid: nowPaid,
      payment_date: nowPaid ? new Date().toISOString().split('T')[0] : null,
      status: nowPaid ? 'Pago' : 'Pendente',
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Pago</p>
          <p className="font-bold" style={{ color: 'hsl(var(--paid))' }}>{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">A Receber</p>
          <p className="font-bold" style={{ color: 'hsl(var(--warning))' }}>{formatCurrency(totalPending)}</p>
        </div>
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Inadimplente</p>
          <p className="font-bold" style={{ color: 'hsl(var(--overdue))' }}>{formatCurrency(totalOverdue)}</p>
        </div>
      </div>

      {/* Records table */}
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <p>Nenhum período encontrado. Os períodos são gerados automaticamente ao salvar o contrato.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Período Ref.</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Pagamento</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(r => {
                const st = getStatus(r);
                const { periodLabel, dueDateLabel } = getPeriodAndDueDate(r.month, contractStartDate, paymentDay);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-xs">{periodLabel}</td>
                    <td className="px-4 py-3 text-center text-xs">{dueDateLabel}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.rent_value)}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {r.payment_date ? r.payment_date : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {st === 'paid' && <span className="badge-paid"><CheckCircle className="w-3 h-3" /> Pago</span>}
                      {st === 'pending' && <span className="badge-unpaid">Pendente</span>}
                      {st === 'overdue' && <span className="badge-overdue"><AlertCircle className="w-3 h-3" /> Inadimplente</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => togglePaid(r)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                          title={r.paid ? 'Marcar como não pago' : 'Marcar como pago'}
                        >
                          {r.paid
                            ? <XCircle className="w-4 h-4 text-destructive" />
                            : <CheckCircle className="w-4 h-4" style={{ color: 'hsl(var(--paid))' }} />}
                        </button>
                        <button
                          onClick={() => setReceiptRecord(r)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors"
                          title="Gerar recibo PDF"
                          style={{ color: 'hsl(var(--primary))' }}
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptRecord && apartment && currentTenant && (
        <ReceiptModalDB
          open={!!receiptRecord}
          onClose={() => setReceiptRecord(null)}
          record={receiptRecord}
          apartment={apartment}
          tenant={currentTenant}
          contract={contract ?? null}
          allRecords={tenantRecords}
        />
      )}
    </div>
  );
}
