import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Receipt, Loader2, CalendarDays } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useApp } from '@/lib/store';
import { formatCurrency, MONTHS, YEARS, getPeriodAndDueDate, getRecordStatus } from '@/lib/utils-app';
import { useFinancialRecords, useUpsertFinancialRecord, FinancialRecordDB } from '@/hooks/useFinancial';
import { useContract } from '@/hooks/useContracts';
import { useTenants } from '@/hooks/useTenants';
import { useApartment } from '@/hooks/useApartments';
import { useCondominiums } from '@/hooks/useCondominiums';
import ReceiptModalDB from './ReceiptModalDB';

function getStatus(record: FinancialRecordDB, paymentDay?: number | null, contractStartDate?: string | null): 'paid' | 'overdue' | 'pending' {
  if (record.paid) return 'paid';
  return getRecordStatus(record.month, paymentDay, contractStartDate);
}

export default function FinancialTabDB({ apartmentId, tenantId, tenantName, tenantCpf }: {
  apartmentId: string; tenantId: string; tenantName: string; tenantCpf: string;
}) {
  const { state } = useApp();
  const { data: records = [], isLoading } = useFinancialRecords(apartmentId);
  const { data: contract } = useContract(tenantId);
  const { data: apartment } = useApartment(apartmentId);
  const { data: condominiums = [] } = useCondominiums();
  const condominiumName = apartment ? (condominiums.find(c => c.id === apartment.condominium_id)?.name ?? '') : '';
  const { data: tenants = [] } = useTenants(apartmentId);
  const upsert = useUpsertFinancialRecord();
  const [filterYear, setFilterYear] = useState(String(state.selectedYear));
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [receiptRecord, setReceiptRecord] = useState<FinancialRecordDB | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ record: FinancialRecordDB; date: string } | null>(null);

  const paymentDay = contract?.payment_day ?? 1;
  const contractStartDate = contract?.start_date ?? null;
  const contractStartDate = contract?.start_date ?? null;

  const tenantRecords = records.filter(r => r.tenant_id === tenantId);
  const currentTenant = tenants.find(t => t.id === tenantId);

  // Filtrar e ordenar
  const filteredRecords = tenantRecords.filter(r => {
    // Ignorar registros com formato antigo de month (ex: "2026-01-03_2026-02-03")
    if (r.month.includes('_') || r.month.length > 7) return false;
    const [y, m] = r.month.split('-').map(Number);
    const matchYear = y === Number(filterYear);
    const matchMonth = filterMonth === 'all' || m - 1 === Number(filterMonth);
    return matchYear && matchMonth;
  }).sort((a, b) => a.month.localeCompare(b.month));

  // Dedup defensivo por month
  const seen = new Map<string, FinancialRecordDB>();
  for (const r of filteredRecords) {
    const existing = seen.get(r.month);
    if (!existing || r.paid) seen.set(r.month, r);
  }
  const dedupedRecords = Array.from(seen.values()).sort((a, b) => a.month.localeCompare(b.month));

  const totalPaid = dedupedRecords.filter(r => r.paid).reduce((s, r) => s + r.rent_value, 0);
  const totalOverdue = dedupedRecords.filter(r => getStatus(r, paymentDay, contractStartDate) === 'overdue').reduce((s, r) => s + r.rent_value, 0);
  const totalPending = dedupedRecords.filter(r => !r.paid && getStatus(r, paymentDay, contractStartDate) === 'pending').reduce((s, r) => s + r.rent_value, 0);

  async function togglePaid(record: FinancialRecordDB) {
    if (!record.paid) {
      setPaymentModal({ record, date: new Date().toISOString().split('T')[0] });
    } else {
      await upsert.mutateAsync({ ...record, paid: false, payment_date: null, status: 'Pendente' });
    }
  }

  async function confirmPayment() {
    if (!paymentModal) return;
    await upsert.mutateAsync({
      ...paymentModal.record,
      paid: true,
      payment_date: paymentModal.date || new Date().toISOString().split('T')[0],
      status: 'Pago',
    });
    setPaymentModal(null);
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
      ) : dedupedRecords.length === 0 ? (
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
              {dedupedRecords.map(r => {
                const st = getStatus(r, paymentDay, contractStartDate);
                const { periodLabel, dueDateLabel } = getPeriodAndDueDate(r.month, contractStartDate, paymentDay);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-xs">{periodLabel}</td>
                    <td className="px-4 py-3 text-center text-xs">{dueDateLabel}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.rent_value)}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {r.payment_date ? r.payment_date : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {st === 'paid' && <span className="badge-paid"><CheckCircle className="w-3 h-3" /> Pago</span>}
                      {st === 'pending' && <span className="badge-unpaid">A vencer</span>}
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
          condominiumName={condominiumName}
        />
      )}

      {/* Payment Date Modal */}
      <Dialog open={!!paymentModal} onOpenChange={() => setPaymentModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Data de Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Informe a data em que o pagamento foi recebido.
            </p>
            <div>
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                className="mt-1"
                value={paymentModal?.date ?? ''}
                onChange={e => setPaymentModal(prev => prev ? { ...prev, date: e.target.value } : null)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModal(null)}>Cancelar</Button>
            <Button onClick={confirmPayment} disabled={upsert.isPending}>
              {upsert.isPending
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
