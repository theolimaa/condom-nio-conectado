import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/lib/store';
import { Apartment, PaymentPeriod, Tenant } from '@/lib/types';
import { formatCurrency, formatDate, MONTHS, YEARS } from '@/lib/utils-app';
import ReceiptModal from './ReceiptModal';

export default function FinancialTab({ apartment, tenant }: { apartment: Apartment; tenant: Tenant }) {
  const { state, dispatch } = useApp();
  const [filterYear, setFilterYear] = useState(String(state.selectedYear));
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [receiptPeriod, setReceiptPeriod] = useState<PaymentPeriod | null>(null);

  const payments = apartment.payments
    .filter(p => p.tenantId === tenant.id)
    .filter(p => {
      const d = new Date(p.dueDate);
      const matchYear = d.getFullYear() === Number(filterYear);
      const matchMonth = filterMonth === 'all' || d.getMonth() === Number(filterMonth);
      return matchYear && matchMonth;
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.value, 0);
  const totalOwed = payments.filter(p => p.status !== 'paid').reduce((s, p) => s + p.value, 0);
  const totalOverdue = payments.filter(p => p.status === 'overdue').reduce((s, p) => s + p.value, 0);

  function togglePayment(p: PaymentPeriod) {
    const newStatus = p.status === 'paid' ? 'unpaid' : 'paid';
    dispatch({
      type: 'UPDATE_PAYMENT',
      payload: {
        apartmentId: apartment.id,
        payment: {
          ...p,
          status: newStatus,
          paidAt: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : undefined,
        },
      },
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
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
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Pago</p>
          <p className="font-bold" style={{ color: 'hsl(var(--paid))' }}>{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">A Receber</p>
          <p className="font-bold" style={{ color: 'hsl(var(--warning))' }}>{formatCurrency(totalOwed - totalOverdue)}</p>
        </div>
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Inadimplente</p>
          <p className="font-bold" style={{ color: 'hsl(var(--overdue))' }}>{formatCurrency(totalOverdue)}</p>
        </div>
      </div>

      {/* Payments table */}
      {payments.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">Nenhum período encontrado para o filtro selecionado.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Período</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Pagamento</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {formatDate(p.startDate)} – {formatDate(p.endDate)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.value)}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{formatDate(p.dueDate)}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {p.paidAt ? formatDate(p.paidAt) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.status === 'paid' && <span className="badge-paid"><CheckCircle className="w-3 h-3" /> Pago</span>}
                    {p.status === 'unpaid' && <span className="badge-unpaid">A pagar</span>}
                    {p.status === 'overdue' && <span className="badge-overdue"><AlertCircle className="w-3 h-3" /> Inadimplente</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => togglePayment(p)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                        title={p.status === 'paid' ? 'Marcar como não pago' : 'Marcar como pago'}
                      >
                        {p.status === 'paid'
                          ? <XCircle className="w-4 h-4 text-destructive" />
                          : <CheckCircle className="w-4 h-4" style={{ color: 'hsl(var(--paid))' }} />}
                      </button>
                      <button
                        onClick={() => setReceiptPeriod(p)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        title="Gerar recibo PDF"
                        style={{ color: 'hsl(var(--primary))' }}
                      >
                        <Receipt className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {receiptPeriod && (
        <ReceiptModal
          open={!!receiptPeriod}
          onClose={() => setReceiptPeriod(null)}
          period={receiptPeriod}
          apartment={apartment}
          tenant={tenant}
        />
      )}
    </div>
  );
}
