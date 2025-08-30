import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MultiplayerChat } from './MultiplayerChat';
import { RankingBoard } from './RankingBoard';
import kittyImage from '@/assets/kitty.png';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
}

interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Fish {
  x: number;
  y: number;
  width: number;
  height: number;
  collected: boolean;
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

interface Room {
  id: string;
  name: string;
  code: string;
  current_level: number;
  status: string;
}

interface MultiplayerGameProps {
  user: any;
  roomId: string;
  onLeaveRoom: () => void;
}

export const MultiplayerGame = ({ user, roomId, onLeaveRoom }: MultiplayerGameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const keysRef = useRef<Set<string>>(new Set());
  const kittyImageRef = useRef<HTMLImageElement | null>(null);
  const lastPositionUpdate = useRef<number>(0);
  
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundFishCollected, setRoundFishCollected] = useState<{[key: string]: number}>({});
  const { toast } = useToast();

  // Game objects
  const kitty = useRef<GameObject & { 
    animationState: 'idle' | 'walk' | 'jump';
    animationFrame: number;
    facingDirection: 'left' | 'right';
  }>({
    x: 100,
    y: 300,
    width: 40,
    height: 40,
    vx: 0,
    vy: 0,
    animationState: 'idle',
    animationFrame: 0,
    facingDirection: 'right'
  });

  // Level data (simplified for multiplayer)
  const platforms = useRef<Platform[]>([
    { x: 0, y: 580, width: 800, height: 20 }, // Ground
    { x: 200, y: 450, width: 150, height: 20 },
    { x: 500, y: 400, width: 100, height: 20 },
    { x: 150, y: 300, width: 120, height: 20 },
  ]);

  const fishes = useRef<Fish[]>([
    { x: 250, y: 420, width: 25, height: 20, collected: false },
    { x: 530, y: 370, width: 25, height: 20, collected: false },
    { x: 180, y: 270, width: 25, height: 20, collected: false },
  ]);

  const GRAVITY = 0.5;
  const JUMP_FORCE = -12;
  const MOVE_SPEED = 5;
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  // Load kitty image
  useEffect(() => {
    const img = new Image();
    img.src = kittyImage;
    img.onload = () => {
      kittyImageRef.current = img;
      setImageLoaded(true);
    };
  }, []);

  // Load room and player data
  useEffect(() => {
    loadRoomData();
    loadPlayers();
    
    // Subscribe to real-time updates
    const roomChannel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          console.log('Room update:', payload);
          if (payload.new) {
            setRoom(payload.new as Room);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_players',
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          console.log('Player update:', payload);
          await loadPlayers();
          
          // Check if all players went offline and close room
          const { data: onlinePlayers } = await supabase
            .from('room_players')
            .select('*')
            .eq('room_id', roomId)
            .eq('is_online', true);
            
          if (onlinePlayers?.length === 0) {
            await supabase
              .from('rooms')
              .update({ status: 'completed' })
              .eq('id', roomId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [roomId]);

  // Timer effect
  useEffect(() => {
    if (!gameStarted || room?.status !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, room?.status]);

  const loadRoomData = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error) throw error;
      setRoom(data);
    } catch (error) {
      console.error('Error loading room:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados da sala",
        variant: "destructive",
      });
    }
  };

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_online', true) // Only load online players
        .order('joined_at');

      if (error) throw error;
      setPlayers(data || []);
      
      const myPlayer = data?.find(p => p.user_id === user.id);
      if (myPlayer) {
        setCurrentPlayer(myPlayer);
        
        // Update current player as online if found
        await supabase
          .from('room_players')
          .update({ is_online: true })
          .eq('id', myPlayer.id);
      } else {
        // Join as new player if not found
        const userNickname = user.user_metadata?.nickname || user.email?.split('@')[0] || 'Jogador';
        
        const { data: newPlayer, error: insertError } = await supabase
          .from('room_players')
          .insert({
            room_id: roomId,
            user_id: user.id,
            player_name: userNickname,
            is_ready: true,
            is_online: true
          })
          .select()
          .single();
          
        if (!insertError && newPlayer) {
          setCurrentPlayer(newPlayer);
          
          // Send join message
          await supabase
            .from('chat_messages')
            .insert({
              room_id: roomId,
              user_id: user.id,
              player_name: 'Sistema',
              message: `👋 ${userNickname} entrou na sala!`,
              message_type: 'system'
            });
        }
      }

      // Check if no players are online and mark room as completed
      if (data?.length === 0) {
        await supabase
          .from('rooms')
          .update({ status: 'completed' })
          .eq('id', roomId);
      }
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };

  const updatePlayerPosition = useCallback(async (x: number, y: number) => {
    const now = Date.now();
    if (now - lastPositionUpdate.current < 100) return; // Throttle updates
    
    lastPositionUpdate.current = now;
    
    try {
      await supabase
        .from('room_players')
        .update({
          position_x: x,
          position_y: y
        })
        .eq('room_id', roomId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error updating position:', error);
    }
  }, [roomId, user.id]);

  const collectFish = useCallback(async (fishIndex: number) => {
    if (!currentPlayer) return;

    const isFirstToCollect = !roundFishCollected[`fish_${fishIndex}_round_${currentRound}`];
    const newFishCount = currentPlayer.fish_collected + 1;

    try {
      await supabase
        .from('room_players')
        .update({
          fish_collected: newFishCount
        })
        .eq('room_id', roomId)
        .eq('user_id', user.id);

      // Send chat message
      const message = isFirstToCollect 
        ? `🏆 ${currentPlayer.player_name} coletou o peixe primeiro! (Rodada ${currentRound})`
        : `🐟 ${currentPlayer.player_name} coletou um peixinho! (Rodada ${currentRound})`;

      await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          user_id: user.id,
          player_name: 'Sistema',
          message,
          message_type: 'game'
        });

      // Track first fish collection
      if (isFirstToCollect) {
        setRoundFishCollected(prev => ({
          ...prev,
          [`fish_${fishIndex}_round_${currentRound}`]: Date.now()
        }));
      }

      fishes.current[fishIndex].collected = true;
    } catch (error) {
      console.error('Error collecting fish:', error);
    }
  }, [currentPlayer, roomId, user.id, currentRound, roundFishCollected]);

  const checkWinCondition = useCallback(() => {
    const allPlayersCollected = players.every(player => player.fish_collected >= currentRound);
    
    if (allPlayersCollected && players.length > 0) {
      startNextRound();
    }
  }, [players, currentRound]);

  useEffect(() => {
    checkWinCondition();
  }, [players, checkWinCondition]);

  const startGame = async () => {
    if (!room || room.status !== 'waiting') return;

    try {
      await supabase
        .from('rooms')
        .update({ status: 'playing' })
        .eq('id', roomId);

      await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          user_id: user.id,
          player_name: 'Sistema',
          message: `🎮 Jogo iniciado! Colete peixes e trabalhem em equipe!`,
          message_type: 'system'
        });

      setGameStarted(true);
      setTimeLeft(120);
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  const startNextRound = async () => {
    try {
      const nextRound = currentRound + 1;
      setCurrentRound(nextRound);
      setTimeLeft(120);
      
      // Reset fish positions
      fishes.current = fishes.current.map(fish => ({ ...fish, collected: false }));
      
      await supabase
        .from('rooms')
        .update({ current_level: nextRound - 1 })
        .eq('id', roomId);

      await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          user_id: user.id,
          player_name: 'Sistema',
          message: `🎉 Rodada ${currentRound} concluída! Iniciando rodada ${nextRound}!`,
          message_type: 'system'
        });

    } catch (error) {
      console.error('Error starting next round:', error);
    }
  };

  const endGame = async (won = false) => {
    try {
      await supabase
        .from('rooms')
        .update({ status: won ? 'completed' : 'waiting' })
        .eq('id', roomId);

      await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          user_id: user.id,
          player_name: 'Sistema',
          message: won ? '🎉 Parabéns! Todos coletaram peixes!' : '⏰ Tempo esgotado!',
          message_type: 'system'
        });

      setGameStarted(false);
      setCurrentRound(1);
    } catch (error) {
      console.error('Error ending game:', error);
    }
  };

  const leaveRoom = async () => {
    try {
      // Update player as offline instead of deleting
      await supabase
        .from('room_players')
        .update({ is_online: false })
        .eq('room_id', roomId)
        .eq('user_id', user.id);

      await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          user_id: user.id,
          player_name: 'Sistema',
          message: `👋 ${currentPlayer?.player_name || 'Jogador'} saiu da sala`,
          message_type: 'system'
        });

      onLeaveRoom();
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  // Key handling
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    keysRef.current.add(key);
    
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(key)) {
      e.preventDefault();
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    keysRef.current.delete(key);
    
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(key)) {
      e.preventDefault();
    }
  }, []);

  // Collision detection
  const checkCollision = (rect1: GameObject | Fish, rect2: Platform): boolean => {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
  };

  // Game loop
  const gameLoop = useCallback(() => {
    if (!canvasRef.current || !gameStarted) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGradient.addColorStop(0, '#87CEEB');
    bgGradient.addColorStop(0.7, '#98FB98');
    bgGradient.addColorStop(1, '#90EE90');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Handle input and animations for current player
    if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) {
      kitty.current.vx = -MOVE_SPEED;
      kitty.current.facingDirection = 'left';
      kitty.current.animationState = 'walk';
    } else if (keysRef.current.has('d') || keysRef.current.has('arrowright')) {
      kitty.current.vx = MOVE_SPEED;
      kitty.current.facingDirection = 'right';
      kitty.current.animationState = 'walk';
    } else {
      kitty.current.vx *= 0.8;
      kitty.current.animationState = 'idle';
    }

    // Jump
    if ((keysRef.current.has('w') || keysRef.current.has(' ') || keysRef.current.has('arrowup')) && 
        Math.abs(kitty.current.vy) < 0.1) {
      const kittyBottom = kitty.current.y + kitty.current.height;
      const onPlatform = platforms.current.some(platform => 
        kitty.current.x < platform.x + platform.width &&
        kitty.current.x + kitty.current.width > platform.x &&
        Math.abs(kittyBottom - platform.y) < 5
      );
      
      if (onPlatform) {
        kitty.current.vy = JUMP_FORCE;
        kitty.current.animationState = 'jump';
      }
    }

    // Apply gravity
    kitty.current.vy += GRAVITY;

    // Update position
    kitty.current.x += kitty.current.vx;
    kitty.current.y += kitty.current.vy;

    // Platform collisions
    platforms.current.forEach(platform => {
      if (checkCollision(kitty.current, platform)) {
        if (kitty.current.vy > 0 && kitty.current.y < platform.y) {
          kitty.current.y = platform.y - kitty.current.height;
          kitty.current.vy = 0;
        }
      }
    });

    // Boundary check
    if (kitty.current.x < 0) kitty.current.x = 0;
    if (kitty.current.x + kitty.current.width > CANVAS_WIDTH) {
      kitty.current.x = CANVAS_WIDTH - kitty.current.width;
    }
    if (kitty.current.y > CANVAS_HEIGHT) {
      kitty.current.x = 100;
      kitty.current.y = 300;
      kitty.current.vx = 0;
      kitty.current.vy = 0;
    }

    // Update position in database
    updatePlayerPosition(kitty.current.x, kitty.current.y);

    // Fish collection
    fishes.current.forEach((fish, index) => {
      if (!fish.collected && checkCollision(kitty.current, fish)) {
        collectFish(index);
      }
    });

    // Draw platforms
    platforms.current.forEach(platform => {
      const gradient = ctx.createLinearGradient(0, platform.y, 0, platform.y + platform.height);
      gradient.addColorStop(0, '#d97706');
      gradient.addColorStop(1, '#92400e');
      ctx.fillStyle = gradient;
      ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
      
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2;
      ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
    });

    // Draw fishes
    fishes.current.forEach((fish, index) => {
      if (!fish.collected) {
        const floatY = Math.sin((kitty.current.animationFrame + index * 30) * 0.05) * 3;
        
        ctx.save();
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 10;
        
        const fishGradient = ctx.createRadialGradient(
          fish.x + fish.width/2, fish.y + fish.height/2 + floatY, 0,
          fish.x + fish.width/2, fish.y + fish.height/2 + floatY, fish.width
        );
        fishGradient.addColorStop(0, '#fb923c');
        fishGradient.addColorStop(1, '#ea580c');
        ctx.fillStyle = fishGradient;
        ctx.fillRect(fish.x, fish.y + floatY, fish.width, fish.height);
        
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🐟', fish.x + fish.width/2, fish.y + 15 + floatY);
        
        ctx.restore();
      }
    });

    // Draw all players
    players.forEach(player => {
      let yOffset = 0;
      let scaleX = 1;
      let scaleY = 1;
      
      // Current player (kitty position) vs other players (database position)
      const x = player.user_id === user.id ? kitty.current.x : player.position_x;
      const y = player.user_id === user.id ? kitty.current.y : player.position_y;
      
      // Animation for current player
      if (player.user_id === user.id) {
        switch (kitty.current.animationState) {
          case 'idle':
            yOffset = Math.sin(kitty.current.animationFrame * 0.05) * 1;
            scaleX = 1 + Math.sin(kitty.current.animationFrame * 0.03) * 0.02;
            break;
          case 'walk':
            yOffset = Math.sin(kitty.current.animationFrame * 0.3) * 2;
            scaleX = 1 + Math.sin(kitty.current.animationFrame * 0.4) * 0.05;
            break;
          case 'jump':
            scaleY = 1.1;
            scaleX = 0.9;
            break;
        }
      }
      
      // Draw player kitty
      if (imageLoaded && kittyImageRef.current) {
        ctx.save();
        ctx.translate(x + 20, y + 20 + yOffset);
        ctx.scale(scaleX, scaleY);
        
        // Different colors for different players
        if (player.user_id !== user.id) {
          ctx.filter = `hue-rotate(${player.user_id.slice(-2).charCodeAt(0) * 10}deg)`;
        }
        
        const kittySize = 48;
        ctx.drawImage(kittyImageRef.current, -kittySize/2, -kittySize/2, kittySize, kittySize);
        ctx.restore();
      } else {
        ctx.font = '28px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = player.user_id === user.id ? '#ec4899' : '#8b5cf6';
        ctx.fillText('🐱', x + 20, y + 25 + yOffset);
      }
      
      // Draw player name
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeText(player.player_name, x + 20, y - 5);
      ctx.fillText(player.player_name, x + 20, y - 5);
      
      // Draw fish count
      ctx.fillText(`🐟 ${player.fish_collected}`, x + 20, y + 65);
    });

    kitty.current.animationFrame += 1;
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameStarted, players, user.id, imageLoaded, updatePlayerPosition, collectFish]);

  // Setup and cleanup
  useEffect(() => {
    if (!gameStarted) return;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameStarted, gameLoop, handleKeyDown, handleKeyUp]);

  if (!room) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
            🎮 {room.name}
          </h1>
          <div className="flex justify-center gap-4 text-sm text-muted-foreground">
            <span>Código: {room.code}</span>
            <span>Jogadores: {players.length}/5</span>
            <span>Status: {room.status === 'waiting' ? 'Aguardando' : room.status === 'playing' ? 'Em jogo' : 'Finalizado'}</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          {/* Game Area */}
          <div className="lg:col-span-3">
            <Card className="p-4 game-ui-card">
              {room.status === 'waiting' && (
                <div className="text-center mb-4">
                  <p className="mb-4">Aguardando início do jogo...</p>
                  <Button onClick={startGame} className="bg-gradient-primary hover:opacity-90">
                    🚀 Iniciar Jogo
                  </Button>
                </div>
              )}
              
              {gameStarted && (
                <div className="flex justify-center gap-6 mb-4 text-lg font-semibold">
                  <span className="text-destructive">⏰ {timeLeft}s</span>
                  <span className="text-primary">🎯 Rodada {currentRound}</span>
                  <span className="text-accent">🐟 Meta: {currentRound} peixe(s)</span>
                </div>
              )}

              <div className="flex justify-center">
                <canvas 
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className="border-2 border-primary/30 rounded-lg"
                />
              </div>

              {gameStarted && (
                <div className="text-center text-sm text-muted-foreground mt-4">
                  <p>🎮 Use WASD ou setas para mover • Todos devem coletar {currentRound} peixe(s)!</p>
                </div>
              )}
            </Card>

            <div className="text-center mt-4">
              <Button onClick={leaveRoom} variant="outline">
                ← Sair da Sala
              </Button>
            </div>
          </div>

          {/* Ranking Sidebar */}
          <div className="lg:col-span-1">
            <RankingBoard roomId={roomId} players={players} />
          </div>

          {/* Chat Bottom Section */}
          <div className="lg:col-span-1">
            <MultiplayerChat 
              roomId={roomId} 
              user={user} 
              players={players}
            />
          </div>
        </div>
      </div>
    </div>
  );
};