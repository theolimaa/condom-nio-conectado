import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useApp } from '@/lib/store';
import { Contract, Tenant } from '@/lib/types';
import { formatCurrency, formatDate, generateId } from '@/lib/utils-app';

export default function ContractTab({ tenant, apartmentId }: { tenant: Tenant; apartmentId: string }) {
  const { dispatch } = useApp();
  const [editing, setEditing] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState<Partial<Contract>>(tenant.contract ?? {});

  function handleSave() {
    if (!form.startDate || !form.dueDay || !form.rentValue) return;
    const contract: Contract = {
      id: tenant.contract?.id ?? generateId(),
      apartmentId,
      startDate: form.startDate!,
      dueDay: Number(form.dueDay),
      rentValue: Number(form.rentValue),
      depositPaid: form.depositPaid ?? false,
      depositValue: Number(form.depositValue ?? 0),
      depositDate: form.depositDate ?? '',
      status: 'active',
    };
    dispatch({ type: 'UPDATE_CONTRACT', payload: { apartmentId, contract } });
    setEditing(false);
  }

  function handleClose() {
    dispatch({ type: 'CLOSE_CONTRACT', payload: { apartmentId, tenantId: tenant.id, endDate } });
    setShowClose(false);
  }

  const contract = tenant.contract;

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
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{contract ? 'Editar Contrato' : 'Novo Contrato'}</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Data de Início *</Label>
            <Input className="mt-1" type="date" value={form.startDate ?? ''} onChange={e => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div>
            <Label>Dia de Vencimento *</Label>
            <Input className="mt-1" type="number" min={1} max={31} placeholder="Ex: 15" value={form.dueDay ?? ''} onChange={e => setForm({ ...form, dueDay: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Valor do Aluguel *</Label>
            <Input className="mt-1" type="number" step="0.01" placeholder="1500.00" value={form.rentValue ?? ''} onChange={e => setForm({ ...form, rentValue: Number(e.target.value) })} />
          </div>
        </div>
        <div className="border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label>Caução paga?</Label>
            <Switch
              checked={form.depositPaid ?? false}
              onCheckedChange={v => setForm({ ...form, depositPaid: v })}
            />
          </div>
          {form.depositPaid && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor da Caução</Label>
                <Input className="mt-1" type="number" step="0.01" value={form.depositValue ?? ''} onChange={e => setForm({ ...form, depositValue: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Data do Pagamento</Label>
                <Input className="mt-1" type="date" value={form.depositDate ?? ''} onChange={e => setForm({ ...form, depositDate: e.target.value })} />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar Contrato</Button>
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
              <Button size="sm" variant="outline" onClick={() => { setForm(contract); setEditing(true); }}>Editar</Button>
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
          <p className="font-semibold">{formatDate(contract?.startDate ?? '')}</p>
        </div>
        {contract?.endDate && (
          <div className="bg-muted/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Encerramento</p>
            <p className="font-semibold">{formatDate(contract.endDate)}</p>
          </div>
        )}
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Valor do Aluguel</p>
          <p className="font-semibold text-lg">{formatCurrency(contract?.rentValue ?? 0)}</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Dia de Vencimento</p>
          <p className="font-semibold">Todo dia {contract?.dueDay}</p>
        </div>
      </div>

      {contract?.depositPaid && (
        <div className="bg-secondary border border-border rounded-xl p-4">
          <p className="text-sm font-medium mb-2" style={{ color: 'hsl(var(--success))' }}>Caução</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="font-semibold">{formatCurrency(contract.depositValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Data de Pagamento</p>
              <p className="font-semibold">{formatDate(contract.depositDate)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Close contract dialog */}
      <AlertDialog open={showClose} onOpenChange={setShowClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Encerrar Contrato
            </AlertDialogTitle>
            <AlertDialogDescription>
              O inquilino <strong>{tenant.name}</strong> será movido para "Inquilinos Anteriores" junto com todos os seus documentos e histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-4 pb-2">
            <Label>Data de encerramento</Label>
            <Input className="mt-1" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose} className="bg-destructive hover:bg-destructive/90">
              Encerrar Contrato
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
