import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface TenantDB {
  id: string;
  apartment_id: string;
  first_name: string;
  last_name: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResidentDB {
  id: string;
  tenant_id: string;
  name: string;
  surname: string | null;
  cpf: string | null;
  email: string | null;
  relationship: string | null;
  created_at: string;
}

export function useTenants(apartmentId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['tenants', apartmentId],
    queryFn: async () => {
      let query = supabase.from('tenants').select('*').order('created_at', { ascending: false });
      if (apartmentId) query = query.eq('apartment_id', apartmentId);
      const { data, error } = await query;
      if (error) throw error;
      return data as TenantDB[];
    },
    enabled: !!user,
  });
}

export function useResidents(tenantId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['residents', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('residents')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at');
      if (error) throw error;
      return data as ResidentDB[];
    },
    enabled: !!user && !!tenantId,
  });
}

export function useAddTenant() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (tenant: Omit<TenantDB, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('tenants')
        .insert(tenant)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tenants', data.apartment_id] });
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Inquilino adicionado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TenantDB> & { id: string }) => {
      const { error } = await supabase
        .from('tenants')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Inquilino atualizado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTenant() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Archive to previous_tenants first
      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', id)
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
        });
      }

      const { error } = await supabase.from('tenants').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['previous_tenants'] });
      toast.success('Inquilino excluído!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddResident() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (resident: Omit<ResidentDB, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('residents')
        .insert(resident)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['residents', data.tenant_id] });
      toast.success('Morador adicionado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteResident() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tenantId }: { id: string; tenantId: string }) => {
      const { error } = await supabase.from('residents').delete().eq('id', id);
      if (error) throw error;
      return tenantId;
    },
    onSuccess: (tenantId) => {
      qc.invalidateQueries({ queryKey: ['residents', tenantId] });
      toast.success('Morador removido!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePreviousTenants(apartmentId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['previous_tenants', apartmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('previous_tenants')
        .select('*')
        .eq('apartment_id', apartmentId)
        .order('archived_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!apartmentId,
  });
}
