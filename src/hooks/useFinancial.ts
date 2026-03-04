import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { addMonths } from 'date-fns';

export interface FinancialRecordDB {
  id: string;
  apartment_id: string;
  tenant_id: string | null;
  contract_id: string | null;
  month: string;
  rent_value: number;
  paid: boolean | null;
  payment_date: string | null;
  status: string | null;
  observations: string | null;
  receipt_number: string | null;
  receipt_generated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
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
        .order('month', { ascending: true });
      if (error) throw error;
      return data as FinancialRecordDB[];
    },
    enabled: !!user && !!apartmentId,
  });
}

/**
 * Busca registros financeiros de UM ANO ESPECÍFICO.
 * Evita o limite do Supabase buscando ~400 registros em vez de 6000+.
 */
export function useFinancialRecordsByYear(year: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['financial_records_year', user?.id, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_records')
        .select('*')
        .gte('month', `${year}-01`)
        .lte('month', `${year}-12`)
        .order('month', { ascending: true });
      if (error) throw error;
      return data as FinancialRecordDB[];
    },
    enabled: !!user && !!year,
  });
}

export function useAllFinancialRecords() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['financial_records_all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_records')
        .select('*')
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
      qc.invalidateQueries({ queryKey: ['financial_records_year'] });
      qc.invalidateQueries({ queryKey: ['financial_records_all'] });
    },
    onError: (e: Error) => toast.error(e.message),
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
      qc.invalidateQueries({ queryKey: ['financial_records_year'] });
      qc.invalidateQueries({ queryKey: ['financial_records_all'] });
      toast.success('Registro removido!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateUnpaidRentValues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, apartmentId, rentValue }: { contractId: string; apartmentId: string; rentValue: number }) => {
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
      qc.invalidateQueries({ queryKey: ['financial_records_year'] });
      qc.invalidateQueries({ queryKey: ['financial_records_all'] });
    },
    onError: (e: Error) => toast.error(`Erro ao atualizar valores: ${e.message}`),
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
      status: 'Pendente',
      observations: null,
      receipt_number: null,
      receipt_generated_at: null,
    });
    i++;
  }
  return records;
}

/**
 * Gera períodos financeiros mensais até Dez/2045.
 * CORREÇÃO: checa meses existentes por apartment_id (não só contract_id)
 * para evitar duplicatas quando o registro pago tem contract_id diferente/nulo.
 */
export function useBulkGeneratePeriods() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      apartmentId, tenantId, contractId, startDate, rentValue, paymentDay,
    }: {
      apartmentId: string; tenantId: string; contractId: string;
      startDate: string; rentValue: number; paymentDay: number;
    }) => {
      // ✅ CORREÇÃO: busca por apartment_id para pegar TODOS os registros do apto,
      // incluindo os que têm contract_id nulo ou de contrato anterior
      const { data: existing } = await supabase
        .from('financial_records')
        .select('month')
        .eq('apartment_id', apartmentId);

      const existingMonths = new Set((existing ?? []).map(r => r.month));

      const allRecords = generateMonthsForContract(
        apartmentId, tenantId, contractId, startDate, rentValue, paymentDay
      );

      // Só insere meses que não existem de forma alguma para este apartamento
      const newRecords = allRecords.filter(r => !existingMonths.has(r.month));

      if (newRecords.length === 0) return 0;

      for (let i = 0; i < newRecords.length; i += 500) {
        const batch = newRecords.slice(i, i + 500);
        const { error } = await supabase.from('financial_records').insert(batch);
        if (error) throw error;
      }
      return newRecords.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['financial_records'] });
      qc.invalidateQueries({ queryKey: ['financial_records_year'] });
      qc.invalidateQueries({ queryKey: ['financial_records_all'] });
      if (count && count > 0) toast.success(`${count} períodos financeiros gerados!`);
    },
    onError: (e: Error) => toast.error(`Erro ao gerar períodos: ${e.message}`),
  });
}
