import { useState, useEffect } from 'react';
import { FileText, Download, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDate } from '@/lib/utils-app';
import { FinancialRecordDB } from '@/hooks/useFinancial';
import { ApartmentDB } from '@/hooks/useApartments';
import { TenantDB } from '@/hooks/useTenants';
import { ContractDB } from '@/hooks/useContracts';
import { useAuth } from '@/hooks/useAuth';
import jsPDF from 'jspdf';

interface Props {
  open: boolean;
  onClose: () => void;
  record: FinancialRecordDB;
  apartment: ApartmentDB;
  tenant: TenantDB;
  contract: ContractDB | null;
  allRecords: FinancialRecordDB[];
}

// Campo de texto editável inline
function EditableText({ value, onChange, multiline = false, className = '' }: {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    if (multiline) {
      return (
        <Textarea
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          className={`text-sm font-mono min-h-[60px] ${className}`}
        />
      );
    }
    return (
      <Input
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        className={`h-7 text-sm font-mono ${className}`}
      />
    );
  }

  return (
    <span
      className={`group relative cursor-pointer hover:bg-primary/10 rounded px-1 -mx-1 transition-colors ${className}`}
      onClick={() => setEditing(true)}
      title="Clique para editar"
    >
      {value}
      <Pencil className="inline w-3 h-3 ml-1 opacity-0 group-hover:opacity-40 transition-opacity" />
    </span>
  );
}

