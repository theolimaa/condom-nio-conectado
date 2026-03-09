import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface SavedReceipt {
  id: string;
  apartment_id: string;
  tenant_id: string | null;
  contract_id: string | null;
  financial_record_id: string;
  month: string;           // YYYY-MM — período de referência
  payment_date: string | null;
  condominium_name: string;
  apartment_unit: string;
  tenant_name: string;
  receipt_code: string;
  storage_path: string;    // path no Supabase Storage
  public_url: string;      // URL pública para preview/download
  saved_at: string;
}

const BUCKET = 'receipts';

// ─── Garante que o bucket existe (cria se necessário) ─────────────────────────
async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === BUCKET);
  if (!exists) {
    await supabase.storage.createBucket(BUCKET, { public: false });
  }
}

export function useSavedReceipts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['saved_receipts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_receipts')
        .select('*')
        .order('saved_at', { ascending: false });
      if (error) throw error;
      return data as SavedReceipt[];
    },
    enabled: !!user,
  });
}

export function useSaveReceipt() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      pdfBytes,
      receiptCode,
      financialRecordId,
      apartmentId,
      tenantId,
      contractId,
      month,
      paymentDate,
      condominiumName,
      apartmentUnit,
      tenantName,
    }: {
      pdfBytes: Uint8Array;
      receiptCode: string;
      financialRecordId: string;
      apartmentId: string;
      tenantId: string | null;
      contractId: string | null;
      month: string;
      paymentDate: string | null;
      condominiumName: string;
      apartmentUnit: string;
      tenantName: string;
    }) => {
      await ensureBucket();

      // Path: {user_id}/{apartment_id}/{month}.pdf
      // Assim ao re-salvar, substitui o arquivo anterior do mesmo mês
      const storagePath = `${user!.id}/${apartmentId}/${month}.pdf`;

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      // Upsert no storage (substitui se existir)
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // URL pública (signed, 10 anos)
      const { data: signedData, error: signedError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);

      if (signedError) throw signedError;

      const publicUrl = signedData.signedUrl;

      // Upsert no banco (one record per apartment+month)
      const { error: dbError } = await supabase
        .from('saved_receipts')
        .upsert(
          {
            apartment_id: apartmentId,
            tenant_id: tenantId,
            contract_id: contractId,
            financial_record_id: financialRecordId,
            month,
            payment_date: paymentDate,
            condominium_name: condominiumName,
            apartment_unit: apartmentUnit,
            tenant_name: tenantName,
            receipt_code: receiptCode,
            storage_path: storagePath,
            public_url: publicUrl,
            saved_at: new Date().toISOString(),
          },
          { onConflict: 'apartment_id,month' }
        );

      if (dbError) throw dbError;

      return storagePath;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved_receipts'] });
    },
    onError: (e: Error) => {
      console.error('Erro ao salvar recibo:', e);
      // Não mostra toast de erro para não atrapalhar o fluxo de download
    },
  });
}

export function useDeleteSavedReceipt() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      // Remove do storage
      await supabase.storage.from(BUCKET).remove([storagePath]);
      // Remove do banco
      const { error } = await supabase.from('saved_receipts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved_receipts'] });
      toast.success('Recibo excluído!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Gera uma nova signed URL para um recibo existente no storage */
export async function refreshReceiptUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60); // 1 hora
  if (error) return null;
  return data.signedUrl;
}
