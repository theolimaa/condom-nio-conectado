import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

export function formatDateLong(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

export function generateId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const YEARS = Array.from({ length: 20 }, (_, i) => 2026 + i);

/**
 * Calculate period label and due date for a financial record.
 * Period is always tied to the contract start day.
 * Due date is a SEPARATE field tied to payment_day.
 * 
 * Example: Contract starts 22/05/2025, payment_day=30
 * January period: 22/01/2026 a 22/02/2026, Due: 30/01/2026
 */
export function getPeriodAndDueDate(monthStr: string, contractStartDate: string | null, paymentDay: number) {
  const [y, m] = monthStr.split('-').map(Number);
  
  // Extract the start day from the contract start date
  let startDay = 1;
  if (contractStartDate) {
    const parsed = new Date(contractStartDate + 'T12:00:00');
    startDay = parsed.getDate();
  }
  
  // Period: startDay of this month to startDay of next month
  const periodStartDay = Math.min(startDay, daysInMonth(y, m));
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const periodEndDay = Math.min(startDay, daysInMonth(nextY, nextM));
  
  const periodLabel = `${String(periodStartDay).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y} a ${String(periodEndDay).padStart(2, '0')}/${String(nextM).padStart(2, '0')}/${nextY}`;
  
  // Due date: paymentDay of the NEXT month (end of the period)
  // e.g. period 16/01 → 16/02: due on 16/02
  const adjustedDueDay = Math.min(paymentDay, daysInMonth(nextY, nextM));
  const dueDateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(adjustedDueDay).padStart(2, '0')}`;
  const dueDateLabel = `${String(adjustedDueDay).padStart(2, '0')}/${String(nextM).padStart(2, '0')}/${nextY}`;
  
  return { periodLabel, dueDateStr, dueDateLabel };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// Shared status function — uses actual due date (paymentDay of next month)
// so periods still within the payment window are "pending", not "overdue".
export function getRecordStatus(
  month: string,
  paymentDay: number | null | undefined
): 'paid' | 'overdue' | 'pending' {
  const day = paymentDay ?? 1;
  const [y, m] = month.split('-').map(Number);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const maxDay = daysInMonth(nextY, nextM);
  const dueDay = Math.min(day, maxDay);
  const dueDate = new Date(nextY, nextM - 1, dueDay);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today > dueDate ? 'overdue' : 'pending';
}
