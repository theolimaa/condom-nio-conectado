import { useState } from 'react';
import { History, ChevronDown, ChevronUp, Edit2, Trash2, Loader2, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDeletePreviousTenant, useUpdatePreviousTenant } from '@/hooks/useTenants';
import { useFinancialRecords } from '@/hooks/useFinancial';
import { formatDate, formatCurrency } from '@/lib/utils-app';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface PreviousTenant {
  id: string;
  first_name: string;
  last_name: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  apartment_id: string | null;
  original_id: string | null;
  archived_at: string | null;
  created_at: string | null;
}

function PreviousTenantDocuments({ originalTenantId }: { originalTenantId: string | null }) {
  const { data: docs = [] } = useQuery({
    queryKey: ['previous_tenant_docs', originalTenantId],
    queryFn: async () => {
      if (!originalTenantId) return [];
      const { data } = await supabase.from('documents').select('*').eq('tenant_id', originalTenantId);
      return data ?? [];
    },
    enabled: !!originalTenantId,
  });

  if (docs.length === 0) return <p className="text-sm text-muted-foreground">Nenhum documento registrado.</p>;

  return (
    <div className="space-y-2">
      {docs.map(d => (
        <div key={d.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{d.file_name}</span>
          </div>
          <a href={d.file_url} target="_blank" rel="noreferrer">
            <Button size="sm" variant="ghost"><Download className="w-3 h-3" /></Button>
          </a>
        </div>
      ))}
    </div>
  );
}

function PreviousTenantContracts({ originalTenantId }: { originalTenantId: string | null }) {
  const { data: contracts = [] } = useQuery({
    queryKey: ['previous_tenant_contracts', originalTenantId],
    queryFn: async () => {
      if (!originalTenantId) return [];
      const { data } = await supabase.from('contracts').select('*').eq('tenant_id', originalTenantId);
      return data ?? [];
    },
    enabled: !!originalTenantId,
  });

  if (contracts.length === 0) return <p className="text-sm text-muted-foreground">Nenhum contrato registrado.</p>;

  return (
    <div className="space-y-2">
      {contracts.map(c => (
        <div key={c.id} className="p-3 bg-muted/30 rounded-lg grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">Início:</span> {formatDate(c.start_date)}</div>
          <div><span className="text-muted-foreground">Fim:</span> {c.end_date ? formatDate(c.end_date) : '—'}</div>
          <div><span className="text-muted-foreground">Valor:</span> {formatCurrency(c.rent_value)}</div>
          <div><span className="text-muted-foreground">Status:</span> {c.status === 'ended' ? 'Encerrado' : c.status}</div>
        </div>
      ))}
    </div>
  );
}

function PreviousTenantFinancials({ originalTenantId, apartmentId }: { originalTenantId: string | null; apartmentId: string }) {
  const { data: records = [] } = useQuery({
    queryKey: ['previous_tenant_financials', originalTenantId],
    queryFn: async () => {
      if (!originalTenantId) return [];
      const { data } = await supabase
        .from('financial_records')
        .select('*')
        .eq('tenant_id', originalTenantId)
        .eq('apartment_id', apartmentId)
        .order('month', { ascending: true });
      return data ?? [];
    },
    enabled: !!originalTenantId,
  });

  if (records.length === 0) return <p className="text-sm text-muted-foreground">Nenhum registro financeiro.</p>;

  return (
    <div className="max-h-60 overflow-y-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-1 pr-3">Mês Ref.</th>
            <th className="py-1 pr-3">Valor</th>
            <th className="py-1 pr-3">Status</th>
            <th className="py-1">Pagamento</th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id} className="border-b border-border/50">
              <td className="py-1.5 pr-3">{r.month}</td>
              <td className="py-1.5 pr-3">{formatCurrency(r.rent_value)}</td>
              <td className="py-1.5 pr-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'Pago' ? 'bg-green-100 text-green-700' : r.status === 'Inadimplente' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {r.status}
                </span>
              </td>
              <td className="py-1.5">{r.payment_date ? formatDate(r.payment_date) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreviousTenantRow({ tenant, apartmentId }: { tenant: PreviousTenant; apartmentId: string }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const deletePrev = useDeletePreviousTenant();
  const updatePrev = useUpdatePreviousTenant();
  const [form, setForm] = useState({
    first_name: tenant.first_name,
    last_name: tenant.last_name,
    cpf: tenant.cpf ?? '',
    email: tenant.email ?? '',
    phone: tenant.phone ?? '',
  });

  async function handleSave() {
    await updatePrev.mutateAsync({
      id: tenant.id,
      first_name: form.first_name,
      last_name: form.last_name,
      cpf: form.cpf || null,
      email: form.email || null,
      phone: form.phone || null,
    });
    setEditing(false);
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="p-4">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between text-left">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <span className="text-sm font-bold text-muted-foreground">{tenant.first_name.charAt(0)}</span>
              </div>
              <div>
                <p className="font-medium">{tenant.first_name} {tenant.last_name}</p>
                <p className="text-xs text-muted-foreground">
                  Arquivado em: {tenant.archived_at ? formatDate(tenant.archived_at) : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge-closed text-xs">Encerrado</span>
              {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-4">
          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>
              <Edit2 className="w-3 h-3 mr-1" /> {editing ? 'Cancelar' : 'Editar Dados'}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setShowDelete(true)}>
              <Trash2 className="w-3 h-3 mr-1" /> Excluir Definitivamente
            </Button>
          </div>

          {/* Editable personal data */}
          {editing ? (
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input className="mt-1" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
                <div><Label>Sobrenome</Label><Input className="mt-1" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
                <div><Label>CPF</Label><Input className="mt-1" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} /></div>
                <div><Label>Email</Label><Input className="mt-1" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Celular</Label><Input className="mt-1" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <Button size="sm" onClick={handleSave} disabled={updatePrev.isPending}>
                {updatePrev.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Salvar
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-sm p-3 bg-muted/30 rounded-lg">
              <div><span className="text-muted-foreground">CPF:</span> {tenant.cpf || '—'}</div>
              <div><span className="text-muted-foreground">Email:</span> {tenant.email || '—'}</div>
              <div><span className="text-muted-foreground">Celular:</span> {tenant.phone || '—'}</div>
            </div>
          )}

          {/* Documents */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Documentos</h4>
            <PreviousTenantDocuments originalTenantId={tenant.original_id} />
          </div>

          {/* Contract */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Contrato</h4>
            <PreviousTenantContracts originalTenantId={tenant.original_id} />
          </div>

          {/* Financial History */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Histórico Financeiro</h4>
            <PreviousTenantFinancials originalTenantId={tenant.original_id} apartmentId={apartmentId} />
          </div>

          {/* Delete confirmation */}
          <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Registro Definitivamente</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir o registro de <strong>{tenant.first_name} {tenant.last_name}</strong> do histórico? Esta ação é irreversível.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deletePrev.mutate(tenant.id)} className="bg-destructive hover:bg-destructive/90">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function PreviousTenantsTab({ previousTenants, apartmentId }: {
  previousTenants: PreviousTenant[];
  apartmentId: string;
}) {
  if (previousTenants.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p>Nenhum inquilino anterior registrado.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {previousTenants.map(t => (
        <PreviousTenantRow key={t.id} tenant={t} apartmentId={apartmentId} />
      ))}
    </div>
  );
}
