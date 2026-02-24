import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

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

/** Generate monthly financial records from a contract (24 months) */
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

  for (let i = 0; i < 24; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
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
  }

  return records;
}
