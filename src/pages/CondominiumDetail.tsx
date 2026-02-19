import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, Home, Pencil, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/lib/store';
import { Apartment } from '@/lib/types';
import { formatCurrency, generateId } from '@/lib/utils-app';
import GlobalFilter from '@/components/GlobalFilter';
import Layout from '@/components/Layout';

function ApartmentModal({ open, onClose, condominiumId, initial }: {
  open: boolean; onClose: () => void; condominiumId: string; initial?: Apartment;
}) {
  const { dispatch } = useApp();
  const [form, setForm] = useState({
    number: initial?.number ?? '',
    floor: initial?.floor ?? 1,
    description: initial?.description ?? '',
  });

  function handleSave() {
    if (!form.number) return;
    if (initial) {
      dispatch({ type: 'UPDATE_APARTMENT', payload: { ...initial, ...form } });
    } else {
      dispatch({
        type: 'ADD_APARTMENT',
        payload: { id: generateId(), condominiumId, tenants: [], payments: [], ...form },
      });
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar Apartamento' : 'Novo Apartamento'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Número *</Label>
              <Input className="mt-1" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} placeholder="101" />
            </div>
            <div>
              <Label>Andar</Label>
              <Input className="mt-1" type="number" min={1} value={form.floor} onChange={e => setForm({ ...form, floor: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea className="mt-1" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="2 quartos, sala..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>{initial ? 'Salvar' : 'Adicionar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CondominiumDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [editApt, setEditApt] = useState<Apartment | null>(null);
  const [deleteApt, setDeleteApt] = useState<Apartment | null>(null);

  const cond = state.condominiums.find(c => c.id === id);
  const apartments = state.apartments.filter(a => a.condominiumId === id);
  const { selectedYear, selectedMonth } = state;

  if (!cond) return (
    <Layout>
      <div className="p-6">
        <p className="text-muted-foreground">Condomínio não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard')}>Voltar</Button>
      </div>
    </Layout>
  );

  const totalReceived = apartments.flatMap(a => a.payments)
    .filter(p => {
      const d = new Date(p.paidAt || p.dueDate);
      return p.status === 'paid' && d.getFullYear() === selectedYear && (selectedMonth === null || d.getMonth() === selectedMonth);
    })
    .reduce((s, p) => s + p.value, 0);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">{cond.name}</h1>
              <p className="text-muted-foreground text-sm">{cond.address}, {cond.city}/{cond.state}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <GlobalFilter />
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-2" /> Novo Apartamento
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground mb-1">Total de Aptos</p>
            <p className="text-2xl font-bold">{apartments.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground mb-1">Ocupados</p>
            <p className="text-2xl font-bold">{apartments.filter(a => a.currentTenantId).length}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground mb-1">Receita</p>
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--paid))' }}>{formatCurrency(totalReceived)}</p>
          </div>
        </div>

        {/* Apartments grid */}
        {apartments.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
            <Home className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum apartamento cadastrado</p>
            <Button className="mt-4" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" /> Adicionar</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {apartments.map(apt => {
              const tenant = apt.tenants.find(t => t.id === apt.currentTenantId);
              const aptPayments = apt.payments.filter(p => {
                const d = new Date(p.paidAt || p.dueDate);
                return d.getFullYear() === selectedYear && (selectedMonth === null || d.getMonth() === selectedMonth);
              });
              const received = aptPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.value, 0);
              const overdue = aptPayments.some(p => p.status === 'overdue');

              return (
                <div
                  key={apt.id}
                  className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => navigate(`/apartments/${apt.id}`)}
                >
                  <div className={`h-1.5 w-full ${apt.currentTenantId ? (overdue ? 'bg-destructive' : 'bg-green-500') : 'bg-muted'}`} />
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-lg font-bold">Apto {apt.number}</p>
                        <p className="text-xs text-muted-foreground">{apt.floor}º andar</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); setEditApt(apt); }}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteApt(apt); }}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {tenant ? (
                      <div className="mt-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <p className="text-xs font-medium truncate">{tenant.name}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={overdue ? 'badge-overdue' : 'badge-active'}>
                            {overdue ? 'Inadimplente' : 'Em dia'}
                          </span>
                          {received > 0 && <p className="text-xs font-semibold" style={{ color: 'hsl(var(--paid))' }}>{formatCurrency(received)}</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <span className="badge-unpaid">Vago</span>
                      </div>
                    )}

                    {apt.description && (
                      <p className="text-xs text-muted-foreground mt-2 truncate">{apt.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ApartmentModal open={showAdd} onClose={() => setShowAdd(false)} condominiumId={id!} />
      {editApt && <ApartmentModal open={!!editApt} onClose={() => setEditApt(null)} condominiumId={id!} initial={editApt} />}

      <AlertDialog open={!!deleteApt} onOpenChange={() => setDeleteApt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Apartamento {deleteApt?.number}</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá o apartamento e todos os dados vinculados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { dispatch({ type: 'DELETE_APARTMENT', payload: deleteApt!.id }); setDeleteApt(null); }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
