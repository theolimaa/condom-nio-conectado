import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, MONTHS, getRecordStatus, getPeriodAndDueDate } from '@/lib/utils-app';
import { useApp } from '@/lib/store';
import GlobalFilter from '@/components/GlobalFilter';
import Layout from '@/components/Layout';
import { useCondominiums, useAddCondominium, useUpdateCondominium, useDeleteCondominium, CondominiumDB } from '@/hooks/useCondominiums';
import { useApartments } from '@/hooks/useApartments';
import { useAllFinancialRecords, FinancialRecordDB, calcReceived } from '@/hooks/useFinancial';
import { useContracts } from '@/hooks/useContracts';
import { useTenants, useAllPreviousTenants } from '@/hooks/useTenants';
import { useAllDebtInstallments, useAllDebtAgreements } from '@/hooks/useDebtAgreements';

function getStatus(
  record: FinancialRecordDB,
  paymentDay?: number | null,
  contractStartDate?: string | null,
  desiredPaymentDay?: number | null,
  desiredPaymentDate?: string | null
): 'paid' | 'overdue' | 'pending' {
  if (record.paid) return 'paid';
  return getRecordStatus(record.month, paymentDay, contractStartDate, desiredPaymentDay, desiredPaymentDate);
}

function getDueDateMonth(record: FinancialRecordDB, contract?: { start_date?: string | null; payment_day?: number | null; desired_payment_day?: number | null; desired_payment_date?: string | null } | null): string | null {
  if (!contract) return null;
  const { dueDateLabel } = getPeriodAndDueDate(record.month, contract.start_date ?? null, contract.payment_day ?? 1, contract.desired_payment_day, contract.desired_payment_date);
  if (!dueDateLabel || dueDateLabel === '-') return null;
  const parts = dueDateLabel.split('/');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1]}`;
}

function CondominiumModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: CondominiumDB }) {
  const addCond = useAddCondominium();
  const updateCond = useUpdateCondominium();
  const [name, setName] = useState(initial?.name ?? '');
  async function handleSave() {
    if (!name) return;
    if (initial) { await updateCond.mutateAsync({ id: initial.id, name }); }
    else { await addCond.mutateAsync(name); }
    onClose();
  }
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial ? 'Editar Condomínio' : 'Novo Condomínio'}</DialogTitle></DialogHeader>
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

export default function Condominiums() {
  const navigate = useNavigate();
  const { state } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [editCond, setEditCond] = useState<CondominiumDB | null>(null);
  const [deleteCond, setDeleteCond] = useState<CondominiumDB | null>(null);

  const { data: condominiums = [], isLoading: loadingConds } = useCondominiums();
  const { data: apartments = [] } = useApartments();
  const { data: financialRecords = [] } = useAllFinancialRecords();
  const { data: contracts = [] } = useContracts();
  const { data: allTenants = [] } = useTenants();
  const { data: previousTenants = [] } = useAllPreviousTenants();
  const { data: debtInstallments = [] } = useAllDebtInstallments();
  const { data: allDebtAgreements = [] } = useAllDebtAgreements();
  const deleteCondo = useDeleteCondominium();

  const { selectedYear, selectedMonth } = state;

  const selectedMonthKey = selectedMonth !== null
    ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
    : null;

  const contractByApartment = new Map<string, typeof contracts[0]>();
  for (const tenant of allTenants) {
    if (!tenant.apartment_id) continue;
    const c = contracts.find(ct => ct.tenant_id === tenant.id);
    if (c) contractByApartment.set(tenant.apartment_id, c);
  }

  const enrichedRecords = financialRecords.flatMap(r => {
    const contract =
      (r.contract_id ? contracts.find(c => c.id === r.contract_id) : undefined) ??
      contractByApartment.get(r.apartment_id);

    if (contract?.start_date) {
      if (r.month < contract.start_date.substring(0, 7)) return [];
    }

    // Registros nao pagos de contratos encerrados nao devem aparecer nos totais
    if (!r.paid && contract?.status === 'ended') return [];

    const status = getStatus(r, contract?.payment_day, contract?.start_date, contract?.desired_payment_day, contract?.desired_payment_date);
    const dueDateMonth = getDueDateMonth(r, contract);
    const paymentMonth = r.payment_date ? r.payment_date.substring(0, 7) : null;
    return [{ ...r, computedStatus: status, dueDateMonth, paymentMonth }];
  });

  const receivedRecords = enrichedRecords.filter(r => {
    if (!r.paid || !r.paymentMonth) return false;
    if (selectedMonthKey) return r.paymentMonth === selectedMonthKey;
    return r.paymentMonth.startsWith(String(selectedYear));
  });

  const overdueRecords = enrichedRecords.filter(r => {
    if (r.computedStatus !== 'overdue') return false;
    if (selectedMonthKey) return r.dueDateMonth === selectedMonthKey;
    return r.dueDateMonth?.startsWith(String(selectedYear)) ?? false;
  });

  // Parcelas de acordos pagas no período selecionado — somam ao "Recebido" do condomínio
  const paidInstallmentsThisMonth = debtInstallments.filter(inst => {
    if (!inst.paid || !inst.payment_date) return false;
    if (selectedMonthKey) return inst.payment_date.startsWith(selectedMonthKey);
    return inst.payment_date.startsWith(String(selectedYear));
  });
  const paidInstallmentRows = paidInstallmentsThisMonth.map(inst => {
    const ag = allDebtAgreements.find(a => a.id === inst.agreement_id);
    const pt = previousTenants.find(p => p.id === ag?.previous_tenant_id);
    return {
      id: inst.id,
      apartment_id: ag?.apartment_id ?? '',
      tenant_id: pt?.original_id ?? '',
      rent_value: inst.amount,
    };
  });

  const filterLabel = selectedMonth !== null ? `${MONTHS[selectedMonth]} ${selectedYear}` : String(selectedYear);

  return (
    <Layout>
      <div className="page-content">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Condomínios</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {condominiums.length} condomínio{condominiums.length !== 1 ? 's' : ''} cadastrado{condominiums.length !== 1 ? 's' : ''} · {filterLabel}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <GlobalFilter />
              <Button onClick={() => setShowAdd(true)} className="btn-primary-glow gap-1.5">
                <Plus className="w-4 h-4" /> Novo Condomínio
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:hidden">
            <div className="flex-1"><GlobalFilter /></div>
            <Button onClick={() => setShowAdd(true)} size="sm" className="shrink-0 gap-1">
              <Plus className="w-4 h-4" /> Cond.
            </Button>
          </div>
        </div>

        {loadingConds ? (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'hsl(var(--primary) / 0.3)', borderTopColor: 'hsl(var(--primary))' }}
            />
          </div>
        ) : condominiums.length === 0 ? (
          <div className="empty-state">
            <Building2 className="empty-state-icon" />
            <p className="font-medium text-muted-foreground mb-1">Nenhum condomínio cadastrado</p>
            <p className="text-sm text-muted-foreground mb-4">Comece adicionando seu primeiro condomínio</p>
            <Button onClick={() => setShowAdd(true)} className="btn-primary-glow gap-1.5">
              <Plus className="w-4 h-4" /> Adicionar Condomínio
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {condominiums.map(cond => {
              const condApts = apartments.filter(a => a.condominium_id === cond.id);
              const condOccupied = condApts.filter(a => allTenants.some(t => t.apartment_id === a.id)).length;
              const condReceived = receivedRecords
                .filter(r => condApts.some(a => a.id === r.apartment_id))
                .reduce((s, r) => s + calcReceived(r), 0)
                + paidInstallmentRows
                  .filter(r => condApts.some(a => a.id === r.apartment_id))
                  .reduce((s, r) => s + r.rent_value, 0);
              const condOverdue = overdueRecords
                .filter(r => condApts.some(a => a.id === r.apartment_id))
                .reduce((s, r) => s + r.rent_value, 0);
              const occupancyPct = condApts.length > 0 ? Math.round((condOccupied / condApts.length) * 100) : 0;

              return (
                <div
                  key={cond.id}
                  className="condo-card"
                  onClick={() => navigate(`/condominiums/${cond.id}`)}
                >
                  {/* Card top accent bar */}
                  <div
                    className="h-1 w-full"
                    style={{ background: 'linear-gradient(90deg, hsl(217 91% 50%), hsl(238 83% 62%))' }}
                  />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: 'linear-gradient(135deg, hsl(217 91% 50% / 0.12), hsl(238 83% 62% / 0.08))',
                            border: '1px solid hsl(217 91% 50% / 0.15)',
                          }}
                        >
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm leading-tight">{cond.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {condApts.length} apt{condApts.length !== 1 ? 's' : ''} · {occupancyPct}% ocupado
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); setEditCond(cond); }}
                          className="p-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteCond(cond); }}
                          className="p-1.5 rounded-md transition-colors text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Occupancy bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Ocupação</span>
                        <span className="font-medium">{condOccupied}/{condApts.length}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${occupancyPct}%`,
                            background: occupancyPct > 0 ? 'linear-gradient(90deg, hsl(142 72% 42%), hsl(142 72% 50%))' : 'hsl(var(--muted-foreground))',
                          }}
                        />
                      </div>
                    </div>

                    {/* Financial row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        className="rounded-lg p-2.5"
                        style={{ background: 'hsl(var(--muted) / 0.5)' }}
                      >
                        <p className="text-xs text-muted-foreground mb-0.5">Recebido</p>
                        <p className="text-sm font-bold" style={{ color: 'hsl(var(--paid))' }}>
                          {formatCurrency(condReceived)}
                        </p>
                      </div>
                      <div
                        className="rounded-lg p-2.5"
                        style={{ background: condOverdue > 0 ? 'hsl(var(--overdue) / 0.06)' : 'hsl(var(--muted) / 0.5)' }}
                      >
                        <p className="text-xs text-muted-foreground mb-0.5">Inadimpl.</p>
                        <p
                          className="text-sm font-bold"
                          style={{ color: condOverdue > 0 ? 'hsl(var(--overdue))' : 'hsl(var(--muted-foreground))' }}
                        >
                          {condOverdue > 0 ? formatCurrency(condOverdue) : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className="border-t px-5 py-3 flex items-center justify-between"
                    style={{ borderColor: 'hsl(var(--border))' }}
                  >
                    <span className="text-xs text-muted-foreground">Ver apartamentos</span>
                    <ChevronRight className="w-4 h-4 text-primary" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
              onClick={async () => { await deleteCondo.mutateAsync(deleteCond!.id); setDeleteCond(null); }}
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
