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

export function useAllFinancialRecords() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['financial_records_all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_records')
        .select('*, apartments!inner(condominium_id, condominiums!inner(user_id))')
        .order('month', { ascending: true });
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
      qc.invalidateQueries({ queryKey: ['financial_records_all'] });
      toast.success('Registro removido!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Generate ALL monthly financial records from contract start until Dec 2045.
 * Period is tied to the contract start day. Due date uses paymentDay.
 * Uses date-fns for leap year / short month precision.
 */
export function generateMonthsForContract(
  apartmentId: string,
  tenantId: string,
  contractId: string,
  startDate: string,
  rentValue: number,
  paymentDay: number,
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
    const monthStr = `${year}-${month}`;

    records.push({
      apartment_id: apartmentId,
      tenant_id: tenantId,
      contract_id: contractId,
      month: monthStr,
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

/** Bulk insert financial periods, skipping months that already exist */
export function useBulkGeneratePeriods() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      apartmentId, tenantId, contractId, startDate, rentValue, paymentDay
    }: {
      apartmentId: string; tenantId: string; contractId: string;
      startDate: string; rentValue: number; paymentDay: number;
    }) => {
      // Fetch existing months to avoid duplicates
      const { data: existing } = await supabase
        .from('financial_records')
        .select('month')
        .eq('contract_id', contractId);

      const existingMonths = new Set((existing ?? []).map(r => r.month));

      const allRecords = generateMonthsForContract(
        apartmentId, tenantId, contractId, startDate, rentValue, paymentDay
      );

      const newRecords = allRecords.filter(r => !existingMonths.has(r.month));

      if (newRecords.length === 0) return 0;

      // Insert in batches of 500 to stay within limits
      for (let i = 0; i < newRecords.length; i += 500) {
        const batch = newRecords.slice(i, i + 500);
        const { error } = await supabase.from('financial_records').insert(batch);
        if (error) throw error;
      }

      return newRecords.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['financial_records'] });
      qc.invalidateQueries({ queryKey: ['financial_records_all'] });
      if (count > 0) toast.success(`${count} períodos financeiros gerados automaticamente!`);
    },
    onError: (e: Error) => toast.error(`Erro ao gerar períodos: ${e.message}`),
  });
}
