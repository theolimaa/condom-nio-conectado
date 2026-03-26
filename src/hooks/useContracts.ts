import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { addMonths } from 'date-fns';

/** Extrai mensagem de erro de qualquer tipo — Error nativo ou PostgrestError do Supabase */
function errMsg(e: unknown): string {
  if (!e) return 'Erro desconhecido';
  if (typeof e === 'string') return e;
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.details === 'string') return obj.details;
    if (typeof obj.hint === 'string') return obj.hint;
  }
  return JSON.stringify(e);
}

export interface FinancialRecordDB {
  id: string;
  apartment_id: string;
  tenant_id: string | null;
  contract_id: string | null;
  month: string;
  rent_value: number;
  paid: boolean | null;
  payment_date: string | null;
  paid_amount: number | null;        // valor efetivamente pago (pode ser < rent_value)
  payment_method: string | null;     // 'pix' | 'especie'
  debt_paid_amount: number | null;   // pagamento posterior do saldo devedor
  debt_payment_date: string | null;
  debt_payment_method: string | null;
  status: string | null;
  observations: string | null;
  receipt_number: string | null;
  receipt_generated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Saldo devedor = diferença entre valor do contrato e o que foi pago.
 *  Só existe quando paid=true mas o valor pago foi parcial.
 *  Registros não pagos (pending/overdue) retornam 0 — eles já aparecem em A Receber ou Inadimplente. */
export function calcOwed(r: FinancialRecordDB): number {
  if (!r.paid) return 0; // não pagou → não é "devendo", é inadimplente ou a receber
  const paid = r.paid_amount ?? r.rent_value; // retrocompat: sem paid_amount assume pago completo
  const debtPaid = r.debt_paid_amount ?? 0;
  return Math.max(0, r.rent_value - paid - debtPaid);
}

/** Valor total efetivamente recebido de um registro */
export function calcReceived(r: FinancialRecordDB): number {
  if (!r.paid) return 0;
  const paid = r.paid_amount ?? r.rent_value;
  const debtPaid = r.debt_paid_amount ?? 0;
  return Math.min(r.rent_value, paid + debtPaid);
}

export function useFinancialRecords(apartmentId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['financial_records', apartmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_records')
        .select('*')
        .eq('apartment_id', apartmentId)
        .order('month', { ascending: true })
        .limit(10000);
      if (error) throw error;
      return data as FinancialRecordDB[];
    },
    enabled: !!user && !!apartmentId,
  });
}

export function useAllFinancialRecords() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['financial_records_all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_records')
        .select('*, apartments!inner(condominium_id, condominiums!inner(user_id))')
        .order('month', { ascending: true })
        .limit(50000);
      if (error) throw error;
      return data as FinancialRecordDB[];
    },
    enabled: !!user,
  });
}

export function useFinancialRecordsByYear(year: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['financial_records_year', year, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_records')
        .select('*')
        .gte('month', `${year}-01`)
        .lte('month', `${year}-12`)
        .order('month', { ascending: true })
        .limit(50000);
      if (error) throw error;
      return data as FinancialRecordDB[];
    },
    enabled: !!user,
  });
}

export function useUpsertFinancialRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: Omit<FinancialRecordDB, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => {
      if (record.id) {
        const { id, ...updates } = record;
        const { data, error } = await supabase
          .from('financial_records')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { id: _id, ...insertData } = record as FinancialRecordDB;
        const { data, error } = await supabase
          .from('financial_records')
          .insert(insertData)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['financial_records', data.apartment_id] });
      qc.invalidateQueries({ queryKey: ['financial_records_all'] });
      qc.invalidateQueries({ queryKey: ['financial_records_year'] });
    },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });
}

export function useDeleteFinancialRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, apartmentId }: { id: string; apartmentId: string }) => {
      const { error } = await supabase.from('financial_records').delete().eq('id', id);
      if (error) throw error;
      return apartmentId;
    },
    onSuccess: (apartmentId) => {
      qc.invalidateQueries({ queryKey: ['financial_records', apartmentId] });
      qc.invalidateQueries({ queryKey: ['financial_records_all'] });
      qc.invalidateQueries({ queryKey: ['financial_records_year'] });
      toast.success('Registro removido!');
    },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });
}

