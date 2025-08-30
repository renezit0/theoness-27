import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Room {
  id: string;
  name: string;
  code: string;
  max_players: number;
  current_level: number;
  status: string;
  created_by: string;
  player_count?: number;
}

interface MultiplayerLobbyProps {
  user?: any;
  onJoinRoom: (roomId: string) => void;
  onBackToProfile?: () => void;
}

export const MultiplayerLobby = ({ user, onJoinRoom, onBackToProfile }: MultiplayerLobbyProps) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const { toast } = useToast();

  // Load available rooms
  useEffect(() => {
    loadRooms();
    
    // Subscribe to room updates
    const roomsChannel = supabase
      .channel('rooms-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms'
        },
        () => loadRooms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomsChannel);
    };
  }, []);

  const loadRooms = async () => {
    try {
      const { data: roomsData, error } = await supabase
        .from('rooms')
        .select(`
          *,
          room_players!inner(
            count,
            is_online
          )
          `)
        .in('status', ['waiting', 'playing'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter rooms that have online players or are waiting status
      const roomsWithOnlinePlayers = [];
      
      for (const room of roomsData || []) {
        const { data: onlinePlayersData } = await supabase
          .from('room_players')
          .select('*')
          .eq('room_id', room.id)
          .eq('is_online', true);
          
        const onlineCount = onlinePlayersData?.length || 0;
        
        // Only show rooms that have online players or are in waiting status with potential
        if (onlineCount > 0 || room.status === 'waiting') {
          roomsWithOnlinePlayers.push({
            ...room,
            player_count: onlineCount
          });
        }
      }

      setRooms(roomsWithOnlinePlayers);
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar salas",
        variant: "destructive",
      });
    }
  };

  const createRoom = async () => {
    if (!user) {
      toast({
        title: "Autenticação necessária",
        description: "Faça login para criar uma sala",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Generate room code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_room_code');

      if (codeError) throw codeError;

      // Auto-generate room name if not provided
      let finalRoomName = roomName.trim();
      if (!finalRoomName) {
        // Count existing rooms to generate sequential name
        const { count } = await supabase
          .from('rooms')
          .select('*', { count: 'exact' })
          .like('name', 'Sala %');
        
        finalRoomName = `Sala ${(count || 0) + 1}`;
      }

      // Create temporary room with 5 player limit
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          name: finalRoomName,
          code: codeData,
          created_by: user.id,
          max_players: 5,
          status: 'waiting'
        })
        .select()
        .single();

      if (roomError) throw roomError;

      toast({
        title: "🎉 Sala criada!",
        description: `Código da sala: ${codeData}`,
      });

      // Join room directly with user nickname
      const userNickname = user.user_metadata?.nickname || user.email?.split('@')[0] || 'Jogador';
      
      const { error: playerError } = await supabase
        .from('room_players')
        .insert({
          room_id: room.id,
          user_id: user.id,
          player_name: userNickname,
          is_ready: true,
          is_online: true
        });

      if (playerError) throw playerError;

      // Send system message
      await supabase
        .from('chat_messages')
        .insert({
          room_id: room.id,
          user_id: user.id,
          player_name: 'Sistema',
          message: `👋 ${userNickname} criou a sala!`,
          message_type: 'system'
        });

      onJoinRoom(room.id);
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar sala",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoomByCode = async () => {
    if (!user) {
      toast({
        title: "Autenticação necessária",
        description: "Faça login para entrar em uma sala",
        variant: "destructive",
      });
      return;
    }

    if (!roomCode.trim()) {
      toast({
        title: "Código obrigatório",
        description: "Digite o código da sala",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);
    try {
      // Find room by code
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode.toUpperCase())
        .single();

      if (roomError || !room) {
        toast({
          title: "Sala não encontrada",
          description: "Verifique o código e tente novamente",
          variant: "destructive",
        });
        return;
      }

      // Check if room is full
      const { count } = await supabase
        .from('room_players')
        .select('*', { count: 'exact' })
        .eq('room_id', room.id);

      if (count >= room.max_players) {
        // Create a new room automatically if current one is full
        await createNewRoomWhenFull(room);
        return;
      }

      // Check if already in room
      const { data: existingPlayer } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .single();

      if (existingPlayer) {
        // Update to online if was offline
        await supabase
          .from('room_players')
          .update({ is_online: true })
          .eq('room_id', room.id)
          .eq('user_id', user.id);
          
        onJoinRoom(room.id);
        return;
      }

      // Join room directly with user nickname
      const userNickname = user.user_metadata?.nickname || user.email?.split('@')[0] || 'Jogador';
      
      const { error: playerError } = await supabase
        .from('room_players')
        .insert({
          room_id: room.id,
          user_id: user.id,
          player_name: userNickname,
          is_ready: true,
          is_online: true
        });

      if (playerError) throw playerError;

      // Send system message
      await supabase
        .from('chat_messages')
        .insert({
          room_id: room.id,
          user_id: user.id,
          player_name: 'Sistema',
          message: `👋 ${userNickname} entrou na sala!`,
          message_type: 'system'
        });

      onJoinRoom(room.id);
    } catch (error) {
      console.error('Error joining room:', error);
      toast({
        title: "Erro",
        description: "Falha ao entrar na sala",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  const createNewRoomWhenFull = async (fullRoom: Room) => {
    try {
      // Generate new room code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_room_code');

      if (codeError) throw codeError;

      // Create new room with similar name
      const newRoomName = `${fullRoom.name} (Nova)`;
      const { data: newRoom, error: roomError } = await supabase
        .from('rooms')
        .insert({
          name: newRoomName,
          code: codeData,
          created_by: user.id,
          max_players: 5,
          status: 'waiting'
        })
        .select()
        .single();

      if (roomError) throw roomError;

      toast({
        title: "🎉 Nova sala criada!",
        description: `Sala anterior estava cheia. Nova sala: ${codeData}`,
      });

      // Join new room directly with user nickname
      const userNickname = user.user_metadata?.nickname || user.email?.split('@')[0] || 'Jogador';
      
      const { error: playerError } = await supabase
        .from('room_players')
        .insert({
          room_id: newRoom.id,
          user_id: user.id,
          player_name: userNickname,
          is_ready: true,
          is_online: true
        });

      if (playerError) throw playerError;

      // Send system message
      await supabase
        .from('chat_messages')
        .insert({
          room_id: newRoom.id,
          user_id: user.id,
          player_name: 'Sistema',
          message: `👋 ${userNickname} entrou na nova sala!`,
          message_type: 'system'
        });

      onJoinRoom(newRoom.id);
    } catch (error) {
      console.error('Error creating new room:', error);
      toast({
        title: "Erro",
        description: "Sala cheia e falha ao criar nova sala",
        variant: "destructive",
      });
    }
  };

  const joinRoom = async (room: Room) => {
    if (!user) {
      toast({
        title: "Autenticação necessária",
        description: "Faça login para entrar em uma sala",
        variant: "destructive",
      });
      return;
    }

    try {
      // Check if room is full
      if (room.player_count >= room.max_players) {
        await createNewRoomWhenFull(room);
        return;
      }

      // Check if already in room
      const { data: existingPlayer } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .single();

      if (existingPlayer) {
        // Update to online if was offline
        await supabase
          .from('room_players')
          .update({ is_online: true })
          .eq('room_id', room.id)
          .eq('user_id', user.id);
          
        onJoinRoom(room.id);
        return;
      }

      // Join room directly with user nickname
      const userNickname = user.user_metadata?.nickname || user.email?.split('@')[0] || 'Jogador';
      
      const { error: playerError } = await supabase
        .from('room_players')
        .insert({
          room_id: room.id,
          user_id: user.id,
          player_name: userNickname,
          is_ready: true,
          is_online: true
        });

      if (playerError) throw playerError;

      // Send system message
      await supabase
        .from('chat_messages')
        .insert({
          room_id: room.id,
          user_id: user.id,
          player_name: 'Sistema',
          message: `👋 ${userNickname} entrou na sala!`,
          message_type: 'system'
        });

      onJoinRoom(room.id);
    } catch (error) {
      console.error('Error joining room:', error);
      toast({
        title: "Erro",
        description: "Falha ao entrar na sala",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-background flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            🎮 Multiplayer
          </h1>
          <p className="text-muted-foreground mb-6">Faça login para jogar com amigos!</p>
          {onBackToProfile && (
            <Button onClick={onBackToProfile} variant="outline">
              Voltar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent animate-float">
            🎮 Multiplayer TheoNess
          </h1>
          <p className="text-muted-foreground">Jogue com até 5 amigos em tempo real!</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Create Room */}
          <Card className="p-6 game-ui-card">
            <h2 className="text-2xl font-bold mb-4 text-primary">🏗️ Criar Sala</h2>
            <div className="space-y-4">
              <Input
                placeholder="Nome da sala (opcional - será Sala 1, 2, 3...)"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                maxLength={50}
              />
              <Button
                onClick={createRoom}
                disabled={isCreating}
                className="w-full bg-gradient-primary hover:opacity-90"
              >
                {isCreating ? 'Criando...' : '🎮 Criar Sala'}
              </Button>
            </div>
          </Card>

          {/* Join by Code */}
          <Card className="p-6 game-ui-card">
            <h2 className="text-2xl font-bold mb-4 text-accent">🔐 Entrar por Código</h2>
            <div className="space-y-4">
              <Input
                placeholder="Código da sala"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
              <Button
                onClick={joinRoomByCode}
                disabled={isJoining}
                className="w-full"
                variant="secondary"
              >
                {isJoining ? 'Entrando...' : '🚪 Entrar na Sala'}
              </Button>
            </div>
          </Card>
        </div>

        <Separator className="my-8" />

        {/* Available Rooms */}
        <Card className="p-6 game-ui-card">
          <h2 className="text-2xl font-bold mb-6 text-primary">🏆 Salas Disponíveis</h2>
          
          {rooms.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg mb-2">Nenhuma sala disponível</p>
              <p>Crie uma nova sala para começar a jogar!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {rooms.map((room) => (
                <Card key={room.id} className="p-4 border border-primary/20 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg">{room.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {room.code}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Nível {room.current_level + 1}
                        </Badge>
                        {room.status !== 'waiting' && (
                          <Badge variant={room.status === 'playing' ? 'default' : 'secondary'} className="text-xs">
                            {room.status === 'playing' ? 'Em jogo' : 'Finalizada'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          👥 {room.player_count}/{room.max_players} jogadores
                        </span>
                        <span className="flex items-center gap-1">
                          🎯 {room.status === 'waiting' ? 'Aguardando' : room.status === 'playing' ? 'Em jogo' : 'Finalizada'}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => joinRoom(room)}
                      disabled={room.player_count >= room.max_players}
                      className="ml-4"
                    >
                      {room.player_count >= room.max_players ? 'Nova Sala' : 'Entrar'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        {onBackToProfile && (
          <div className="text-center mt-8">
            <Button onClick={onBackToProfile} variant="outline">
              ← Voltar ao Perfil
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};