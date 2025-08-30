import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const Auth = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAuth = async (email: string, password: string, nickname: string, isSignUp: boolean) => {
    setLoading(true);
    try {
      if (isSignUp) {
        // Validate nickname
        if (!nickname.trim()) {
          toast({
            title: "Nickname obrigatório",
            description: "Digite um nickname para sua conta",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        if (nickname.length < 3 || nickname.length > 20) {
          toast({
            title: "Nickname inválido",
            description: "Nickname deve ter entre 3 e 20 caracteres",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Check for special characters and uppercase in middle
        const nicknamePattern = /^[A-Z][a-z0-9]*$/;
        if (!nicknamePattern.test(nickname)) {
          toast({
            title: "Nickname inválido",
            description: "Use apenas letras e números. Primeira letra maiúscula, resto minúsculo",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Nickname validation already done above
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              nickname: nickname
            }
          }
        });
        if (error) throw error;
        toast({
          title: "Conta criada!",
          description: "Verifique seu email para confirmar a conta.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({
          title: "Login realizado!",
          description: "Bem-vindo de volta ao TheoNess!",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const AuthForm = ({ isSignUp }: { isSignUp: boolean }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleAuth(email, password, nickname, isSignUp);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border-border/50 focus:border-accent"
          />
        </div>
        {isSignUp && (
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              placeholder="Ex: Theogamer"
              className="border-border/50 focus:border-accent"
            />
            <p className="text-xs text-muted-foreground">
              3-20 caracteres. Primeira letra maiúscula, sem caracteres especiais.
            </p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="border-border/50 focus:border-accent"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-primary hover:opacity-90"
        >
          {loading ? 'Carregando...' : isSignUp ? 'Criar Conta' : 'Entrar'}
        </Button>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card/90 backdrop-blur border-border/30">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            🐱 TheoNess
          </CardTitle>
          <CardDescription>
            Entre ou crie uma conta para salvar seu progresso!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-6">
              <AuthForm isSignUp={false} />
            </TabsContent>
            <TabsContent value="signup" className="mt-6">
              <AuthForm isSignUp={true} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};