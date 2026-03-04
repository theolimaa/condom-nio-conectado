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

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate period label and due date for a financial record.
 *
 * Period: startDay/m/y -> startDay/(m+1)/y
 *
 * Due date rule: the first occurrence of paymentDay that is
 * >= the period end day, within the period-end month or the next.
 *
 * Examples:
 *   startDay=6,  payment_day=6,  month=2026-01 -> Period 06/01->06/02, Due 06/02/2026
 *   startDay=25, payment_day=1,  month=2026-01 -> Period 25/01->25/02, Due 01/03/2026
 *   startDay=16, payment_day=16, month=2026-01 -> Period 16/01->16/02, Due 16/02/2026
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

  // Period bounds
  const periodStartDay = Math.min(startDay, daysInMonth(y, m));
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const periodEndDay = Math.min(startDay, daysInMonth(nextY, nextM));

  const periodLabel =
    `${String(periodStartDay).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}` +
    ` a ` +
    `${String(periodEndDay).padStart(2, '0')}/${String(nextM).padStart(2, '0')}/${nextY}`;

  // Due date: first paymentDay >= periodEndDay in nextM, else in nextM+1
  let dueDateStr: string;
  let dueDateLabel: string;

  if (paymentDay >= periodEndDay) {
    // Due is in the same month the period ends (nextM)
    const dueDay = Math.min(paymentDay, daysInMonth(nextY, nextM));
    dueDateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
    dueDateLabel = `${String(dueDay).padStart(2, '0')}/${String(nextM).padStart(2, '0')}/${nextY}`;
  } else {
    // Due is the month after the period ends
    const dueM = nextM === 12 ? 1 : nextM + 1;
    const dueY = nextM === 12 ? nextY + 1 : nextY;
    const dueDay = Math.min(paymentDay, daysInMonth(dueY, dueM));
    dueDateStr = `${dueY}-${String(dueM).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
    dueDateLabel = `${String(dueDay).padStart(2, '0')}/${String(dueM).padStart(2, '0')}/${dueY}`;
  }

  return { periodLabel, dueDateStr, dueDateLabel };
}

/**
 * Shared status function - uses the same due date logic above.
 * 'overdue' only if today is strictly past the due date.
 */
export function getRecordStatus(
  month: string,
  paymentDay: number | null | undefined
): 'paid' | 'overdue' | 'pending' {
  const day = paymentDay ?? 1;
  const [y, m] = month.split('-').map(Number);

  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const periodEndDay = Math.min(1, daysInMonth(nextY, nextM)); // conservative: use 1 as min

  // Reuse same logic
  let dueDate: Date;
  if (day >= periodEndDay) {
    const dueDay = Math.min(day, daysInMonth(nextY, nextM));
    dueDate = new Date(nextY, nextM - 1, dueDay);
  } else {
    const dueM = nextM === 12 ? 1 : nextM + 1;
    const dueY = nextM === 12 ? nextY + 1 : nextY;
    const dueDay = Math.min(day, daysInMonth(dueY, dueM));
    dueDate = new Date(dueY, dueM - 1, dueDay);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today > dueDate ? 'overdue' : 'pending';
}
