import { useState, useRef } from 'react';
import { Pencil, Trash2, UserPlus, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  TenantDB,
  ResidentDB,
  useUpdateTenant,
  useDeleteTenant,
  useResidents,
  useAddResident,
  useUpdateResident,
  useDeleteResident,
} from '@/hooks/useTenants';
import { toast } from 'sonner';

const UNDO_DURATION = 60000; // 60 segundos

function ResidentCard({
  resident,
  tenantId,
}: {
  resident: ResidentDB;
  tenantId: string;
}) {
  const updateResident = useUpdateResident();
  const deleteResident = useDeleteResident();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: resident.name,
    surname: resident.surname ?? '',
    cpf: resident.cpf ?? '',
    email: resident.email ?? '',
    relationship: resident.relationship ?? '',
  });

  async function handleSave() {
    await updateResident.mutateAsync({
      id: resident.id,
      tenantId,
      name: form.name,
      surname: form.surname || null,
      cpf: form.cpf || null,
      email: form.email || null,
      relationship: form.relationship || null,
    });
    setEditing(false);
  }

  function handleCancel() {
    setForm({
      name: resident.name,
      surname: resident.surname ?? '',
      cpf: resident.cpf ?? '',
      email: resident.email ?? '',
      relationship: resident.relationship ?? '',
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="border border-primary/30 rounded-xl p-4 space-y-3 bg-primary/5">
        <p className="text-sm font-medium text-primary">Editando Morador</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Nome', key: 'name', placeholder: 'Nome completo' },
            { label: 'Sobrenome', key: 'surname', placeholder: 'Sobrenome' },
            { label: 'CPF', key: 'cpf', placeholder: '000.000.000-00' },
            { label: 'Email', key: 'email', placeholder: 'email@exemplo.com' },
            { label: 'Parentesco', key: 'relationship', placeholder: 'Ex: Cônjuge' },
          ].map(f => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Input
                className="mt-1"
                value={form[f.key as keyof typeof form]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCancel}>
            <X className="w-3 h-3 mr-1" />
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateResident.isPending}>
            {updateResident.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Check className="w-3 h-3 mr-1" />
            )}
            Salvar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
      <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-0.5">
        <div>
          <span className="text-xs text-muted-foreground">Nome</span>
          <p className="text-sm font-medium">
            {resident.name} {resident.surname}
          </p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">CPF</span>
          <p className="text-sm">{resident.cpf || '—'}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Email</span>
          <p className="text-sm">{resident.email || '—'}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Parentesco</span>
          <p className="text-sm">{resident.relationship || '—'}</p>
        </div>
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          title="Editar morador"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => deleteResident.mutate({ id: resident.id, tenantId })}
          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Remover morador"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function TenantTabDB({
  tenant,
  apartmentId,
}: {
  tenant: TenantDB;
  apartmentId: string;
}) {
  const updateTenant = useUpdateTenant();
  const deleteTenant = useDeleteTenant();
  const { data: residents = [] } = useResidents(tenant.id);
  const addResident = useAddResident();

  const [editMode, setEditMode] = useState(false);
  const [showDeleteTenant, setShowDeleteTenant] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    first_name: tenant.first_name,
    last_name: tenant.last_name,
    cpf: tenant.cpf ?? '',
    phone: tenant.phone ?? '',
    email: tenant.email ?? '',
  });

  const [newResident, setNewResident] = useState({
    name: '',
    surname: '',
    cpf: '',
    email: '',
    relationship: '',
  });
  const [showAddResident, setShowAddResident] = useState(false);

  async function handleSaveTenant() {
    await updateTenant.mutateAsync({
      id: tenant.id,
      first_name: form.first_name,
      last_name: form.last_name,
      cpf: form.cpf || null,
      phone: form.phone || null,
      email: form.email || null,
    });
    setEditMode(false);
  }

  async function handleAddResident() {
    if (!newResident.name) return;
    await addResident.mutateAsync({
      tenant_id: tenant.id,
      name: newResident.name,
      surname: newResident.surname || null,
      cpf: newResident.cpf || null,
      email: newResident.email || null,
      relationship: newResident.relationship || null,
    });
    setNewResident({ name: '', surname: '', cpf: '', email: '', relationship: '' });
    setShowAddResident(false);
  }

  function handleDeleteConfirm() {
    setShowDeleteTenant(false);
    setPendingDelete(true);
    const tenantName = `${tenant.first_name} ${tenant.last_name}`;

    deleteTimeoutRef.current = setTimeout(async () => {
      setPendingDelete(false);
      await deleteTenant.mutateAsync({ id: tenant.id, apartmentId });
    }, UNDO_DURATION);

    toast.warning(`${tenantName} será excluído em 1 minuto.`, {
      duration: UNDO_DURATION,
      action: {
        label: '↩ Desfazer',
        onClick: () => {
          if (deleteTimeoutRef.current) {
            clearTimeout(deleteTimeoutRef.current);
            deleteTimeoutRef.current = null;
          }
          setPendingDelete(false);
          toast.success('Exclusão cancelada!');
        },
      },
    });
  }

  return (
    <div className="space-y-5">
      {/* Tenant info */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Inquilino Principal</h3>
        {!editMode ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
              Editar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowDeleteTenant(true)}
              disabled={pendingDelete}
            >
              {pendingDelete ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin mr-1" /> Excluindo...
                </>
              ) : (
                'Excluir Inquilino'
              )}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveTenant} disabled={updateTenant.isPending}>
              {updateTenant.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Salvar
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Nome', key: 'first_name', placeholder: 'Nome' },
          { label: 'Sobrenome', key: 'last_name', placeholder: 'Sobrenome' },
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
              <p className="mt-1 text-sm font-medium">
                {field.key === 'first_name'
                  ? tenant.first_name
                  : field.key === 'last_name'
                  ? tenant.last_name
                  : field.key === 'cpf'
                  ? tenant.cpf || '—'
                  : field.key === 'phone'
                  ? tenant.phone || '—'
                  : tenant.email || '—'}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Additional residents */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Moradores Adicionais</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddResident(!showAddResident)}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Adicionar Morador
          </Button>
        </div>

        {showAddResident && (
          <div className="border border-border rounded-xl p-4 mb-3 space-y-3">
            <p className="text-sm font-medium">Novo Morador</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Nome', key: 'name', placeholder: 'Nome completo' },
                { label: 'Sobrenome', key: 'surname', placeholder: 'Sobrenome' },
                { label: 'CPF', key: 'cpf', placeholder: '000.000.000-00' },
                { label: 'Email', key: 'email', placeholder: 'email@exemplo.com' },
                { label: 'Parentesco', key: 'relationship', placeholder: 'Ex: Cônjuge' },
              ].map(f => (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input
                    className="mt-1"
                    value={newResident[f.key as keyof typeof newResident]}
                    onChange={e =>
                      setNewResident({ ...newResident, [f.key]: e.target.value })
                    }
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAddResident(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleAddResident}
                disabled={addResident.isPending}
              >
                Adicionar
              </Button>
            </div>
          </div>
        )}

        {residents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum morador adicional.</p>
        ) : (
          <div className="space-y-2">
            {residents.map(r => (
              <ResidentCard key={r.id} resident={r} tenantId={tenant.id} />
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
              <strong>
                {tenant.first_name} {tenant.last_name}
              </strong>{' '}
              será excluído. Você terá <strong>1 minuto</strong> para desfazer antes da exclusão
              permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
