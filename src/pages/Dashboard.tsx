import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Home, TrendingUp, TrendingDown, DollarSign, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, MONTHS } from '@/lib/utils-app';
import { useApp } from '@/lib/store';
import GlobalFilter from '@/components/GlobalFilter';
import Layout from '@/components/Layout';
import { useCondominiums, useAddCondominium, useUpdateCondominium, useDeleteCondominium, CondominiumDB } from '@/hooks/useCondominiums';
import { useApartments } from '@/hooks/useApartments';
import { useAllFinancialRecords } from '@/hooks/useFinancial';

function CondominiumModal({ open, onClose, initial }: {
  open: boolean; onClose: () => void; initial?: CondominiumDB;
}) {
  const addCond = useAddCondominium();
  const updateCond = useUpdateCondominium();
  const [name, setName] = useState(initial?.name ?? '');

  async function handleSave() {
    if (!name) return;
    if (initial) {
      await updateCond.mutateAsync({ id: initial.id, name });
    } else {
      await addCond.mutateAsync(name);
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar Condomínio' : 'Novo Condomínio'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Nome *</Label>
            <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="Residencial Alfa" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={addCond.isPending || updateCond.isPending}>
            {initial ? 'Salvar' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { state } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [editCond, setEditCond] = useState<CondominiumDB | null>(null);
  const [deleteCond, setDeleteCond] = useState<CondominiumDB | null>(null);

  const { data: condominiums = [], isLoading: loadingConds } = useCondominiums();
  const { data: apartments = [] } = useApartments();
  const { data: financialRecords = [] } = useAllFinancialRecords();
  const deleteCondo = useDeleteCondominium();

  const { selectedYear, selectedMonth } = state;

  // Filter financial records by year/month
  const filteredRecords = financialRecords.filter(r => {
    const [year, month] = r.month.split('-').map(Number);
    const matchYear = year === selectedYear;
    const matchMonth = selectedMonth === null || month - 1 === selectedMonth;
    return matchYear && matchMonth;
  });

  const totalReceived = filteredRecords.filter(r => r.paid).reduce((s, r) => s + r.rent_value, 0);
  const totalPending = filteredRecords.filter(r => !r.paid && r.status !== 'Inadimplente').reduce((s, r) => s + r.rent_value, 0);
  const totalOverdue = filteredRecords.filter(r => r.status === 'Inadimplente').reduce((s, r) => s + r.rent_value, 0);

  const occupiedApts = apartments.filter(a => {
    // An apartment is occupied if it has at least one tenant — we rely on tenant count
    return false; // will be enriched below
  }).length;

  // Monthly breakdown
  const monthlyData = MONTHS.map((month, idx) => {
    const monthPaid = financialRecords
      .filter(r => {
        const [y, m] = r.month.split('-').map(Number);
        return y === selectedYear && m - 1 === idx && r.paid;
      })
      .reduce((s, r) => s + r.rent_value, 0);
    return { month, received: monthPaid };
  });

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Visão geral financeira e de imóveis</p>
          </div>
          <div className="flex items-center gap-3">
            <GlobalFilter />
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-2" /> Adicionar Condomínio
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Receita Recebida</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--paid)/0.12)' }}>
                <TrendingUp className="w-4 h-4" style={{ color: 'hsl(var(--paid))' }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--paid))' }}>{formatCurrency(totalReceived)}</p>
            <p className="text-xs text-muted-foreground mt-1">{selectedMonth !== null ? MONTHS[selectedMonth] : 'Ano'} {selectedYear}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">A Receber</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--warning)/0.12)' }}>
                <DollarSign className="w-4 h-4" style={{ color: 'hsl(var(--warning))' }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--warning))' }}>{formatCurrency(totalPending)}</p>
            <p className="text-xs text-muted-foreground mt-1">Aguardando pagamento</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Inadimplente</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--overdue)/0.12)' }}>
                <TrendingDown className="w-4 h-4" style={{ color: 'hsl(var(--overdue))' }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--overdue))' }}>{formatCurrency(totalOverdue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Em atraso</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Apartamentos</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
                <Home className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold">{apartments.length}</p>
            <p className="text-xs text-muted-foreground mt-1">em {condominiums.length} condomínio(s)</p>
          </div>
        </div>

        {/* Monthly bar chart */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-base font-semibold mb-4">Receita Mensal — {selectedYear}</h2>
          <div className="flex items-end gap-2 h-32">
            {monthlyData.map(({ month, received }) => {
              const maxVal = Math.max(...monthlyData.map(m => m.received), 1);
              const height = Math.max((received / maxVal) * 100, 4);
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground" style={{ fontSize: '10px' }}>
                    {received > 0 ? `R$${Math.round(received / 1000)}k` : ''}
                  </span>
                  <div
                    className="w-full rounded-t-sm transition-all duration-500"
                    style={{
                      height: `${height}%`,
                      background: received > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{month.substring(0, 3)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Condominiums grid */}
        <div>
          <h2 className="text-base font-semibold mb-3">Condomínios</h2>
          {loadingConds ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : condominiums.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
              <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum condomínio cadastrado</p>
              <Button className="mt-4" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" /> Adicionar</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {condominiums.map(cond => {
                const condApts = apartments.filter(a => a.condominium_id === cond.id);
                const condRecords = financialRecords.filter(r => {
                  const [y, m] = r.month.split('-').map(Number);
                  return condApts.some(a => a.id === r.apartment_id) &&
                    y === selectedYear &&
                    (selectedMonth === null || m - 1 === selectedMonth);
                });
                const condReceived = condRecords.filter(r => r.paid).reduce((s, r) => s + r.rent_value, 0);

                return (
                  <div key={cond.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); setEditCond(cond); }}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteCond(cond); }}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-semibold text-base">{cond.name}</h3>
                      <div className="flex items-center justify-between mt-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Apartamentos</p>
                          <p className="font-semibold">{condApts.length}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Receita</p>
                          <p className="font-semibold" style={{ color: 'hsl(var(--paid))' }}>{formatCurrency(condReceived)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-border px-5 py-3">
                      <button
                        onClick={() => navigate(`/condominiums/${cond.id}`)}
                        className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                      >
                        Ver apartamentos →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <CondominiumModal open={showAdd} onClose={() => setShowAdd(false)} />
      {editCond && <CondominiumModal open={!!editCond} onClose={() => setEditCond(null)} initial={editCond} />}

      <AlertDialog open={!!deleteCond} onOpenChange={() => setDeleteCond(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Condomínio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteCond?.name}</strong>? Todos os apartamentos e dados vinculados serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await deleteCondo.mutateAsync(deleteCond!.id);
                setDeleteCond(null);
              }}
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
