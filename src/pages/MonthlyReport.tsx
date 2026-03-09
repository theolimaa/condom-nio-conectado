import { useState } from 'react';
import { Download, FileBarChart2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Layout from '@/components/Layout';
import { formatCurrency, MONTHS, YEARS } from '@/lib/utils-app';
import { useCondominiums } from '@/hooks/useCondominiums';
import { useApartments } from '@/hooks/useApartments';
import { useTenants } from '@/hooks/useTenants';
import { useFinancialRecordsByYear } from '@/hooks/useFinancial';
import jsPDF from 'jspdf';

function getStatus(paid: boolean | null, month: string): 'paid' | 'overdue' | 'pending' {
  if (paid) return 'paid';
  const today = new Date();
  const [year, m] = month.split('-').map(Number);
  if (isNaN(year) || isNaN(m)) return 'pending';
  if (
    year < today.getFullYear() ||
    (year === today.getFullYear() && m < today.getMonth() + 1)
  )
    return 'overdue';
  return 'pending';
}

export default function MonthlyReport() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));
  const [selectedCondo, setSelectedCondo] = useState('all');

  const { data: condominiums = [] } = useCondominiums();
  const { data: apartments = [] } = useApartments();
  const { data: allTenants = [] } = useTenants();
  const { data: financialRecords = [], isLoading } = useFinancialRecordsByYear(
    Number(selectedYear)
  );

  const monthIndex = Number(selectedMonth); // 0-indexed
  // monthKey para filtrar registros NÃO PAGOS pelo período de referência
  const monthKey = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;

  // ✅ CORREÇÃO: um registro conta para o mês selecionado se:
  //   - está PAGO e payment_date cai no mês/ano selecionado (quando entrou o dinheiro)
  //   - OU está NÃO PAGO e o month (período) corresponde ao mês selecionado
  const filtered = financialRecords.filter(r => {
    if (selectedCondo !== 'all') {
      const apt = apartments.find(a => a.id === r.apartment_id);
      if (apt?.condominium_id !== selectedCondo) return false;
    }

    if (r.paid && r.payment_date) {
      // Usa o mês da data de pagamento
      const [y, m] = r.payment_date.split('-').map(Number);
      return y === Number(selectedYear) && m - 1 === monthIndex;
    } else {
      // Usa o período de referência para pendentes/inadimplentes
      return r.month === monthKey;
    }
  });

  // Agrupado por condomínio
  const grouped = condominiums
    .filter(c => selectedCondo === 'all' || c.id === selectedCondo)
    .map(condo => {
      const condoApts = apartments.filter(a => a.condominium_id === condo.id);
      const condoRecords = filtered.filter(r => condoApts.some(a => a.id === r.apartment_id));

      const rows = condoApts.map(apt => {
        const record = condoRecords.find(r => r.apartment_id === apt.id);
        const tenant = allTenants.find(t => t.id === record?.tenant_id);
        const status = record ? getStatus(record.paid, record.month) : null;
        return { apt, record, tenant, status };
      });

      const totalPaid = condoRecords.filter(r => r.paid).reduce((s, r) => s + r.rent_value, 0);
      const totalPending = condoRecords
        .filter(r => getStatus(r.paid, r.month) === 'pending')
        .reduce((s, r) => s + r.rent_value, 0);
      const totalOverdue = condoRecords
        .filter(r => getStatus(r.paid, r.month) === 'overdue')
        .reduce((s, r) => s + r.rent_value, 0);
      const occupied = condoApts.filter(apt =>
        condoRecords.some(r => r.apartment_id === apt.id)
      ).length;

      return { condo, rows, totalPaid, totalPending, totalOverdue, occupied, total: condoApts.length };
    });

  const grandPaid = grouped.reduce((s, g) => s + g.totalPaid, 0);
  const grandPending = grouped.reduce((s, g) => s + g.totalPending, 0);
  const grandOverdue = grouped.reduce((s, g) => s + g.totalOverdue, 0);

  function generatePDF() {
    const doc = new jsPDF();
    const ml = 15;
    let y = 18;
    const monthLabel = MONTHS[Number(selectedMonth)];
    const condoLabel =
      selectedCondo === 'all'
        ? 'Todos os condomínios'
        : condominiums.find(c => c.id === selectedCondo)?.name ?? '';
    const today = new Date().toLocaleDateString('pt-BR');

    const addText = (
      text: string,
      fontSize = 10,
      bold = false,
      color: [number, number, number] = [30, 30, 30]
    ) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, 180);
      doc.text(lines, ml, y);
      y += lines.length * (fontSize * 0.42) + 2;
    };

    const addLine = (color: [number, number, number] = [200, 200, 200]) => {
      doc.setDrawColor(...color);
      doc.line(ml, y, 195, y);
      y += 3;
    };

    // Cabeçalho
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Living Gest — Relatório Mensal', ml, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${monthLabel} ${selectedYear} • ${condoLabel} • Emitido em ${today}`, ml, 22);
    y = 36;

    // Resumo geral
    doc.setFillColor(245, 247, 250);
    doc.rect(ml - 2, y - 4, 182, 20, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('RESUMO GERAL', ml, y + 1);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 197, 94);
    doc.text(`Recebido: ${formatCurrency(grandPaid)}`, ml, y);
    doc.setTextColor(234, 179, 8);
    doc.text(`A Receber: ${formatCurrency(grandPending)}`, ml + 60, y);
    doc.setTextColor(239, 68, 68);
    doc.text(`Inadimplente: ${formatCurrency(grandOverdue)}`, ml + 120, y);
    y += 10;
    addLine([180, 180, 180]);

    // Por condomínio
    for (const g of grouped) {
      if (y > 255) {
        doc.addPage();
        y = 15;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(g.condo.name, ml, y);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${g.occupied}/${g.total} ocupados`, ml + 90, y);
      doc.setTextColor(34, 197, 94);
      doc.text(`Rec: ${formatCurrency(g.totalPaid)}`, ml + 130, y);
      doc.setTextColor(239, 68, 68);
      doc.text(`Inad: ${formatCurrency(g.totalOverdue)}`, ml + 160, y);
      y += 6;

      doc.setFillColor(230, 235, 245);
      doc.rect(ml - 2, y - 3, 182, 6, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('Apto', ml, y + 1);
      doc.text('Inquilino', ml + 18, y + 1);
      doc.text('Valor', ml + 100, y + 1);
      doc.text('Pagamento', ml + 125, y + 1);
      doc.text('Status', ml + 160, y + 1);
      y += 7;

      for (const row of g.rows) {
        if (y > 270) {
          doc.addPage();
          y = 15;
        }
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        doc.text(row.apt.unit_number, ml, y);
        const tenantName = row.tenant
          ? `${row.tenant.first_name} ${row.tenant.last_name}`
          : '—';
        doc.text(doc.splitTextToSize(tenantName, 75)[0], ml + 18, y);
        doc.text(row.record ? formatCurrency(row.record.rent_value) : '—', ml + 100, y);
        doc.text(row.record?.payment_date ?? '—', ml + 125, y);
        if (row.status === 'paid') doc.setTextColor(34, 197, 94);
        else if (row.status === 'overdue') doc.setTextColor(239, 68, 68);
        else if (row.status === 'pending') doc.setTextColor(234, 179, 8);
        else doc.setTextColor(150, 150, 150);
        const statusLabel =
          row.status === 'paid'
            ? 'Pago'
            : row.status === 'overdue'
            ? 'Inadimplente'
            : row.status === 'pending'
            ? 'Pendente'
            : 'Vago';
        doc.text(statusLabel, ml + 160, y);
        doc.setTextColor(30, 30, 30);
        y += 5;
      }
      y += 4;
      addLine();
    }

    doc.save(`Relatorio-${monthLabel}-${selectedYear}.pdf`);
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileBarChart2 className="w-6 h-6 text-primary" />
              Relatório Mensal
            </h1>
            <p className="text-muted-foreground text-sm">
              Visão completa de todos os apartamentos por mês
            </p>
          </div>
          <Button onClick={generatePDF} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Baixar PDF
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map(y => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCondo} onValueChange={setSelectedCondo}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Todos os condomínios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os condomínios</SelectItem>
              {condominiums.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Recebido</p>
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--paid))' }}>
              {formatCurrency(grandPaid)}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">A Receber</p>
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--warning))' }}>
              {formatCurrency(grandPending)}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Inadimplente</p>
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--overdue))' }}>
              {formatCurrency(grandOverdue)}
            </p>
          </div>
        </div>

        {/* Tabelas por condomínio */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(g => (
              <div
                key={g.condo.id}
                className="bg-card border border-border rounded-xl overflow-x-auto"
              >
                <div className="flex items-center justify-between px-5 py-3 bg-muted/40 border-b border-border">
                  <h2 className="font-semibold">{g.condo.name}</h2>
                  <div className="flex gap-4 text-sm">
                    <span className="text-muted-foreground">
                      {g.occupied}/{g.total} ocupados
                    </span>
                    <span style={{ color: 'hsl(var(--paid))' }}>
                      {formatCurrency(g.totalPaid)} recebido
                    </span>
                    {g.totalOverdue > 0 && (
                      <span style={{ color: 'hsl(var(--overdue))' }}>
                        {formatCurrency(g.totalOverdue)} inad.
                      </span>
                    )}
                  </div>
                </div>
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left px-4 py-2">Apto</th>
                      <th className="text-left px-4 py-2">Inquilino</th>
                      <th className="text-right px-4 py-2">Valor</th>
                      <th className="text-center px-4 py-2">Pagamento</th>
                      <th className="text-center px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map(row => (
                      <tr
                        key={row.apt.id}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="px-4 py-2 font-medium">{row.apt.unit_number}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {row.tenant
                            ? `${row.tenant.first_name} ${row.tenant.last_name}`
                            : '—'}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {row.record ? formatCurrency(row.record.rent_value) : '—'}
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-muted-foreground">
                          {row.record?.payment_date ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {row.status === 'paid' && (
                            <span className="badge-active">Pago</span>
                          )}
                          {row.status === 'overdue' && (
                            <span className="badge-overdue">Inadimplente</span>
                          )}
                          {row.status === 'pending' && (
                            <span className="badge-unpaid">Pendente</span>
                          )}
                          {!row.status && (
                            <span className="text-xs text-muted-foreground">Vago</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
