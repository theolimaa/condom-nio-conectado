import { useApp } from '@/lib/store';
import { MONTHS, YEARS } from '@/lib/utils-app';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function GlobalFilter() {
  const { state, dispatch } = useApp();

  return (
    <div className="flex items-center gap-2">
      <Select
        value={String(state.selectedYear)}
        onValueChange={(v) => dispatch({ type: 'SET_YEAR', payload: Number(v) })}
      >
        <SelectTrigger className="w-28 h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {YEARS.map(y => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={state.selectedMonth !== null ? String(state.selectedMonth) : 'all'}
        onValueChange={(v) => dispatch({ type: 'SET_MONTH', payload: v === 'all' ? null : Number(v) })}
      >
        <SelectTrigger className="w-36 h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os meses</SelectItem>
          {MONTHS.map((m, i) => (
            <SelectItem key={i} value={String(i)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
