import { useState } from 'react';
import { Plus, Trash2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useApp } from '@/lib/store';
import { Resident, Tenant } from '@/lib/types';
import { generateId } from '@/lib/utils-app';

export default function TenantTab({ tenant, apartmentId, onDelete }: {
  tenant: Tenant; apartmentId: string; onDelete: () => void;
}) {
  const { dispatch } = useApp();
  const [editMode, setEditMode] = useState(false);
  const [showDeleteTenant, setShowDeleteTenant] = useState(false);
  const [form, setForm] = useState({
    name: tenant.name,
    cpf: tenant.cpf,
    phone: tenant.phone,
    email: tenant.email,
  });
  const [residents, setResidents] = useState<Resident[]>(tenant.additionalResidents);
  const [newResident, setNewResident] = useState({ name: '', cpf: '', phone: '', email: '' });
  const [showAddResident, setShowAddResident] = useState(false);

  function handleSaveTenant() {
    dispatch({ type: 'UPDATE_TENANT', payload: { apartmentId, tenant: { ...tenant, ...form, additionalResidents: residents } } });
    setEditMode(false);
  }

  function handleAddResident() {
    if (!newResident.name) return;
    const updated = [...residents, { ...newResident, id: generateId() }];
    setResidents(updated);
    dispatch({ type: 'UPDATE_TENANT', payload: { apartmentId, tenant: { ...tenant, additionalResidents: updated } } });
    setNewResident({ name: '', cpf: '', phone: '', email: '' });
    setShowAddResident(false);
  }

  function handleDeleteResident(id: string) {
    const updated = residents.filter(r => r.id !== id);
    setResidents(updated);
    dispatch({ type: 'UPDATE_TENANT', payload: { apartmentId, tenant: { ...tenant, additionalResidents: updated } } });
  }

  return (
    <div className="space-y-5">
      {/* Tenant info */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Inquilino Principal</h3>
        {!editMode ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>Editar</Button>
            <Button size="sm" variant="destructive" onClick={() => setShowDeleteTenant(true)}>Excluir Inquilino</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveTenant}>Salvar</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Nome completo', key: 'name', placeholder: 'Nome' },
          { label: 'CPF', key: 'cpf', placeholder: '000.000.000-00' },
          { label: 'Celular', key: 'phone', placeholder: '(85) 99999-9999' },
          { label: 'Email', key: 'email', placeholder: 'email@exemplo.com' },
        ].map(field => (
          <div key={field.key}>
            <Label>{field.label}</Label>
            {editMode ? (
              <Input
                className="mt-1"
                value={form[field.key as keyof typeof form]}
                onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                placeholder={field.placeholder}
              />
            ) : (
              <p className="mt-1 text-sm font-medium">{tenant[field.key as keyof Tenant] as string || '—'}</p>
            )}
          </div>
        ))}
      </div>

      {/* Additional residents */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Moradores Adicionais</h3>
          <Button size="sm" variant="outline" onClick={() => setShowAddResident(!showAddResident)}>
            <UserPlus className="w-4 h-4 mr-2" /> Adicionar Morador
          </Button>
        </div>

        {showAddResident && (
          <div className="border border-border rounded-xl p-4 mb-3 space-y-3">
            <p className="text-sm font-medium">Novo Morador</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Nome', key: 'name', placeholder: 'Nome completo' },
                { label: 'CPF', key: 'cpf', placeholder: '000.000.000-00' },
                { label: 'Celular', key: 'phone', placeholder: '(85) 99999-9999' },
                { label: 'Email', key: 'email', placeholder: 'email@exemplo.com' },
              ].map(f => (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input
                    className="mt-1"
                    value={newResident[f.key as keyof typeof newResident]}
                    onChange={e => setNewResident({ ...newResident, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAddResident(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAddResident}>Adicionar</Button>
            </div>
          </div>
        )}

        {residents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum morador adicional.</p>
        ) : (
          <div className="space-y-2">
            {residents.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-0.5">
                  <div><span className="text-xs text-muted-foreground">Nome</span><p className="text-sm font-medium">{r.name}</p></div>
                  <div><span className="text-xs text-muted-foreground">CPF</span><p className="text-sm">{r.cpf}</p></div>
                  <div><span className="text-xs text-muted-foreground">Celular</span><p className="text-sm">{r.phone}</p></div>
                  <div><span className="text-xs text-muted-foreground">Email</span><p className="text-sm">{r.email}</p></div>
                </div>
                <button
                  onClick={() => handleDeleteResident(r.id)}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete tenant dialog */}
      <AlertDialog open={showDeleteTenant} onOpenChange={setShowDeleteTenant}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Inquilino</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{tenant.name}</strong>? Todos os seus documentos, contrato e histórico de pagamentos serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