export function useUpdateUnpaidRentValues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId, apartmentId, rentValue,
    }: { contractId: string; apartmentId: string; rentValue: number }) => {
      const { error } = await supabase
        .from('financial_records')
        .update({ rent_value: rentValue })
        .eq('contract_id', contractId)
        .eq('paid', false);
      if (error) throw error;
      return apartmentId;
    },
    onSuccess: (apartmentId) => {
      qc.invalidateQueries({ queryKey: ['financial_records', apartmentId] });
      qc.invalidateQueries({ queryKey: ['financial_records_all'] });
      qc.invalidateQueries({ queryKey: ['financial_records_year'] });
    },
    onError: (e: unknown) => toast.error(`Erro ao atualizar valores: ${errMsg(e)}`),
  });
}

export function generateMonthsForContract(
  apartmentId: string,
  tenantId: string,
  contractId: string,
  startDate: string,
  rentValue: number,
  _paymentDay: number,
): Omit<FinancialRecordDB, 'id' | 'created_at' | 'updated_at'>[] {
  const records: Omit<FinancialRecordDB, 'id' | 'created_at' | 'updated_at'>[] = [];
  const start = new Date(startDate + 'T12:00:00');
  const endLimit = new Date('2045-12-31T23:59:59');
  let i = 0;
  while (true) {
    const periodStart = addMonths(start, i);
    if (periodStart > endLimit) break;
    const year = periodStart.getFullYear();
    const month = String(periodStart.getMonth() + 1).padStart(2, '0');
    records.push({
      apartment_id: apartmentId,
      tenant_id: tenantId,
      contract_id: contractId,
      month: `${year}-${month}`,
      rent_value: rentValue,
      paid: false,
      payment_date: null,
      paid_amount: null,
      payment_method: null,
      debt_paid_amount: null,
      debt_payment_date: null,
      debt_payment_method: null,
      status: 'Pendente',
      observations: null,
      receipt_number: null,
      receipt_generated_at: null,
    });
    i++;
  }
  return records;
}

export function useBulkGeneratePeriods() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      apartmentId, tenantId, contractId, startDate, rentValue, paymentDay,
    }: {
      apartmentId: string; tenantId: string; contractId: string;
      startDate: string; rentValue: number; paymentDay: number;
    }) => {
      // Verifica meses já existentes por apartment_id (o constraint único é apartment+month)
      const { data: existing } = await supabase
        .from('financial_records')
        .select('month')
        .eq('apartment_id', apartmentId)
        .limit(10000);

      const existingMonths = new Set((existing ?? []).map(r => r.month));
      const allRecords = generateMonthsForContract(apartmentId, tenantId, contractId, startDate, rentValue, paymentDay);
      const newRecords = allRecords.filter(r => !existingMonths.has(r.month));

      if (newRecords.length === 0) return { count: 0, apartmentId };

      for (let i = 0; i < newRecords.length; i += 500) {
        const batch = newRecords.slice(i, i + 500);
        const { error } = await supabase.from('financial_records').insert(batch);
        if (error) throw error;
      }
      return { count: newRecords.length, apartmentId };
    },
    onSuccess: (result) => {
      // Invalidate by exact apartment key so FinancialTabDB refreshes immediately
      qc.invalidateQueries({ queryKey: ['financial_records', result.apartmentId] });
      qc.invalidateQueries({ queryKey: ['financial_records'] });
      qc.invalidateQueries({ queryKey: ['financial_records_all'] });
      qc.invalidateQueries({ queryKey: ['financial_records_year'] });
      if (result.count > 0) toast.success(`${result.count} períodos financeiros gerados!`);
    },
    onError: (e: unknown) => toast.error(`Erro ao gerar períodos: ${errMsg(e)}`, { duration: 10000 }),
  });
}
