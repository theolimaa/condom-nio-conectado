import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, UserCheck, UserX, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/lib/store';
import { Tenant } from '@/lib/types';
import { formatDate, generateId } from '@/lib/utils-app';
import Layout from '@/components/Layout';
import TenantTab from '@/components/apartment/TenantTab';
import DocumentsTab from '@/components/apartment/DocumentsTab';
import ContractTab from '@/components/apartment/ContractTab';
import FinancialTab from '@/components/apartment/FinancialTab';

function AddTenantModal({ open, onClose, apartmentId }: { open: boolean; onClose: () => void; apartmentId: string }) {
  const { dispatch } = useApp();
  const [form, setForm] = useState({ name: '', cpf: '', phone: '', email: '' });

  function handleSave() {
    if (!form.name) return;
    const tenant: Tenant = {
      id: generateId(),
      apartmentId,
      ...form,
      additionalResidents: [],
      documents: [],
      isCurrent: true,
      movedInAt: new Date().toISOString().split('T')[0],
    };
    dispatch({ type: 'ADD_TENANT', payload: { apartmentId, tenant } });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Inquilino</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Nome completo *</Label>
            <Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome do inquilino" />
          </div>
          <div>
            <Label>CPF</Label>
            <Input className="mt-1" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
          </div>
          <div>
            <Label>Celular</Label>
            <Input className="mt-1" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(85) 99999-9999" />
          </div>
          <div>
            <Label>Email</Label>
            <Input className="mt-1" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Adicionar Inquilino</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ApartmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [activeTab, setActiveTab] = useState('tenant');
  const [historyTab, setHistoryTab] = useState(false);

  const apartment = state.apartments.find(a => a.id === id);
  if (!apartment) {
    return (
      <Layout>
        <div className="p-6">
          <p className="text-muted-foreground">Apartamento não encontrado.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Voltar</Button>
        </div>
      </Layout>
    );
  }

  const cond = state.condominiums.find(c => c.id === apartment.condominiumId);
  const currentTenant = apartment.tenants.find(t => t.id === apartment.currentTenantId);
  const formerTenants = apartment.tenants.filter(t => !t.isCurrent);

  function handleDeleteTenant(tenantId: string) {
    dispatch({ type: 'DELETE_TENANT', payload: { apartmentId: apartment.id, tenantId } });
  }

  return (
    <Layout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/condominiums/${apartment.condominiumId}`)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Apartamento {apartment.number}</h1>
                {currentTenant ? (
                  <span className="badge-active flex items-center gap-1"><UserCheck className="w-3 h-3" /> Ocupado</span>
                ) : (
                  <span className="badge-unpaid flex items-center gap-1"><UserX className="w-3 h-3" /> Vago</span>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{cond?.name} · {apartment.floor}º andar · {apartment.description}</p>
            </div>
          </div>
          {!currentTenant && (
            <Button onClick={() => setShowAddTenant(true)}>
              <Plus className="w-4 h-4 mr-2" /> Adicionar Inquilino
            </Button>
          )}
        </div>

        {/* Main content */}
        {currentTenant ? (
          <div className="bg-card rounded-xl border border-border">
            <div className="flex items-center gap-4 p-4 border-b border-border">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{currentTenant.name.charAt(0)}</span>
              </div>
              <div>
                <p className="font-semibold">{currentTenant.name}</p>
                <p className="text-sm text-muted-foreground">Desde {formatDate(currentTenant.movedInAt)}</p>
              </div>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
              <TabsList className="mb-4">
                <TabsTrigger value="tenant">Inquilino</TabsTrigger>
                <TabsTrigger value="documents">Documentos ({currentTenant.documents.length})</TabsTrigger>
                <TabsTrigger value="contract">Contrato</TabsTrigger>
                <TabsTrigger value="financial">Financeiro</TabsTrigger>
              </TabsList>
              <TabsContent value="tenant">
                <TenantTab
                  tenant={currentTenant}
                  apartmentId={apartment.id}
                  onDelete={() => handleDeleteTenant(currentTenant.id)}
                />
              </TabsContent>
              <TabsContent value="documents">
                <DocumentsTab tenant={currentTenant} apartmentId={apartment.id} />
              </TabsContent>
              <TabsContent value="contract">
                <ContractTab tenant={currentTenant} apartmentId={apartment.id} />
              </TabsContent>
              <TabsContent value="financial">
                <FinancialTab apartment={apartment} tenant={currentTenant} />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-dashed border-border p-12 text-center">
            <UserX className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium mb-1">Apartamento vago</p>
            <p className="text-muted-foreground text-sm mb-4">Nenhum inquilino ativo no momento</p>
            <Button onClick={() => setShowAddTenant(true)}>
              <Plus className="w-4 h-4 mr-2" /> Adicionar Inquilino
            </Button>
          </div>
        )}

        {/* Former tenants */}
        {formerTenants.length > 0 && (
          <div className="bg-card rounded-xl border border-border">
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-xl"
              onClick={() => setHistoryTab(!historyTab)}
            >
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-muted-foreground" />
                <span className="font-semibold">Inquilinos Anteriores</span>
                <span className="badge-unpaid">{formerTenants.length}</span>
              </div>
              <span className="text-muted-foreground text-sm">{historyTab ? '▲' : '▼'}</span>
            </button>
            {historyTab && (
              <div className="border-t border-border divide-y divide-border">
                {formerTenants.map(t => (
                  <div key={t.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-sm font-bold text-muted-foreground">{t.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium">{t.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(t.movedInAt)} → {t.movedOutAt ? formatDate(t.movedOutAt) : 'atual'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <span className="badge-closed">Encerrado</span>
                        <button
                          onClick={() => handleDeleteTenant(t.id)}
                          className="text-xs text-destructive hover:underline"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                    {/* Financials for former tenant */}
                    <Tabs defaultValue="financial">
                      <TabsList className="mb-3 h-8">
                        <TabsTrigger value="financial" className="text-xs">Financeiro</TabsTrigger>
                        <TabsTrigger value="docs" className="text-xs">Documentos ({t.documents.length})</TabsTrigger>
                      </TabsList>
                      <TabsContent value="financial">
                        <FinancialTab apartment={apartment} tenant={t} />
                      </TabsContent>
                      <TabsContent value="docs">
                        <DocumentsTab tenant={t} apartmentId={apartment.id} />
                      </TabsContent>
                    </Tabs>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AddTenantModal open={showAddTenant} onClose={() => setShowAddTenant(false)} apartmentId={apartment.id} />
    </Layout>
  );
}
