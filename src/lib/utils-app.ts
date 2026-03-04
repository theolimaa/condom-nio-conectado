import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch { return dateStr; }
}

export function formatDateLong(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch { return dateStr; }
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
 *
 * Period: startDay of THIS month -> startDay of NEXT month
 * Due date: paymentDay of the month AFTER the period ends
 *
 * Example: Contract starts 25/01, payment_day=1, month key=2026-01
 *   Period:   25/01/2026 a 25/02/2026
 *   Due date: 01/03/2026  (day 1 of March = month after period end)
 *
 * Example: month key=2026-02
 *   Period:   25/02/2026 a 25/03/2026
 *   Due date: 01/04/2026
 */
export function getPeriodAndDueDate(
  monthStr: string,
  contractStartDate: string | null,
  paymentDay: number
) {
  const [y, m] = monthStr.split('-').map(Number);

  // Start day from contract
  let startDay = 1;
  if (contractStartDate) {
    const parsed = new Date(contractStartDate + 'T12:00:00');
    startDay = parsed.getDate();
  }

  // Period: startDay/m/y -> startDay/(m+1)/y
  const periodStartDay = Math.min(startDay, daysInMonth(y, m));
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const periodEndDay = Math.min(startDay, daysInMonth(nextY, nextM));

  const periodLabel =
    `${String(periodStartDay).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}` +
    ` a ` +
    `${String(periodEndDay).padStart(2, '0')}/${String(nextM).padStart(2, '0')}/${nextY}`;

  // Due date: paymentDay of the month AFTER the period end
  // Period ends in nextM/nextY, so due date is in dueM/dueY
  const dueM = nextM === 12 ? 1 : nextM + 1;
  const dueY = nextM === 12 ? nextY + 1 : nextY;
  const adjustedDueDay = Math.min(paymentDay, daysInMonth(dueY, dueM));

  const dueDateStr = `${dueY}-${String(dueM).padStart(2, '0')}-${String(adjustedDueDay).padStart(2, '0')}`;
  const dueDateLabel = `${String(adjustedDueDay).padStart(2, '0')}/${String(dueM).padStart(2, '0')}/${dueY}`;

  return { periodLabel, dueDateStr, dueDateLabel };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Shared status function.
 * A record is 'overdue' only if today is past the due date
 * (paymentDay of the month AFTER the period end).
 */
export function getRecordStatus(
  month: string,
  paymentDay: number | null | undefined
): 'paid' | 'overdue' | 'pending' {
  const day = paymentDay ?? 1;
  const [y, m] = month.split('-').map(Number);

  // Period ends in nextM/nextY
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;

  // Due date: paymentDay of the month AFTER the period end
  const dueM = nextM === 12 ? 1 : nextM + 1;
  const dueY = nextM === 12 ? nextY + 1 : nextY;

  const maxDay = daysInMonth(dueY, dueM);
  const dueDay = Math.min(day, maxDay);
  const dueDate = new Date(dueY, dueM - 1, dueDay);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today > dueDate ? 'overdue' : 'pending';
}
