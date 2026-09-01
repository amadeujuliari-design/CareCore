import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Lock, Mail, UserPlus, LogIn } from 'lucide-react';

export function Auth() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      localStorage.setItem('finance-pro-local-session', 'true');
      window.location.reload();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Erro na autenticação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Financeiro Pro</h1>
          <p className="text-slate-500">{isSignUp ? 'Crie seu acesso local' : 'Acesse o banco local'}</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <Input 
            label="E-mail" 
            type="email" 
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            icon={<Mail className="w-4 h-4" />}
          />
          <Input 
            label="Senha" 
            type="password" 
            placeholder="********"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />

          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
            {loading ? 'Carregando...' : (isSignUp ? 'Criar Conta' : 'Entrar')}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-slate-500 hover:text-emerald-600 transition flex items-center justify-center gap-2 mx-auto"
          >
            {isSignUp ? (
              <>Já tem conta? <LogIn className="w-4 h-4"/> Entrar</>
            ) : (
              <>Não tem conta? <UserPlus className="w-4 h-4"/> Cadastre-se</>
            )}
          </button>
        </div>
      </Card>
    </div>
  );
}