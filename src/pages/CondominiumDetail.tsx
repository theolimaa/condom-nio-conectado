import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, Home, Pencil, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, getRecordStatus } from '@/lib/utils-app';
import { useApp } from '@/lib/store';
import GlobalFilter from '@/components/GlobalFilter';
import Layout from '@/components/Layout';
import { useCondominiums } from '@/hooks/useCondominiums';
import { useApartments, useAddApartment, useUpdateApartment, useDeleteApartment, ApartmentDB } from '@/hooks/useApartments';
import { useTenants } from '@/hooks/useTenants';
import { useAllFinancialRecords } from '@/hooks/useFinancial';
import { useContracts } from '@/hooks/useContracts';

function ApartmentModal({ open, onClose, condominiumId, initial }: {
  open: boolean; onClose: () => void; condominiumId: string; initial?: ApartmentDB;
}) {
  const addApt = useAddApartment();
  const updateApt = useUpdateApartment();
  const [unitNumber, setUnitNumber] = useState(initial?.unit_number ?? '');

  async function handleSave() {
    if (!unitNumber) return;
    if (initial) {
      await updateApt.mutateAsync({ id: initial.id, unit_number: unitNumber });
    } else {
      await addApt.mutateAsync({ condominium_id: condominiumId, unit_number: unitNumber });
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
          <div>
            <Label>Número / Identificação *</Label>
            <Input className="mt-1" value={unitNumber} onChange={e => setUnitNumber(e.target.value)} placeholder="101" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={addApt.isPending || updateApt.isPending}>
            {initial ? 'Salvar' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApartmentCard({ apt, condominiumId, selectedYear, selectedMonth, allFinancialRecords }: {
  apt: ApartmentDB;
  condominiumId: string;
  selectedYear: number;
  selectedMonth: number | null;
  allFinancialRecords: { apartment_id: string; paid: boolean | null; rent_value: number; month: string; status: string | null }[];
}) {
  const navigate = useNavigate();
  const deleteApt = useDeleteApartment();
  const [editApt, setEditApt] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: tenants = [] } = useTenants(apt.id);
  const { data: contracts = [] } = useContracts();

  const currentTenant = tenants[0];
  const aptRecords = allFinancialRecords.filter(r => {
    if (r.apartment_id !== apt.id) return false;
    const [y, m] = r.month.split('-').map(Number);
    return y === selectedYear && (selectedMonth === null || m - 1 === selectedMonth);
  });
  const received = aptRecords.filter(r => r.paid).reduce((s, r) => s + r.rent_value, 0);
  const overdue = aptRecords.some(r => {
    if (r.paid) return false;
    const contract = contracts.find(c => c.id === r.contract_id);
    return getRecordStatus(r.month, contract?.payment_day) === 'overdue';
  });

  return (
    <>
      <div
        className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all cursor-pointer group"
        onClick={() => navigate(`/apartments/${apt.id}`)}
      >
        <div className={`h-1.5 w-full ${currentTenant ? (overdue ? 'bg-destructive' : 'bg-green-500') : 'bg-muted'}`} />
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-bold">Apto {apt.unit_number}</p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={e => { e.stopPropagation(); setEditApt(true); }}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setDeleteConfirm(true); }}
                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {currentTenant ? (
            <div className="mt-3">
              <div className="flex items-center gap-1.5 mb-1">
                <User className="w-3 h-3 text-muted-foreground" />
                <p className="text-xs font-medium truncate">{currentTenant.first_name} {currentTenant.last_name}</p>
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
        </div>
      </div>

      <ApartmentModal
        open={editApt}
        onClose={() => setEditApt(false)}
        condominiumId={condominiumId}
        initial={apt}
      />

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Apartamento {apt.unit_number}</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá o apartamento e todos os dados vinculados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { await deleteApt.mutateAsync(apt.id); }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function CondominiumDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useApp();
  const [showAdd, setShowAdd] = useState(false);

  const { data: condominiums = [] } = useCondominiums();
  const { data: apartments = [], isLoading } = useApartments(id);
  // Use global financial records for accurate revenue
  const { data: allFinancialRecords = [] } = useAllFinancialRecords();

  const cond = condominiums.find(c => c.id === id);
  const { selectedYear, selectedMonth } = state;

  // Filter financial records for this condominium's apartments
  const condApts = apartments.filter(a => a.condominium_id === id);
  const condRecords = allFinancialRecords.filter(r => {
    if (!condApts.some(a => a.id === r.apartment_id)) return false;
    const [y, m] = r.month.split('-').map(Number);
    return r.paid && y === selectedYear && (selectedMonth === null || m - 1 === selectedMonth);
  });
  const totalReceived = condRecords.reduce((s, r) => s + r.rent_value, 0);

  if (!cond && !isLoading) return (
    <Layout>
      <div className="p-6">
        <p className="text-muted-foreground">Condomínio não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard')}>Voltar</Button>
      </div>
    </Layout>
  );

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
              <h1 className="text-2xl font-bold">{cond?.name ?? 'Carregando...'}</h1>
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
            <p className="text-sm text-muted-foreground mb-1">Receita</p>
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--paid))' }}>{formatCurrency(totalReceived)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground mb-1">Ano</p>
            <p className="text-2xl font-bold">{selectedYear}</p>
          </div>
        </div>

        {/* Apartments grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : apartments.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
            <Home className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum apartamento cadastrado</p>
            <Button className="mt-4" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" /> Adicionar</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {apartments.map(apt => (
              <ApartmentCard
                key={apt.id}
                apt={apt}
                condominiumId={id!}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                allFinancialRecords={allFinancialRecords}
              />
            ))}
          </div>
        )}
      </div>

      <ApartmentModal open={showAdd} onClose={() => setShowAdd(false)} condominiumId={id!} />
    </Layout>
  );
}
