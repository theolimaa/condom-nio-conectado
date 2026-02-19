import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email) setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'hsl(var(--sidebar-background))' }}>
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-primary">ImóvelGest</span>
          </div>

          {sent ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: 'hsl(var(--success))' }} />
              <h2 className="text-xl font-bold mb-2">Email enviado!</h2>
              <p className="text-muted-foreground text-sm mb-6">Verifique sua caixa de entrada para redefinir sua senha.</p>
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-1">Recuperar senha</h2>
              <p className="text-muted-foreground text-sm mb-6">Insira seu email para receber o link de recuperação.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input className="mt-1" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" size="lg">Enviar link</Button>
              </form>
              <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-4 hover:text-foreground">
                <ArrowLeft className="w-4 h-4" /> Voltar ao login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
