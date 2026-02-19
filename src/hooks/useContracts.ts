import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ContractDB {
  id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  payment_day: number | null;
  desired_payment_day: number | null;
  desired_payment_date: string | null;
  rent_value: number;
  observations: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export function useContract(tenantId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['contract', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .maybeSingle();
      if (error) throw error;
      return data as ContractDB | null;
    },
    enabled: !!user && !!tenantId,
  });
}

export function useUpsertContract() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (contract: Omit<ContractDB, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => {
      if (contract.id) {
        const { id, ...updates } = contract;
        const { data, error } = await supabase
          .from('contracts')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { id: _id, ...insertData } = contract as ContractDB;
        const { data, error } = await supabase
          .from('contracts')
          .insert(insertData)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['contract', data.tenant_id] });
      toast.success('Contrato salvo!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCloseContract() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ contractId, tenantId, endDate }: { contractId: string; tenantId: string; endDate: string }) => {
      const { error } = await supabase
        .from('contracts')
        .update({ status: 'closed', end_date: endDate })
        .eq('id', contractId);
      if (error) throw error;

      // Archive tenant to previous_tenants
      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (tenant) {
        await supabase.from('previous_tenants').insert({
          first_name: tenant.first_name,
          last_name: tenant.last_name,
          cpf: tenant.cpf,
          email: tenant.email,
          phone: tenant.phone,
          birth_date: tenant.birth_date,
          apartment_id: tenant.apartment_id,
          original_id: tenant.id,
          archived_at: new Date().toISOString(),
        });
        // Delete the tenant (cascades documents/residents)
        await supabase.from('tenants').delete().eq('id', tenantId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['contract'] });
      qc.invalidateQueries({ queryKey: ['previous_tenants'] });
      toast.success('Contrato encerrado! Inquilino movido para histórico.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
