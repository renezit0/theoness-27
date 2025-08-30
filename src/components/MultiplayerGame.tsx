import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MultiplayerChat } from './MultiplayerChat';
import { RankingBoard } from './RankingBoard';
import { MobileChatOverlay } from './MobileChatOverlay';
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
  carriedBy: string | null;
}

interface ScratchingPost {
  x: number;
  y: number;
  width: number;
  height: number;
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
  const [timeLeft, setTimeLeft] = useState(60);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundFishCollected, setRoundFishCollected] = useState<{[key: string]: number}>({});
  const [carriedFish, setCarriedFish] = useState<number | null>(null);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [showChatOverlay, setShowChatOverlay] = useState(false);
  const { toast } = useToast();

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Game objects
  const kitty = useRef<GameObject & { 
    animationState: 'idle' | 'walk' | 'jump';
    animationFrame: number;
    facingDirection: 'left' | 'right';
  }>({
    x: 100,
    y: 1120, // Start at ground level (CANVAS_HEIGHT - ground platform height - kitty height)
    width: 40,
    height: 40,
    vx: 0,
    vy: 0,
    animationState: 'idle',
    animationFrame: 0,
    facingDirection: 'right'
  });

  // Multiple level configurations optimized for mobile portrait HD (800x1200)
  const levelConfigs = [
    // Level 1 - Basic vertical climb
    {
      platforms: [
        { x: 0, y: 1180, width: 800, height: 20 }, // Ground
        { x: 100, y: 1000, width: 200, height: 20 },
        { x: 500, y: 850, width: 200, height: 20 },
        { x: 150, y: 700, width: 200, height: 20 },
        { x: 450, y: 550, width: 200, height: 20 },
        { x: 200, y: 400, width: 200, height: 20 },
        { x: 300, y: 250, width: 200, height: 20 },
      ],
      fishes: [
        { x: 375, y: 220, width: 25, height: 20, collected: false, carriedBy: null },
      ]
    },
    // Level 2 - Zigzag pattern
    {
      platforms: [
        { x: 0, y: 1180, width: 800, height: 20 }, // Ground
        { x: 600, y: 1050, width: 150, height: 20 },
        { x: 50, y: 920, width: 150, height: 20 },
        { x: 600, y: 790, width: 150, height: 20 },
        { x: 50, y: 660, width: 150, height: 20 },
        { x: 550, y: 530, width: 150, height: 20 },
        { x: 100, y: 400, width: 150, height: 20 },
        { x: 500, y: 270, width: 150, height: 20 },
        { x: 300, y: 140, width: 200, height: 20 },
      ],
      fishes: [
        { x: 375, y: 110, width: 25, height: 20, collected: false, carriedBy: null },
      ]
    },
    // Level 3 - Center tower
    {
      platforms: [
        { x: 0, y: 1180, width: 800, height: 20 }, // Ground
        { x: 350, y: 1050, width: 100, height: 20 },
        { x: 250, y: 920, width: 300, height: 20 },
        { x: 350, y: 790, width: 100, height: 20 },
        { x: 200, y: 660, width: 400, height: 20 },
        { x: 350, y: 530, width: 100, height: 20 },
        { x: 250, y: 400, width: 300, height: 20 },
        { x: 350, y: 270, width: 100, height: 20 },
        { x: 300, y: 140, width: 200, height: 20 },
      ],
      fishes: [
        { x: 375, y: 110, width: 25, height: 20, collected: false, carriedBy: null },
      ]
    },
    // Level 4 - Side jumps
    {
      platforms: [
        { x: 0, y: 1180, width: 800, height: 20 }, // Ground
        { x: 50, y: 1050, width: 120, height: 20 },
        { x: 630, y: 940, width: 120, height: 20 },
        { x: 50, y: 830, width: 120, height: 20 },
        { x: 630, y: 720, width: 120, height: 20 },
        { x: 100, y: 610, width: 120, height: 20 },
        { x: 580, y: 500, width: 120, height: 20 },
        { x: 150, y: 390, width: 120, height: 20 },
        { x: 530, y: 280, width: 120, height: 20 },
        { x: 340, y: 170, width: 120, height: 20 },
      ],
      fishes: [
        { x: 375, y: 140, width: 25, height: 20, collected: false, carriedBy: null },
      ]
    },
    // Level 5 - Stairs
    {
      platforms: [
        { x: 0, y: 1180, width: 800, height: 20 }, // Ground
        { x: 0, y: 1050, width: 160, height: 20 },
        { x: 160, y: 920, width: 160, height: 20 },
        { x: 320, y: 790, width: 160, height: 20 },
        { x: 480, y: 660, width: 160, height: 20 },
        { x: 320, y: 530, width: 160, height: 20 },
        { x: 160, y: 400, width: 160, height: 20 },
        { x: 320, y: 270, width: 160, height: 20 },
        { x: 320, y: 140, width: 160, height: 20 },
      ],
      fishes: [
        { x: 375, y: 110, width: 25, height: 20, collected: false, carriedBy: null },
      ]
    }
  ];

  const platforms = useRef<Platform[]>([]);

  const fishes = useRef<Fish[]>([]);
  const scratchingPost = useRef<ScratchingPost>({ x: 375, y: 40, width: 50, height: 60 }); // Centered at top for HD

  const GRAVITY = 0.8; // Increased gravity for more realistic physics
  const JUMP_FORCE = -15; // Stronger jump to compensate for gravity
  const MOVE_SPEED = 6;
  const CANVAS_WIDTH = 800; // Higher resolution for mobile HD
  const CANVAS_HEIGHT = 1200; // Taller for mobile portrait HD

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

  // Initialize level when game starts
  const initializeLevel = useCallback(() => {
    const randomLevel = Math.floor(Math.random() * levelConfigs.length);
    setCurrentLevel(randomLevel);
    platforms.current = [...levelConfigs[randomLevel].platforms];
    fishes.current = [...levelConfigs[randomLevel].fishes];
    setCarriedFish(null);
  }, []);

  const collectFish = useCallback(async (fishIndex: number) => {
    if (!currentPlayer || carriedFish !== null) return; // Can only carry one fish at a time

    try {
      // Mark fish as carried
      fishes.current[fishIndex].carriedBy = user.id;
      setCarriedFish(fishIndex);

      await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          user_id: user.id,
          player_name: 'Sistema',
          message: `🐟 ${currentPlayer.player_name} pegou um peixe! Leve-o ao arranhador!`,
          message_type: 'game'
        });

    } catch (error) {
      console.error('Error collecting fish:', error);
    }
  }, [currentPlayer, roomId, user.id, carriedFish]);

  const deliverFish = useCallback(async () => {
    if (!currentPlayer || carriedFish === null) return;

    const newFishCount = currentPlayer.fish_collected + 1;

    try {
      await supabase
        .from('room_players')
        .update({
          fish_collected: newFishCount
        })
        .eq('room_id', roomId)
        .eq('user_id', user.id);

      // Mark fish as collected
      fishes.current[carriedFish].collected = true;
      setCarriedFish(null);

      await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          user_id: user.id,
          player_name: 'Sistema',
          message: `🎯 ${currentPlayer.player_name} entregou o peixe! Próxima rodada em 3 segundos...`,
          message_type: 'game'
        });

      // Start next round automatically after fish delivery (Transformice style)
      setTimeout(() => {
        initializeLevel();
        const nextRound = currentRound + 1;
        setCurrentRound(nextRound);
        setTimeLeft(60);
      }, 3000);

    } catch (error) {
      console.error('Error delivering fish:', error);
    }
  }, [currentPlayer, roomId, user.id, carriedFish, initializeLevel]);

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
      setTimeLeft(60);
      initializeLevel();
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  const startNextRound = async () => {
    try {
      const nextRound = currentRound + 1;
      setCurrentRound(nextRound);
      setTimeLeft(60);
      
      // Initialize new random level
      initializeLevel();
      
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

  // Mobile touch controls
  const handleTouchControl = useCallback((direction: 'left' | 'right' | 'jump') => {
    switch (direction) {
      case 'left':
        keysRef.current.add('a');
        setTimeout(() => keysRef.current.delete('a'), 100);
        break;
      case 'right':
        keysRef.current.add('d');
        setTimeout(() => keysRef.current.delete('d'), 100);
        break;
      case 'jump':
        keysRef.current.add('w');
        setTimeout(() => keysRef.current.delete('w'), 100);
        break;
    }
  }, []);

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

    // Jump (improved physics)
    if ((keysRef.current.has('w') || keysRef.current.has(' ') || keysRef.current.has('arrowup'))) {
      const kittyBottom = kitty.current.y + kitty.current.height;
      let onPlatform = false;
      
      // Check if on ground
      if (kittyBottom >= CANVAS_HEIGHT - 5) {
        onPlatform = true;
      } else {
        // Check if on any platform with improved collision detection
        onPlatform = platforms.current.some(platform => {
          const isOnPlatform = kitty.current.x + kitty.current.width > platform.x + 5 &&
                              kitty.current.x < platform.x + platform.width - 5 &&
                              Math.abs(kittyBottom - platform.y) <= 10 &&
                              kitty.current.vy >= -1; // Allow small upward velocity
          return isOnPlatform;
        });
      }
      
      if (onPlatform && Math.abs(kitty.current.vy) < 2) {
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
      // Reset to ground level when falling
      kitty.current.x = 400; // Center of screen
      kitty.current.y = 1120; // Ground level
      kitty.current.vx = 0;
      kitty.current.vy = 0;
    }

    // Update position in database
    updatePlayerPosition(kitty.current.x, kitty.current.y);

    // Fish collection (only if not carrying one)
    fishes.current.forEach((fish, index) => {
      if (!fish.collected && fish.carriedBy === null && carriedFish === null && checkCollision(kitty.current, fish)) {
        collectFish(index);
      }
    });

    // Fish delivery to scratching post
    if (carriedFish !== null && checkCollision(kitty.current, scratchingPost.current)) {
      deliverFish();
    }

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

    // Draw scratching post
    const post = scratchingPost.current;
    ctx.save();
    ctx.shadowColor = '#8b5cf6';
    ctx.shadowBlur = 15;
    
    // Post gradient
    const postGradient = ctx.createLinearGradient(post.x, post.y, post.x + post.width, post.y + post.height);
    postGradient.addColorStop(0, '#a855f7');
    postGradient.addColorStop(1, '#7c3aed');
    ctx.fillStyle = postGradient;
    ctx.fillRect(post.x, post.y, post.width, post.height);
    
    // Post decoration
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏆', post.x + post.width/2, post.y + post.height/2 + 10);
    
    // Goal text
    ctx.font = '12px Arial';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText('ENTREGA AQUI!', post.x + post.width/2, post.y - 10);
    ctx.fillText('ENTREGA AQUI!', post.x + post.width/2, post.y - 10);
    
    ctx.restore();

    // Draw fishes
    fishes.current.forEach((fish, index) => {
      if (!fish.collected && fish.carriedBy !== user.id) {
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
      
      // Draw carried fish for current player
      if (player.user_id === user.id && carriedFish !== null) {
        ctx.font = '16px Arial';
        ctx.fillText('🐟', x + 20, y - 15);
        
        // Floating animation for carried fish
        const floatOffset = Math.sin(kitty.current.animationFrame * 0.1) * 2;
        ctx.save();
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 8;
        ctx.fillText('🐟', x + 20, y - 20 + floatOffset);
        ctx.restore();
      }
    });

    kitty.current.animationFrame += 1;
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameStarted, players, user.id, imageLoaded, updatePlayerPosition, collectFish, deliverFish, carriedFish]);

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
    <div className="min-h-screen bg-gradient-background">
      {/* Mobile Layout */}
      {isMobile ? (
        <div className="fixed inset-0 flex flex-col overflow-hidden">
          {/* Header Mobile Compacto */}
          <div className="p-2 bg-background/90 backdrop-blur border-b flex-shrink-0">
            <div className="text-center">
              <h1 className="text-sm font-bold bg-gradient-primary bg-clip-text text-transparent">
                🎮 {room.name} • Código: {room.code}
              </h1>
              {gameStarted && (
                <div className="flex justify-center gap-3 text-xs text-muted-foreground">
                  <span className="text-destructive">⏰ {timeLeft}s</span>
                  <span className="text-primary">🎯 Rodada {currentRound}</span>
                  <span className="text-accent">🐟 1 peixe</span>
                </div>
              )}
            </div>
          </div>

          {/* Game Area - Full Screen Mobile */}
          <div className="flex-1 relative overflow-hidden">
            {room.status === 'waiting' && (
              <div className="absolute inset-0 z-20 bg-background/95 backdrop-blur flex flex-col items-center justify-center">
                <p className="mb-4 text-center">Aguardando início do jogo...</p>
                <Button onClick={startGame} className="bg-gradient-primary hover:opacity-90">
                  🚀 Iniciar Jogo
                </Button>
              </div>
            )}
            
            {/* Canvas HD Mobile - Escala responsiva */}
            <canvas 
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full h-full"
              style={{ 
                touchAction: 'none',
                imageRendering: 'pixelated',
                width: '100vw',
                height: '100vh',
                objectFit: 'contain',
                background: 'linear-gradient(to bottom, #87CEEB, #98FB98, #90EE90)'
              }}
            />

            {/* Controles Mobile - Overlay direto na tela */}
            {gameStarted && (
              <>
                {/* Controle Esquerda */}
                <button
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleTouchControl('left');
                  }}
                  className="absolute left-4 bottom-20 w-14 h-14 bg-black/30 border-2 border-white/50 rounded-full flex items-center justify-center text-white text-xl font-bold active:bg-black/50 transition-colors shadow-lg backdrop-blur"
                  style={{ touchAction: 'manipulation' }}
                >
                  ←
                </button>

                {/* Controle Direita */}
                <button
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleTouchControl('right');
                  }}
                  className="absolute right-4 bottom-20 w-14 h-14 bg-black/30 border-2 border-white/50 rounded-full flex items-center justify-center text-white text-xl font-bold active:bg-black/50 transition-colors shadow-lg backdrop-blur"
                  style={{ touchAction: 'manipulation' }}
                >
                  →
                </button>

                {/* Controle Pular - Centro */}
                <button
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleTouchControl('jump');
                  }}
                  className="absolute left-1/2 transform -translate-x-1/2 bottom-4 w-16 h-16 bg-red-500/40 border-2 border-red-300/70 rounded-full flex items-center justify-center text-white text-2xl font-bold active:bg-red-500/60 transition-colors shadow-lg backdrop-blur"
                  style={{ touchAction: 'manipulation' }}
                >
                  ↑
                </button>

                {/* Chat Button - Canto superior direito */}
                <button
                  onClick={() => setShowChatOverlay(true)}
                  className="absolute top-4 right-4 w-10 h-10 bg-blue-500/40 border border-white/50 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg backdrop-blur"
                >
                  💬
                </button>

                {/* Botões de Ação - Canto superior esquerdo */}
                <div className="absolute top-4 left-4 flex gap-1">
                  <button
                    onClick={leaveRoom}
                    className="px-2 py-1 bg-red-500/40 border border-white/50 rounded text-white text-xs font-bold shadow-lg backdrop-blur"
                  >
                    Sair
                  </button>
                  <button
                    onClick={onLeaveRoom}
                    className="px-2 py-1 bg-blue-500/40 border border-white/50 rounded text-white text-xs font-bold shadow-lg backdrop-blur"
                  >
                    Mudar
                  </button>
                </div>

                {/* Instruções Mobile - Overlay discreto */}
                <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 text-center">
                  <div className="bg-black/30 backdrop-blur px-3 py-1 rounded-full">
                    <p className="text-white text-xs">Pegue o peixe e leve ao arranhador! 🐟→🏆</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mobile Chat Overlay */}
          <MobileChatOverlay 
            roomId={roomId} 
            user={user} 
            players={players} 
            isOpen={showChatOverlay}
            onClose={() => setShowChatOverlay(false)}
          />
        </div>
      ) : (
        /* Desktop Layout */
        <div className="p-4">
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
                      <span className="text-accent">🐟 1 peixe</span>
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
                      <p>🎮 Use WASD ou setas para mover • Pegue o peixe e leve ao arranhador no topo!</p>
                    </div>
                  )}
                </Card>

                <div className="flex justify-center gap-2 mt-4">
                  <Button onClick={leaveRoom} variant="outline">
                    ← Sair da Sala
                  </Button>
                  <Button onClick={onLeaveRoom} variant="secondary">
                    🔄 Mudar de Sala
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
      )}
    </div>
  );
};