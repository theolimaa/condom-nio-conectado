import { useState } from 'react';
import { FileText, Download, X, Plus, Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/lib/store';
import { Apartment, PaymentPeriod, Tenant } from '@/lib/types';
import { formatCurrency, formatDate, MONTHS } from '@/lib/utils-app';
import jsPDF from 'jspdf';

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  period: PaymentPeriod;
  apartment: Apartment;
  tenant: Tenant;
}

export default function ReceiptModal({ open, onClose, period, apartment, tenant }: ReceiptModalProps) {
  const { state } = useApp();
  const [editableValues, setEditableValues] = useState<Record<string, number>>({});

  // Get all payments for this tenant in the same year
  const periodYear = new Date(period.startDate).getFullYear();
  const yearPayments = apartment.payments
    .filter(p => p.tenantId === tenant.id && new Date(p.startDate).getFullYear() === periodYear)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const adminName = state.user.name;
  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const mainResident = tenant.additionalResidents[0];

  function generatePDF() {
    const doc = new jsPDF();
    const marginLeft = 20;
    let y = 20;

    const addText = (text: string, fontSize = 10, bold = false) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text, 170);
      doc.text(lines, marginLeft, y);
      y += lines.length * (fontSize * 0.45) + 2;
    };

    const addLine = () => {
      doc.setDrawColor(200, 200, 200);
      doc.line(marginLeft, y, 190, y);
      y += 4;
    };

    // Header
    addText(`RECIBO - APTO ${apartment.number} - ${tenant.name}${mainResident ? ` e ${mainResident.name}` : ''} - ${today}`, 13, true);
    addLine();
    y += 2;

    // Deposit
    if (tenant.contract?.depositPaid) {
      addText(`Caução paga em: ${formatDate(tenant.contract.depositDate)} no valor de ${formatCurrency(tenant.contract.depositValue)}`, 10);
      y += 2;
    }

    // Main text
    const residents = mainResident ? `, CPF ${mainResident.cpf} e ${mainResident.name}, CPF ${mainResident.cpf}` : '';
    addText(
      `Recebi de ${tenant.name}, CPF ${tenant.cpf}${residents} a importância de: ${formatCurrency(period.value)} referente ao aluguel para o período de ${formatDate(period.startDate)} a ${formatDate(period.endDate)}.`,
      10
    );
    y += 4;
    addLine();

    // History table header
    addText('HISTÓRICO DO ANO', 11, true);
    y += 2;

    const cols = { periodo: 20, valor: 75, pagamento: 100, pago: 130, devendo: 145, total: 160 };
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Período', cols.periodo, y);
    doc.text('Valor', cols.valor, y);
    doc.text('Data Pagamento', cols.pagamento, y);
    doc.text('Pago', cols.pago, y);
    doc.text('Devendo', cols.devendo, y);
    doc.text('Total', cols.total, y);
    y += 5;

    let totalPaid = 0;
    let totalOwed = 0;

    doc.setFont('helvetica', 'normal');
    yearPayments.slice(0, 12).forEach(p => {
      const val = editableValues[p.id] ?? p.value;
      const paid = p.status === 'paid' ? val : 0;
      const owed = p.status !== 'paid' ? val : 0;
      totalPaid += paid;
      totalOwed += owed;

      doc.text(`${formatDate(p.startDate)}-${formatDate(p.endDate)}`, cols.periodo, y);
      doc.text(formatCurrency(val), cols.valor, y);
      doc.text(p.paidAt ? formatDate(p.paidAt) : '-', cols.pagamento, y);
      doc.text(paid > 0 ? formatCurrency(paid) : '-', cols.pago, y);
      doc.text(owed > 0 ? formatCurrency(owed) : '-', cols.devendo, y);
      y += 5;
    });

    addLine();
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Pago: ${formatCurrency(totalPaid)}`, cols.pago, y);
    doc.text(`Total Devendo: ${formatCurrency(totalOwed)}`, cols.devendo, y);
    y += 10;

    addLine();
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fortaleza, ${today} — ${adminName} — Confira seu recibo.`, marginLeft, y);

    doc.save(`Recibo-Apto${apartment.number}-${formatDate(period.startDate)}.pdf`);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Recibo — Apto {apartment.number} — {formatDate(period.startDate)} a {formatDate(period.endDate)}
          </DialogTitle>
        </DialogHeader>

        {/* Receipt preview */}
        <div className="bg-muted/30 border border-border rounded-xl p-6 space-y-4 font-mono text-sm">
          <div className="border-b border-border pb-3">
            <p className="font-bold text-base">
              RECIBO — APTO {apartment.number} — {tenant.name}{mainResident ? ` e ${mainResident.name}` : ''} — {today}
            </p>
          </div>

          {tenant.contract?.depositPaid && (
            <p className="text-sm">
              Caução paga em: <strong>{formatDate(tenant.contract.depositDate)}</strong> no valor de{' '}
              <strong>{formatCurrency(tenant.contract.depositValue)}</strong>
            </p>
          )}

          <p>
            Recebi de <strong>{tenant.name}</strong>, CPF {tenant.cpf}
            {mainResident && <>, CPF {mainResident.cpf} e <strong>{mainResident.name}</strong>, CPF {mainResident.cpf}</>}{' '}
            a importância de: <strong>{formatCurrency(period.value)}</strong> referente ao aluguel para o período de{' '}
            <strong>{formatDate(period.startDate)}</strong> a <strong>{formatDate(period.endDate)}</strong>.
          </p>

          {/* Year history table */}
          <div>
            <p className="font-bold mb-2 border-b border-border pb-1">Histórico do Ano {periodYear}</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left py-1">Período</th>
                  <th className="text-right py-1">Valor</th>
                  <th className="text-right py-1">Data Pag.</th>
                  <th className="text-right py-1">Pago</th>
                  <th className="text-right py-1">Devendo</th>
                </tr>
              </thead>
              <tbody>
                {yearPayments.slice(0, 12).map(p => {
                  const val = editableValues[p.id] ?? p.value;
                  return (
                    <tr key={p.id} className={`border-t border-border/50 ${p.id === period.id ? 'bg-primary/5' : ''}`}>
                      <td className="py-1">{formatDate(p.startDate)} – {formatDate(p.endDate)}</td>
                      <td className="text-right py-1">
                        <Input
                          type="number"
                          value={val}
                          onChange={e => setEditableValues({ ...editableValues, [p.id]: Number(e.target.value) })}
                          className="h-6 w-24 text-xs text-right ml-auto"
                        />
                      </td>
                      <td className="text-right py-1">{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
                      <td className="text-right py-1" style={{ color: 'hsl(var(--paid))' }}>
                        {p.status === 'paid' ? formatCurrency(val) : '—'}
                      </td>
                      <td className="text-right py-1" style={{ color: 'hsl(var(--overdue))' }}>
                        {p.status !== 'paid' ? formatCurrency(val) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold">
                  <td colSpan={3} className="py-1">Total</td>
                  <td className="text-right py-1" style={{ color: 'hsl(var(--paid))' }}>
                    {formatCurrency(yearPayments.slice(0, 12).filter(p => p.status === 'paid').reduce((s, p) => s + (editableValues[p.id] ?? p.value), 0))}
                  </td>
                  <td className="text-right py-1" style={{ color: 'hsl(var(--overdue))' }}>
                    {formatCurrency(yearPayments.slice(0, 12).filter(p => p.status !== 'paid').reduce((s, p) => s + (editableValues[p.id] ?? p.value), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="border-t border-border pt-3 text-xs text-muted-foreground">
            Fortaleza, {today} — {adminName} — Confira seu recibo.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" /> Fechar
          </Button>
          <Button onClick={generatePDF}>
            <Download className="w-4 h-4 mr-2" /> Salvar e Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
