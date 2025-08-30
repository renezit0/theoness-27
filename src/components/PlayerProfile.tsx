import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface PlayerProfileProps {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
  playerName: string;
  roomId: string;
}

interface PlayerStats {
  fish_collected: number;
  is_online: boolean;
  position_x: number;
  position_y: number;
  joined_at: string;
}

export const PlayerProfile = ({ isOpen, onClose, playerId, playerName, roomId }: PlayerProfileProps) => {
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [fishMessages, setFishMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && playerId) {
      loadPlayerData();
    }
  }, [isOpen, playerId, roomId]);

  const loadPlayerData = async () => {
    setLoading(true);
    try {
      // Load player stats
      const { data: playerData, error: playerError } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', playerId)
        .single();

      if (playerError) throw playerError;
      setPlayerStats(playerData);

      // Load fish collection messages for this player
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', playerId)
        .eq('message_type', 'game')
        .like('message', '%coletou%')
        .order('created_at', { ascending: false })
        .limit(10);

      if (messagesError) throw messagesError;
      setFishMessages(messagesData || []);

    } catch (error) {
      console.error('Error loading player data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('pt-BR');
  };

  const getFirstCollections = () => {
    return fishMessages.filter(msg => msg.message.includes('primeiro')).length;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            👤 Perfil do Jogador
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-muted-foreground">Carregando perfil...</p>
          </div>
        ) : playerStats ? (
          <div className="space-y-4">
            {/* Player Info */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-primary text-lg">{playerName}</h3>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${playerStats.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm text-muted-foreground">
                    {playerStats.is_online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <Badge variant="default" className="bg-gradient-primary">
                    🐟 {playerStats.fish_collected}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">Peixes Coletados</p>
                </div>
                
                <div className="text-center">
                  <Badge variant="secondary">
                    🏆 {getFirstCollections()}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">Primeiro a Coletar</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Entrou em:</span> {formatDate(playerStats.joined_at)} às {formatTime(playerStats.joined_at)}
                </p>
              </div>
            </Card>

            {/* Recent Collections */}
            {fishMessages.length > 0 && (
              <Card className="p-4">
                <h4 className="font-semibold text-sm mb-3 text-primary">📋 Últimas Coletas</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {fishMessages.slice(0, 5).map((message, index) => (
                    <div key={message.id} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        {message.message.includes('primeiro') ? '🏆' : '🐟'}
                        <span className={message.message.includes('primeiro') ? 'font-medium text-primary' : 'text-muted-foreground'}>
                          {message.message.includes('primeiro') ? 'Primeiro!' : 'Coletou'}
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {fishMessages.length === 0 && (
              <Card className="p-4 text-center">
                <p className="text-muted-foreground text-sm">
                  🔍 Nenhuma coleta registrada ainda
                </p>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Não foi possível carregar o perfil do jogador.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};