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
      // 1. Buscar dados do inquilino antes de deletar
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();
      if (tenantErr) throw tenantErr;
      if (!tenant) throw new Error('Inquilino não encontrado');

      // 2. Buscar dados do contrato para o histórico
      const { data: contract } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', contractId)
        .single();

      // 3. Inserir no histórico de inquilinos anteriores
      const { error: prevErr } = await supabase.from('previous_tenants').insert({
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
      if (prevErr) throw prevErr;

      // 4. Nullar tenant_id nos registros financeiros (coluna é nullable)
      //    Mantemos os registros para histórico financeiro do apartamento
      await supabase
        .from('financial_records')
        .update({ tenant_id: null })
        .eq('tenant_id', tenantId)
        .eq('paid', false); // só limpa os não pagos; mantém referência nos pagos

      // 5. Deletar moradores adicionais
      await supabase.from('residents').delete().eq('tenant_id', tenantId);

      // 6. Deletar documentos do inquilino
      await supabase.from('documents').delete().eq('tenant_id', tenantId);

      // 7. Deletar o contrato (FK NOT NULL — precisa ser deletado antes do inquilino)
      const { error: contractDelErr } = await supabase
        .from('contracts')
        .delete()
        .eq('id', contractId);
      if (contractDelErr) throw contractDelErr;

      // 8. Agora sim deletar o inquilino (sem FK bloqueando)
      const { error: tenantDelErr } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenantId);
      if (tenantDelErr) throw tenantDelErr;

      return { apartmentId, tenantId };
    },
    onSuccess: ({ apartmentId, tenantId }) => {
      // Invalidar TODAS as queries afetadas em cascata
      qc.invalidateQueries({ queryKey: ['tenants', apartmentId] });
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['contract', tenantId] });
      qc.invalidateQueries({ queryKey: ['contracts_all'] });
      qc.invalidateQueries({ queryKey: ['previous_tenants', apartmentId] });
      qc.invalidateQueries({ queryKey: ['previous_tenants'] });
      qc.invalidateQueries({ queryKey: ['financial_records', apartmentId] });
      qc.invalidateQueries({ queryKey: ['financial_records_all'] });
      qc.invalidateQueries({ queryKey: ['apartments', apartmentId] });
      qc.invalidateQueries({ queryKey: ['apartments'] });
      toast.success('Contrato encerrado! Inquilino movido para histórico.');
    },
    onError: (e: Error) => toast.error(`Erro ao encerrar contrato: ${e.message}`),
  });
}
