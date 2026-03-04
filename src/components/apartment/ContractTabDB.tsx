import { useState, useRef } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useContract, useUpsertContract, useCloseContract, useUndoCloseContract, ContractDB } from '@/hooks/useContracts';
import { useBulkGeneratePeriods } from '@/hooks/useFinancial';
import { formatCurrency, formatDate } from '@/lib/utils-app';
import { toast } from 'sonner';

export default function ContractTabDB({ tenantId, apartmentId, tenantName }: {
  tenantId: string;
  apartmentId: string;
  tenantName: string;
}) {
  const { data: contract, isLoading } = useContract(tenantId);
  const upsertContract = useUpsertContract();
  const closeContract = useCloseContract();
  const undoClose = useUndoCloseContract();
  const bulkGenerate = useBulkGeneratePeriods();

  const [editing, setEditing] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState<Partial<ContractDB>>({});

  const lastCloseRef = useRef<{
    contractId: string; tenantId: string; prevTenantId: string; apartmentId: string;
  } | null>(null);

  function startEdit() {
    setForm(contract ?? {});
    setEditing(true);
  }

  async function handleSave() {
    if (!form.start_date || !form.rent_value) return;
    const result = await upsertContract.mutateAsync({
      id: contract?.id,
      tenant_id: tenantId,
      start_date: form.start_date!,
      end_date: form.end_date ?? null,
      payment_day: form.payment_day ?? null,
      desired_payment_day: null,
      desired_payment_date: null,
      rent_value: Number(form.rent_value),
      observations: form.observations ?? null,
      status: 'active',
      caution_paid: form.caution_paid ?? false,
      caution_value: form.caution_value ? Number(form.caution_value) : null,
      caution_date: form.caution_date ?? null,
    });
    if (result?.id) {
      await bulkGenerate.mutateAsync({
        apartmentId, tenantId, contractId: result.id,
        startDate: form.start_date!, rentValue: Number(form.rent_value),
        paymentDay: form.payment_day ?? 1,
      });
    }
    setEditing(false);
  }

  async function handleClose() {
    if (!contract) return;
    const result = await closeContract.mutateAsync({ contractId: contract.id, tenantId, apartmentId, endDate });
    setShowClose(false);

    lastCloseRef.current = {
      contractId: result.contractId, tenantId: result.tenantId,
      prevTenantId: result.prevTenantId, apartmentId: result.apartmentId,
    };

    toast.success(`Contrato de ${tenantName} encerrado.`, {
      duration: 60000,
      action: {
        label: '↩ Desfazer',
        onClick: async () => {
          if (!lastCloseRef.current) return;
          await undoClose.mutateAsync(lastCloseRef.current);
          lastCloseRef.current = null;
        },
      },
    });
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  if (!contract && !editing) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-muted-foreground mb-4">Nenhum contrato cadastrado</p>
        <Button onClick={() => { setForm({}); setEditing(true); }}>Adicionar Contrato</Button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-5">
        <h3 className="font-semibold">{contract ? 'Editar Contrato' : 'Novo Contrato'}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Data de Início *</Label>
            <Input className="mt-1" type="date" value={form.start_date ?? ''} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div>
            <Label>Dia de Vencimento</Label>
            <Input className="mt-1" type="number" min={1} max={31} placeholder="Ex: 15" value={form.payment_day ?? ''} onChange={e => setForm({ ...form, payment_day: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Valor do Aluguel *</Label>
            <Input className="mt-1" type="number" step="0.01" placeholder="1500.00" value={form.rent_value ?? ''} onChange={e => setForm({ ...form, rent_value: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Observações</Label>
            <Input className="mt-1" value={form.observations ?? ''} onChange={e => setForm({ ...form, observations: e.target.value })} placeholder="Observações do contrato..." />
          </div>
        </div>

        {/* Caução */}
        <div className="border border-border rounded-xl p-4 space-y-3">
          <p className="font-semibold text-sm">Caução</p>
          <div className="flex items-center gap-3">
            <Label className="text-sm">Caução paga?</Label>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="caution_paid"
                  checked={form.caution_paid === true}
                  onChange={() => setForm({ ...form, caution_paid: true })}
                />
                Sim
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="caution_paid"
                  checked={!form.caution_paid}
                  onChange={() => setForm({ ...form, caution_paid: false, caution_value: null, caution_date: null })}
                />
                Não
              </label>
            </div>
          </div>

          {form.caution_paid && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor da Caução</Label>
                <Input
                  className="mt-1"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.caution_value ?? ''}
                  onChange={e => setForm({ ...form, caution_value: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Data do Pagamento</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={form.caution_date ?? ''}
                  onChange={e => setForm({ ...form, caution_date: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsertContract.isPending}>
            {upsertContract.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar Contrato
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Detalhes do Contrato</h3>
        <div className="flex gap-2">
          {contract?.status === 'active' && (
            <>
              <Button size="sm" variant="outline" onClick={startEdit}>Editar</Button>
              <Button size="sm" variant="destructive" onClick={() => setShowClose(true)}>
                <XCircle className="w-4 h-4 mr-2" /> Encerrar Contrato
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${contract?.status === 'active' ? 'badge-active' : 'badge-closed'}`}>
        {contract?.status === 'active' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        {contract?.status === 'active' ? 'Ativo' : 'Encerrado'}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Início do Contrato</p>
          <p className="font-semibold">{formatDate(contract?.start_date ?? '')}</p>
        </div>
        {contract?.end_date && (
          <div className="bg-muted/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Encerramento</p>
            <p className="font-semibold">{formatDate(contract.end_date)}</p>
          </div>
        )}
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Valor do Aluguel</p>
          <p className="font-semibold text-lg">{formatCurrency(contract?.rent_value ?? 0)}</p>
        </div>
        {contract?.payment_day && (
          <div className="bg-muted/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Dia de Vencimento</p>
            <p className="font-semibold">Todo dia {contract.payment_day}</p>
          </div>
        )}
        {/* Exibe caução se preenchida */}
        {contract?.caution_paid && (
          <div className="bg-muted/50 rounded-xl p-4 col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Caução</p>
            <p className="font-semibold text-sm">
              Paga{contract.caution_value ? ` — ${formatCurrency(contract.caution_value)}` : ''}
              {contract.caution_date ? ` em ${formatDate(contract.caution_date)}` : ''}
            </p>
          </div>
        )}
      </div>

      {contract?.observations && (
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Observações</p>
          <p className="text-sm">{contract.observations}</p>
        </div>
      )}

      <AlertDialog open={showClose} onOpenChange={setShowClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Encerrar Contrato
            </AlertDialogTitle>
            <AlertDialogDescription>
              O inquilino <strong>{tenantName}</strong> será movido para "Inquilinos Anteriores". Você terá <strong>1 minuto</strong> para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-4 pb-2">
            <Label>Data de encerramento</Label>
            <Input className="mt-1" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose} disabled={closeContract.isPending} className="bg-destructive hover:bg-destructive/90">
              {closeContract.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Encerrar Contrato
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
