import { useState } from 'react';
import { User, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/lib/store';
import Layout from '@/components/Layout';

export default function Profile() {
  const { state, dispatch } = useApp();
  const [form, setForm] = useState({ ...state.user });
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: 'UPDATE_USER', payload: form });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Layout>
      <div className="p-6 max-w-xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Meu Perfil</h1>
          <p className="text-muted-foreground text-sm">Gerencie suas informações pessoais</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">{state.user.name.charAt(0)}</span>
            </div>
            <div>
              <p className="font-semibold text-lg">{state.user.name}</p>
              <p className="text-muted-foreground text-sm">{state.user.email}</p>
            </div>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Nome completo</Label>
              <Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input className="mt-1" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input className="mt-1" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>CPF</Label>
              <Input className="mt-1" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} />
            </div>
            <Button type="submit" className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {saved ? 'Salvo!' : 'Salvar Alterações'}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
