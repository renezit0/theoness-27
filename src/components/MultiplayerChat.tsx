import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PlayerProfile } from './PlayerProfile';

interface ChatMessage {
  id: string;
  user_id: string;
  player_name: string;
  message: string;
  message_type: 'chat' | 'system' | 'game';
  created_at: string;
}

interface Player {
  id: string;
  user_id: string;
  player_name: string;
  position_x: number;
  position_y: number;
  fish_collected: number;
  is_ready: boolean;
  is_online: boolean;
}

interface MultiplayerChatProps {
  roomId: string;
  user: any;
  players: Player[];
}

export const MultiplayerChat = ({ roomId, user, players }: MultiplayerChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{id: string, name: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load messages and subscribe to real-time updates
  useEffect(() => {
    loadMessages();
    
    const messagesChannel = supabase
      .channel(`chat-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log('New message:', payload);
          setMessages(prev => [...prev, payload.new as ChatMessage]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [roomId]);

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages((data || []) as ChatMessage[]);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          user_id: user.id,
          player_name: players.find(p => p.user_id === user.id)?.player_name || 'Jogador',
          message: messageText,
          message_type: 'chat'
        });

      if (error) throw error;
      
      // Scroll to bottom immediately after sending
      setTimeout(scrollToBottom, 50);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro",
        description: "Falha ao enviar mensagem",
        variant: "destructive",
      });
      setNewMessage(messageText); // Restore message on error
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessageStyle = (messageType: string, isOwn: boolean) => {
    switch (messageType) {
      case 'system':
        return 'bg-secondary/50 text-secondary-foreground border-l-4 border-secondary';
      case 'game':
        return 'bg-accent/50 text-accent-foreground border-l-4 border-accent';
      default:
        return isOwn 
          ? 'bg-primary/20 text-primary-foreground border-l-4 border-primary ml-4' 
          : 'bg-muted/50 text-muted-foreground border-l-4 border-muted mr-4';
    }
  };

  return (
    <>
      <Card className="h-[400px] flex flex-col game-ui-card">
        {/* Players List */}
        <div className="p-3 border-b">
          <h3 className="font-bold mb-2 text-primary text-sm">👥 Jogadores ({players.length}/5)</h3>
          <div className="space-y-1">
            {players.map((player) => (
              <div key={player.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${player.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <button
                    onClick={() => player.user_id !== user.id && setSelectedPlayer({ id: player.user_id, name: player.player_name })}
                    className={`${player.user_id === user.id ? 'font-bold text-primary' : 'hover:text-primary hover:underline cursor-pointer'} transition-colors`}
                  >
                    {player.player_name}
                    {player.user_id === user.id && ' (Você)'}
                  </button>
                </div>
                <Badge variant="secondary" className="text-xs">
                  🐟 {player.fish_collected}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-2">
            {messages.map((message) => {
              const isOwn = message.user_id === user.id;
              const isSystemMessage = message.message_type !== 'chat';
              const messagePlayer = players.find(p => p.user_id === message.user_id);
              
              return (
                <div key={message.id} className={`rounded-lg p-2 ${getMessageStyle(message.message_type, isOwn)}`}>
                  {!isSystemMessage && (
                    <div className="flex items-center justify-between mb-1">
                      <button
                        onClick={() => !isOwn && messagePlayer && setSelectedPlayer({ id: message.user_id, name: message.player_name })}
                        className={`font-semibold text-xs ${!isOwn ? 'hover:text-primary hover:underline cursor-pointer' : ''} transition-colors`}
                      >
                        {isOwn ? 'Você' : message.player_name}
                      </button>
                      <span className="text-xs opacity-60">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                  )}
                  <div className={`text-xs ${isSystemMessage ? 'text-center font-medium' : ''}`}>
                    {message.message}
                  </div>
                  {isSystemMessage && (
                    <div className="text-xs opacity-60 text-center mt-1">
                      {formatTime(message.created_at)}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="p-3 border-t">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              maxLength={200}
              className="flex-1 text-sm"
            />
            <Button 
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              size="sm"
              className="bg-gradient-primary hover:opacity-90"
            >
              📤
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-1 text-center">
            Enter para enviar • Clique nos nomes para ver perfis
          </div>
        </div>
      </Card>

      {/* Player Profile Modal */}
      {selectedPlayer && (
        <PlayerProfile
          isOpen={!!selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          roomId={roomId}
        />
      )}
    </>
  );
};