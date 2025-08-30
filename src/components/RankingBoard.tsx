import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface Player {
  id: string;
  user_id: string;
  player_name: string;
  fish_collected: number;
  is_online: boolean;
}

interface RankingBoardProps {
  roomId: string;
  players: Player[];
}

export const RankingBoard = ({ roomId, players }: RankingBoardProps) => {
  const [fishMessages, setFishMessages] = useState<any[]>([]);

  useEffect(() => {
    loadFishMessages();
  }, [roomId]);

  const loadFishMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .eq('message_type', 'game')
        .like('message', '%coletou um peixinho%')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFishMessages(data || []);
    } catch (error) {
      console.error('Error loading fish messages:', error);
    }
  };

  // Sort players by fish collected (descending) and then by name
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.fish_collected !== a.fish_collected) {
      return b.fish_collected - a.fish_collected;
    }
    return a.player_name.localeCompare(b.player_name);
  });

  const getMedalEmoji = (position: number) => {
    switch (position) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `#${position + 1}`;
    }
  };

  const getPositionColor = (position: number) => {
    switch (position) {
      case 0: return 'text-yellow-500 font-bold';
      case 1: return 'text-gray-400 font-semibold';
      case 2: return 'text-amber-600 font-semibold';
      default: return 'text-muted-foreground';
    }
  };

  const totalFishCollected = players.reduce((sum, player) => sum + player.fish_collected, 0);

  return (
    <Card className="p-4 game-ui-card">
      <div className="text-center mb-4">
        <h3 className="font-bold text-primary mb-1">🏆 Ranking da Rodada</h3>
        <Badge variant="outline" className="text-xs">
          {totalFishCollected} peixes coletados
        </Badge>
      </div>
      
      <ScrollArea className="h-56">
        <div className="space-y-2">
          {sortedPlayers.map((player, index) => (
            <div 
              key={player.id} 
              className={`flex items-center justify-between p-3 rounded-lg border ${
                index === 0 ? 'bg-primary/10 border-primary/30' : 'bg-muted/20 border-muted/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-lg ${getPositionColor(index)}`}>
                  {getMedalEmoji(index)}
                </span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${player.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className={`${index === 0 ? 'font-bold text-primary' : 'font-medium'}`}>
                    {player.player_name}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge 
                  variant={index === 0 ? "default" : "secondary"} 
                  className={`text-sm ${index === 0 ? 'bg-gradient-primary' : ''}`}
                >
                  🐟 {player.fish_collected}
                </Badge>
              </div>
            </div>
          ))}
          
          {players.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p>Nenhum jogador na sala</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {fishMessages.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground text-center">
            Últimas coletas: {fishMessages.slice(-3).map(msg => 
              msg.player_name.split(' ')[0]
            ).join(', ')}
          </p>
        </div>
      )}
    </Card>
  );
};