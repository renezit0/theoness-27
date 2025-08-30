import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import kittyImage from '@/assets/kitty.png';

interface UserProfileProps {
  user: any;
  onStartGame: () => void;
  onStartMultiplayer: () => void;
}

interface UserStats {
  totalGamesPlayed: number;
  totalFishCollected: number;
  bestScore: number;
  multiplayerWins: number;
}

export const UserProfile = ({ user, onStartGame, onStartMultiplayer }: UserProfileProps) => {
  const [userStats, setUserStats] = useState<UserStats>({
    totalGamesPlayed: 0,
    totalFishCollected: 0,
    bestScore: 0,
    multiplayerWins: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserStats();
  }, [user]);

  const loadUserStats = async () => {
    try {
      // This is a placeholder for future implementation
      // When we have user stats tables, we'll fetch real data here
      setUserStats({
        totalGamesPlayed: Math.floor(Math.random() * 50),
        totalFishCollected: Math.floor(Math.random() * 200),
        bestScore: Math.floor(Math.random() * 100),
        multiplayerWins: Math.floor(Math.random() * 20)
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getUserDisplayName = () => {
    return user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Jogador';
  };

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
            🎮 TheoNess
          </h1>
          <p className="text-muted-foreground">
            Bem-vindo de volta, {getUserDisplayName()}!
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="game-ui-card col-span-full lg:col-span-1">
            <CardHeader className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-primary p-1">
                <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                  <img 
                    src={kittyImage} 
                    alt="Profile" 
                    className="w-12 h-12 object-contain"
                  />
                </div>
              </div>
              <CardTitle className="text-xl text-primary">
                {getUserDisplayName()}
              </CardTitle>
              <CardDescription>
                {user?.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={handleSignOut}
                variant="outline"
                className="w-full"
              >
                🚪 Sair
              </Button>
            </CardContent>
          </Card>

          {/* Game Stats */}
          <Card className="game-ui-card col-span-full lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📊 Suas Estatísticas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-muted-foreground">Carregando estatísticas...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/20 border border-border/30">
                    <Badge variant="default" className="bg-gradient-primary mb-2">
                      🎮 {userStats.totalGamesPlayed}
                    </Badge>
                    <p className="text-sm text-muted-foreground">Jogos Jogados</p>
                  </div>
                  
                  <div className="text-center p-4 rounded-lg bg-muted/20 border border-border/30">
                    <Badge variant="secondary" className="mb-2">
                      🐟 {userStats.totalFishCollected}
                    </Badge>
                    <p className="text-sm text-muted-foreground">Peixes Coletados</p>
                  </div>
                  
                  <div className="text-center p-4 rounded-lg bg-muted/20 border border-border/30">
                    <Badge variant="outline" className="mb-2">
                      🏆 {userStats.bestScore}
                    </Badge>
                    <p className="text-sm text-muted-foreground">Melhor Pontuação</p>
                  </div>
                  
                  <div className="text-center p-4 rounded-lg bg-muted/20 border border-border/30">
                    <Badge variant="default" className="bg-gradient-accent mb-2">
                      👥 {userStats.multiplayerWins}
                    </Badge>
                    <p className="text-sm text-muted-foreground">Vitórias Multiplayer</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Single Player Game */}
          <Card className="game-ui-card hover-scale cursor-pointer transition-transform" onClick={onStartGame}>
            <CardHeader className="text-center">
              <div className="text-4xl mb-2">🎯</div>
              <CardTitle className="text-primary">Jogo Solo</CardTitle>
              <CardDescription>
                Jogue sozinho e colete peixes!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-gradient-primary hover:opacity-90" size="lg">
                ▶️ Iniciar Jogo Solo
              </Button>
            </CardContent>
          </Card>

          {/* Multiplayer Game */}
          <Card className="game-ui-card hover-scale cursor-pointer transition-transform" onClick={onStartMultiplayer}>
            <CardHeader className="text-center">
              <div className="text-4xl mb-2">👥</div>
              <CardTitle className="text-primary">Multiplayer</CardTitle>
              <CardDescription>
                Jogue com até 5 jogadores online!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-gradient-accent hover:opacity-90" size="lg">
                🌐 Jogar Online
              </Button>
            </CardContent>
          </Card>

          {/* How to Play */}
          <Card className="game-ui-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                ❓ Como Jogar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span>🎮</span>
                <p>Use <kbd className="px-1 py-0.5 bg-muted rounded text-xs">WASD</kbd> ou setas para mover</p>
              </div>
              <div className="flex items-start gap-2">
                <span>🐟</span>
                <p>Colete peixes para ganhar pontos</p>
              </div>
              <div className="flex items-start gap-2">
                <span>⚡</span>
                <p>Pule em plataformas para alcançar novos peixes</p>
              </div>
              <div className="flex items-start gap-2">
                <span>👥</span>
                <p>No multiplayer, trabalhe em equipe!</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};