export default function ReceiptModalDB({ open, onClose, record, apartment, tenant, contract, allRecords }: Props) {
  const { user } = useAuth();

  const [editableValues, setEditableValues] = useState<Record<string, number>>({});

  const [recYear] = record.month.split('-').map(Number);
  const yearRecords = allRecords
    .filter(r => r.month.startsWith(String(recYear)))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(0, 12);

  const adminName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Administrador';
  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const paymentDay = contract?.payment_day ?? 1;

  function getPeriodLabel(month: string) {
    const [y, m] = month.split('-').map(Number);
    const startDay = String(paymentDay).padStart(2, '0');
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    return `${startDay}/${String(m).padStart(2, '0')}/${y} a ${startDay}/${String(nextM).padStart(2, '0')}/${nextY}`;
  }

  const cautionText = contract?.caution_paid && contract.caution_value
    ? `Caução paga no valor de ${formatCurrency(contract.caution_value)}${contract.caution_date ? ` na data ${formatDate(contract.caution_date)}` : ''}.`
    : '';

  // Textos editáveis do recibo
  const [title, setTitle] = useState('');
  const [mainText, setMainText] = useState('');
  const [cautionLine, setCautionLine] = useState('');
  const [historyTitle, setHistoryTitle] = useState('');
  const [footer, setFooter] = useState('');

  // Inicializa textos quando o modal abre
  useEffect(() => {
    if (!open) return;
    const periodLabel = getPeriodLabel(record.month);
    const rentFormatted = formatCurrency(editableValues[record.id] ?? record.rent_value);
    setTitle(`RECIBO — APTO ${apartment.unit_number} — ${tenant.first_name} ${tenant.last_name} — ${today}`);
    setMainText(`Recebi de ${tenant.first_name} ${tenant.last_name}, CPF ${tenant.cpf || '—'} a importância de: ${rentFormatted} referente ao aluguel para o período de ${periodLabel}.`);
    setCautionLine(cautionText);
    setHistoryTitle(`Histórico do Ano ${recYear}`);
    setFooter(`Fortaleza, ${today} — ${adminName} — Confira seu recibo.`);
  }, [open]);

  function generatePDF() {
    const doc = new jsPDF();
    const ml = 20;
    let y = 20;

    const addText = (text: string, fontSize = 10, bold = false) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text, 170);
      doc.text(lines, ml, y);
      y += lines.length * (fontSize * 0.45) + 2;
    };

    const addLine = () => {
      doc.setDrawColor(200, 200, 200);
      doc.line(ml, y, 190, y);
      y += 4;
    };

    addText(title, 13, true);
    addLine();
    y += 2;

    addText(mainText, 10);

    if (cautionLine) {
      y += 2;
      addText(cautionLine, 10);
    }

    y += 4;
    addLine();

    addText(historyTitle, 11, true);
    y += 2;

    const cols = { periodo: 20, valor: 90, pagamento: 115, pago: 145, devendo: 170 };
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Período', cols.periodo, y);
    doc.text('Valor', cols.valor, y);
    doc.text('Pagamento', cols.pagamento, y);
    doc.text('Pago', cols.pago, y);
    doc.text('Devendo', cols.devendo, y);
    y += 5;

    let totalPaid = 0;
    let totalOwed = 0;

    doc.setFont('helvetica', 'normal');
    yearRecords.forEach(r => {
      const val = editableValues[r.id] ?? r.rent_value;
      const paid = r.paid ? val : 0;
      const owed = !r.paid ? val : 0;
      totalPaid += paid;
      totalOwed += owed;

      doc.text(getPeriodLabel(r.month), cols.periodo, y);
      doc.text(String(val), cols.valor, y);
      doc.text(r.payment_date ? formatDate(r.payment_date) : '—', cols.pagamento, y);
      doc.text(paid > 0 ? formatCurrency(paid) : '—', cols.pago, y);
      doc.text(owed > 0 ? formatCurrency(owed) : '—', cols.devendo, y);
      y += 5;
    });

    addLine();
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Pago: ${formatCurrency(totalPaid)}`, cols.pago - 15, y);
    doc.text(`Devendo: ${formatCurrency(totalOwed)}`, cols.devendo - 5, y);
    y += 10;

    addLine();
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(footer, ml, y);

    doc.save(`Recibo-Apto${apartment.unit_number}-${record.month}.pdf`);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Recibo — Apto {apartment.unit_number} — {getPeriodLabel(record.month)}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Pencil className="w-3 h-3" /> Clique em qualquer texto para editar antes de baixar o PDF.
        </p>

        <div className="bg-muted/30 border border-border rounded-xl p-6 space-y-4 font-mono text-sm">
          {/* Título */}
          <div className="border-b border-border pb-3">
            <p className="font-bold text-base">
              <EditableText value={title} onChange={setTitle} />
            </p>
          </div>

          {/* Texto principal */}
          <div>
            <EditableText value={mainText} onChange={setMainText} multiline className="w-full" />
          </div>

          {/* Linha de caução — aparece só se preenchida, mas é editável */}
          {(cautionLine || contract?.caution_paid) && (
            <div className="text-sm">
              <EditableText value={cautionLine} onChange={setCautionLine} multiline className="w-full" />
            </div>
          )}

          {/* Histórico */}
          <div>
            <p className="font-bold mb-2 border-b border-border pb-1">
              <EditableText value={historyTitle} onChange={setHistoryTitle} />
            </p>
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
                {yearRecords.map(r => {
                  const val = editableValues[r.id] ?? r.rent_value;
                  return (
                    <tr key={r.id} className={`border-t border-border/50 ${r.id === record.id ? 'bg-primary/5' : ''}`}>
                      <td className="py-1">{getPeriodLabel(r.month)}</td>
                      <td className="text-right py-1">
                        <Input
                          type="number"
                          value={val}
                          onChange={e => setEditableValues({ ...editableValues, [r.id]: Number(e.target.value) })}
                          className="h-6 w-24 text-xs text-right ml-auto"
                        />
                      </td>
                      <td className="text-right py-1">{r.payment_date ? formatDate(r.payment_date) : '—'}</td>
                      <td className="text-right py-1" style={{ color: 'hsl(var(--paid))' }}>
                        {r.paid ? formatCurrency(val) : '—'}
                      </td>
                      <td className="text-right py-1" style={{ color: 'hsl(var(--overdue))' }}>
                        {!r.paid ? formatCurrency(val) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold">
                  <td colSpan={3} className="py-1">Total</td>
                  <td className="text-right py-1" style={{ color: 'hsl(var(--paid))' }}>
                    {formatCurrency(yearRecords.filter(r => r.paid).reduce((s, r) => s + (editableValues[r.id] ?? r.rent_value), 0))}
                  </td>
                  <td className="text-right py-1" style={{ color: 'hsl(var(--overdue))' }}>
                    {formatCurrency(yearRecords.filter(r => !r.paid).reduce((s, r) => s + (editableValues[r.id] ?? r.rent_value), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Rodapé */}
          <div className="border-t border-border pt-3 text-xs text-muted-foreground">
            <EditableText value={footer} onChange={setFooter} className="w-full" />
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
