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

export function useContracts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['contracts_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ContractDB[];
    },
    enabled: !!user,
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
      qc.invalidateQueries({ queryKey: ['contracts_all'] });
      toast.success('Contrato salvo!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Encerra contrato com soft-delete no inquilino.
 * O toast de sucesso é disparado pelo COMPONENTE (com botão Desfazer),
 * não aqui dentro.
 */
export function useCloseContract() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contractId,
      tenantId,
      apartmentId,
      endDate,
    }: {
      contractId: string;
      tenantId: string;
      apartmentId: string;
      endDate: string;
    }) => {
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();
      if (tenantErr) throw tenantErr;
      if (!tenant) throw new Error('Inquilino não encontrado');

      const { error: contractErr } = await supabase
        .from('contracts')
        .update({ status: 'ended', end_date: endDate })
        .eq('id', contractId);
      if (contractErr) throw contractErr;

      const archivedAt = new Date().toISOString();

      const { error: archiveErr } = await supabase
        .from('tenants')
        .update({ archived_at: archivedAt })
        .eq('id', tenantId);
      if (archiveErr) throw archiveErr;

      const { data: prevTenant, error: prevErr } = await supabase
        .from('previous_tenants')
        .insert({
          first_name: tenant.first_name,
          last_name: tenant.last_name,
          cpf: tenant.cpf,
          email: tenant.email,
          phone: tenant.phone,
          birth_date: tenant.birth_date,
          apartment_id: apartmentId,
          original_id: tenantId,
          archived_at: archivedAt,
        })
        .select()
        .single();
      if (prevErr) throw prevErr;

      return { apartmentId, tenantId, prevTenantId: prevTenant.id, contractId };
    },

    onSuccess: ({ apartmentId, tenantId }) => {
      qc.invalidateQueries({ queryKey: ['tenants', apartmentId] });
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['contract', tenantId] });
      qc.invalidateQueries({ queryKey: ['contracts_all'] });
      qc.invalidateQueries({ queryKey: ['previous_tenants', apartmentId] });
      qc.invalidateQueries({ queryKey: ['previous_tenants'] });
      qc.invalidateQueries({ queryKey: ['financial_records', apartmentId] });
      qc.invalidateQueries({ queryKey: ['financial_records_year'] });
      qc.invalidateQueries({ queryKey: ['apartments'] });
    },
    onError: (e: Error) => toast.error(`Erro ao encerrar contrato: ${e.message}`),
  });
}

/**
 * Desfaz o encerramento de contrato:
 * - Remove archived_at do inquilino
 * - Restaura contrato para status 'active'
 * - Deleta o registro de previous_tenants
 */
export function useUndoCloseContract() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contractId,
      tenantId,
      prevTenantId,
      apartmentId,
    }: {
      contractId: string;
      tenantId: string;
      prevTenantId: string;
      apartmentId: string;
    }) => {
      // Restaura inquilino como ativo
      const { error: tenantErr } = await supabase
        .from('tenants')
        .update({ archived_at: null })
        .eq('id', tenantId);
      if (tenantErr) throw tenantErr;

      // Restaura contrato para ativo
      const { error: contractErr } = await supabase
        .from('contracts')
        .update({ status: 'active', end_date: null })
        .eq('id', contractId);
      if (contractErr) throw contractErr;

      // Remove do histórico
      const { error: prevErr } = await supabase
        .from('previous_tenants')
        .delete()
        .eq('id', prevTenantId);
      if (prevErr) throw prevErr;

      return { apartmentId, tenantId };
    },

    onSuccess: ({ apartmentId, tenantId }) => {
      qc.invalidateQueries({ queryKey: ['tenants', apartmentId] });
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['contract', tenantId] });
      qc.invalidateQueries({ queryKey: ['contracts_all'] });
      qc.invalidateQueries({ queryKey: ['previous_tenants', apartmentId] });
      qc.invalidateQueries({ queryKey: ['previous_tenants'] });
      qc.invalidateQueries({ queryKey: ['apartments'] });
      toast.success('Encerramento desfeito! Contrato reativado.');
    },
    onError: (e: Error) => toast.error(`Erro ao desfazer: ${e.message}`),
  });
}
