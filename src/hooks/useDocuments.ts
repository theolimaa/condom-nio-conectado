import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface DocumentDB {
  id: string;
  tenant_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  uploaded_at: string;
}

export function useDocuments(tenantId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['documents', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data as DocumentDB[];
    },
    enabled: !!user && !!tenantId,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, tenantId }: { file: File; tenantId: string }) => {
      const ext = file.name.split('.').pop();
      const path = `${tenantId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('tenant-documents')
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tenant-documents')
        .getPublicUrl(path);

      const { data, error } = await supabase
        .from('documents')
        .insert({
          tenant_id: tenantId,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type.includes('pdf') ? 'pdf' : file.type.includes('image') ? 'image' : 'other',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['documents', data.tenant_id] });
      toast.success('Documento enviado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tenantId }: { id: string; tenantId: string }) => {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      return tenantId;
    },
    onSuccess: (tenantId) => {
      qc.invalidateQueries({ queryKey: ['documents', tenantId] });
      toast.success('Documento excluído!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
