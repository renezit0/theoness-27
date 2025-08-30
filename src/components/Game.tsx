import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
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

interface Scratcher {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Level {
  platforms: Platform[];
  fishes: Fish[];
  scratcher: Scratcher;
  playerStart: { x: number; y: number };
}

interface GameProps {
  user?: any;
  onBackToProfile?: () => void;
}

export const Game = ({ user, onBackToProfile }: GameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const keysRef = useRef<Set<string>>(new Set());
  const kittyImageRef = useRef<HTMLImageElement | null>(null);
  
  const [score, setScore] = useState(0);
  const [fishCount, setFishCount] = useState(0);
  const [carriedFish, setCarriedFish] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [gameStarted, setGameStarted] = useState(false);
  const [hasReachedScratcher, setHasReachedScratcher] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const { toast } = useToast();

  // Load kitty image
  useEffect(() => {
    const img = new Image();
    img.src = kittyImage;
    img.onload = () => {
      kittyImageRef.current = img;
      setImageLoaded(true);
      console.log('Kitty image loaded successfully');
    };
    img.onerror = () => {
      console.error('Failed to load kitty image');
    };
  }, []);

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

  // Game levels configuration
  const levels = useRef<Level[]>([
    // Nível 1 - Básico
    {
      platforms: [
        { x: 0, y: 580, width: 800, height: 20 }, // Ground
        { x: 200, y: 450, width: 150, height: 20 },
        { x: 500, y: 400, width: 100, height: 20 },
        { x: 150, y: 300, width: 120, height: 20 },
      ],
      fishes: [
        { x: 250, y: 420, width: 25, height: 20, collected: false },
        { x: 530, y: 370, width: 25, height: 20, collected: false },
      ],
      scratcher: { x: 700, y: 530, width: 60, height: 50 },
      playerStart: { x: 50, y: 530 }
    },
    // Nível 2 - Torres altas
    {
      platforms: [
        { x: 0, y: 580, width: 800, height: 20 }, // Ground
        { x: 100, y: 450, width: 80, height: 20 },
        { x: 300, y: 350, width: 80, height: 20 },
        { x: 150, y: 250, width: 80, height: 20 },
        { x: 400, y: 150, width: 80, height: 20 },
        { x: 600, y: 200, width: 120, height: 20 },
      ],
      fishes: [
        { x: 430, y: 120, width: 25, height: 20, collected: false },
        { x: 180, y: 220, width: 25, height: 20, collected: false },
        { x: 630, y: 170, width: 25, height: 20, collected: false },
      ],
      scratcher: { x: 720, y: 530, width: 60, height: 50 },
      playerStart: { x: 30, y: 530 }
    },
    // Nível 3 - Labirinto complexo
    {
      platforms: [
        { x: 0, y: 580, width: 800, height: 20 }, // Ground
        { x: 100, y: 500, width: 100, height: 20 },
        { x: 300, y: 450, width: 100, height: 20 },
        { x: 500, y: 400, width: 100, height: 20 },
        { x: 650, y: 350, width: 100, height: 20 },
        { x: 100, y: 350, width: 80, height: 20 },
        { x: 300, y: 250, width: 80, height: 20 },
        { x: 500, y: 200, width: 80, height: 20 },
        { x: 200, y: 150, width: 100, height: 20 },
        { x: 450, y: 100, width: 80, height: 20 },
      ],
      fishes: [
        { x: 530, y: 170, width: 25, height: 20, collected: false },
        { x: 230, y: 120, width: 25, height: 20, collected: false },
        { x: 480, y: 70, width: 25, height: 20, collected: false },
        { x: 680, y: 320, width: 25, height: 20, collected: false },
      ],
      scratcher: { x: 50, y: 530, width: 60, height: 50 },
      playerStart: { x: 720, y: 530 }
    }
  ]);

  const currentLevelData = levels.current[currentLevel];
  const platforms = useRef<Platform[]>(currentLevelData?.platforms || []);
  const fishes = useRef<Fish[]>(currentLevelData?.fishes || []);
  const scratcher = useRef<Scratcher>(currentLevelData?.scratcher || { x: 0, y: 0, width: 0, height: 0 });

  const GRAVITY = 0.5;
  const JUMP_FORCE = -12;
  const MOVE_SPEED = 5;
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  const saveGameResult = useCallback(async () => {
    if (!user) {
      console.log('Modo demo - progresso não salvo');
      return;
    }
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Save individual game
      await supabase.from('games').insert({
        user_id: user.id,
        fish_collected: fishCount,
        score: score,
        time_taken: 60 - timeLeft
      });

      // Update user stats
      const { data: currentStats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (currentStats) {
        await supabase
          .from('user_stats')
          .update({
            total_fish: currentStats.total_fish + fishCount,
            games_played: currentStats.games_played + 1,
            best_score: Math.max(currentStats.best_score, score)
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_stats')
          .insert({
            user_id: user.id,
            total_fish: fishCount,
            games_played: 1,
            best_score: score
          });
      }
    } catch (error) {
      console.error('Error saving game:', error);
    }
  }, [user, fishCount, score, timeLeft]);

  const nextLevel = useCallback(() => {
    if (currentLevel < levels.current.length - 1) {
      setCurrentLevel(prev => prev + 1);
      setTimeLeft(prev => prev + 30); // Bonus time for completing level
      setCarriedFish(0);
      setHasReachedScratcher(false);
      
      // Update level data references
      const newLevelData = levels.current[currentLevel + 1];
      platforms.current = newLevelData.platforms;
      fishes.current = newLevelData.fishes.map(f => ({ ...f, collected: false }));
      scratcher.current = newLevelData.scratcher;
      
      // Reset kitty position to level start
      kitty.current.x = newLevelData.playerStart.x;
      kitty.current.y = newLevelData.playerStart.y;
      kitty.current.vx = 0;
      kitty.current.vy = 0;
      
      toast({
        title: `🎯 Nível ${currentLevel + 2}!`,
        description: "Novo desafio desbloqueado!",
      });
    } else {
      // All levels completed
      setGameStatus('won');
      saveGameResult();
      toast({
        title: "🏆 Jogo Completo!",
        description: `Você completou todos os níveis! Score Final: ${score}`,
      });
    }
  }, [currentLevel, score, saveGameResult, toast]);

  const checkWinCondition = useCallback(() => {
    const currentLevelFishes = levels.current[currentLevel].fishes;
    const allFishCollected = currentLevelFishes.every((_, index) => 
      fishes.current[index]?.collected
    );
    
    console.log('Checking win condition:', {
      allFishCollected,
      hasReachedScratcher,
      currentLevelFishes: currentLevelFishes.length,
      fishesState: fishes.current.map(f => f.collected),
      carriedFish
    });
    
    // Complete level when all fish are collected AND player reaches scratcher
    if (allFishCollected && hasReachedScratcher) {
      console.log('LEVEL COMPLETED!');
      // Level completed - delivered fish to scratcher
      nextLevel();
    }
  }, [currentLevel, hasReachedScratcher, nextLevel]);

  // Timer effect
  useEffect(() => {
    if (!gameStarted || gameStatus !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameStatus('lost');
          saveGameResult();
          toast({
            title: "⏰ Tempo esgotado!",
            description: `Você coletou ${fishCount} peixinhos. Score: ${score}`,
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, gameStatus, saveGameResult, fishCount, score, toast]);

  useEffect(() => {
    checkWinCondition();
  }, [fishCount, hasReachedScratcher, checkWinCondition]);

  // Key handling with preventDefault for arrow keys
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    keysRef.current.add(key);
    
    // Prevent default behavior for game controls to stop page scrolling
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(key)) {
      e.preventDefault();
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    keysRef.current.delete(key);
    
    // Prevent default behavior for game controls
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
    if (!canvasRef.current || gameStatus !== 'playing') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGradient.addColorStop(0, '#87CEEB'); // Sky blue
    bgGradient.addColorStop(0.7, '#98FB98'); // Light green
    bgGradient.addColorStop(1, '#90EE90'); // Green
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Handle input and animations
    if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) {
      kitty.current.vx = -MOVE_SPEED;
      kitty.current.facingDirection = 'left';
      kitty.current.animationState = 'walk';
    } else if (keysRef.current.has('d') || keysRef.current.has('arrowright')) {
      kitty.current.vx = MOVE_SPEED;
      kitty.current.facingDirection = 'right';
      kitty.current.animationState = 'walk';
    } else {
      kitty.current.vx *= 0.8; // Friction
      kitty.current.animationState = 'idle';
    }

    // Jump
    if ((keysRef.current.has('w') || keysRef.current.has(' ') || keysRef.current.has('arrowup')) && 
        Math.abs(kitty.current.vy) < 0.1) {
      // Check if on ground/platform
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
        // Coming from above
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
      // Reset position if falling off
      kitty.current.x = 100;
      kitty.current.y = 300;
      kitty.current.vx = 0;
      kitty.current.vy = 0;
    }

    // Fish collection
    fishes.current.forEach(fish => {
      if (!fish.collected && checkCollision(kitty.current, fish)) {
        fish.collected = true;
        setScore(prev => prev + 10);
        setFishCount(prev => prev + 1);
        setCarriedFish(prev => prev + 1);
        toast({
          title: "🐟 Peixinho coletado!",
          description: `+10 pontos | Carregando: ${carriedFish + 1} peixe(s)`,
        });
      }
    });

    // Scratcher collision - delivery point
    if (checkCollision(kitty.current, scratcher.current)) {
      console.log('Touching scratcher! hasReachedScratcher:', hasReachedScratcher, 'carriedFish:', carriedFish);
      if (!hasReachedScratcher && carriedFish > 0) {
        setHasReachedScratcher(true);
        setScore(prev => prev + carriedFish * 20); // Bonus for reaching scratcher with fish
        toast({
          title: "🪚 Arranhador alcançado!",
          description: `Entregue ${carriedFish} peixe(s) - Bônus: +${carriedFish * 20} pontos!`,
        });
      } else if (!hasReachedScratcher) {
        setHasReachedScratcher(true);
      }
    } else {
      setHasReachedScratcher(false);
    }

    // Draw platforms with enhanced graphics
    platforms.current.forEach(platform => {
      const gradient = ctx.createLinearGradient(0, platform.y, 0, platform.y + platform.height);
      gradient.addColorStop(0, '#d97706');
      gradient.addColorStop(1, '#92400e');
      ctx.fillStyle = gradient;
      ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
      
      // Add platform border
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2;
      ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
    });

    // Draw scratcher (goal) with enhanced graphics
    const scratcherGradient = ctx.createLinearGradient(
      scratcher.current.x, scratcher.current.y,
      scratcher.current.x, scratcher.current.y + scratcher.current.height
    );
    
    if (hasReachedScratcher) {
      scratcherGradient.addColorStop(0, '#4ade80');
      scratcherGradient.addColorStop(1, '#15803d');
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 20;
    } else {
      scratcherGradient.addColorStop(0, '#a855f7');
      scratcherGradient.addColorStop(1, '#6b21a8');
    }
    
    ctx.fillStyle = scratcherGradient;
    ctx.fillRect(scratcher.current.x, scratcher.current.y, scratcher.current.width, scratcher.current.height);
    
    // Animated scratcher emoji
    const scratcherScale = hasReachedScratcher ? 1 + Math.sin(kitty.current.animationFrame * 0.2) * 0.1 : 1;
    ctx.save();
    ctx.translate(scratcher.current.x + 30, scratcher.current.y + 30);
    ctx.scale(scratcherScale, scratcherScale);
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🪚', 0, 0);
    ctx.restore();
    
    ctx.shadowBlur = 0;

    // Draw fishes with floating animation
    fishes.current.forEach((fish, index) => {
      if (!fish.collected) {
        const floatY = Math.sin((kitty.current.animationFrame + index * 30) * 0.05) * 3;
        
        // Fish glow effect
        ctx.save();
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 10;
        
        // Fish body
        const fishGradient = ctx.createRadialGradient(
          fish.x + fish.width/2, fish.y + fish.height/2 + floatY, 0,
          fish.x + fish.width/2, fish.y + fish.height/2 + floatY, fish.width
        );
        fishGradient.addColorStop(0, '#fb923c');
        fishGradient.addColorStop(1, '#ea580c');
        ctx.fillStyle = fishGradient;
        ctx.fillRect(fish.x, fish.y + floatY, fish.width, fish.height);
        
        // Fish emoji with float effect
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🐟', fish.x + fish.width/2, fish.y + 15 + floatY);
        
        ctx.restore();
      }
    });

    // Update animation frame
    kitty.current.animationFrame += 1;

    // Draw kitty with enhanced graphics and animations
    ctx.save();
    
    // Apply facing direction
    if (kitty.current.facingDirection === 'left') {
      ctx.scale(-1, 1);
      ctx.translate(-kitty.current.x * 2 - kitty.current.width, 0);
    }
    
    // Animation effects based on state
    let yOffset = 0;
    let scaleX = 1;
    let scaleY = 1;
    
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
    
    // Draw kitty image with animation (no background shape)
    if (imageLoaded && kittyImageRef.current) {
      ctx.save();
      ctx.translate(kitty.current.x + kitty.current.width/2, kitty.current.y + kitty.current.height/2 + yOffset);
      ctx.scale(scaleX, scaleY);
      // Draw larger kitty (50% bigger)
      const kittySize = kitty.current.width * 1.5;
      ctx.drawImage(kittyImageRef.current, -kittySize/2, -kittySize/2, kittySize, kittySize);
      ctx.restore();
    } else {
      // Fallback to emoji while image loads
      ctx.font = '28px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ec4899';
      ctx.fillText('🐱', kitty.current.x + kitty.current.width/2, kitty.current.y + 25 + yOffset);
    }
    
    // Add sparkle effect when moving
    if (kitty.current.animationState === 'walk' && kitty.current.animationFrame % 10 === 0) {
      ctx.font = '12px Arial';
      ctx.fillText('✨', kitty.current.x + Math.random() * 40, kitty.current.y + Math.random() * 40);
    }
    
    ctx.restore();

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameStatus, toast]);

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

  const startGame = () => {
    setGameStarted(true);
    setScore(0);
    setFishCount(0);
    setCarriedFish(0);
    setCurrentLevel(0);
    setTimeLeft(90);
    setGameStatus('playing');
    setHasReachedScratcher(false);
    
    // Initialize first level
    const firstLevel = levels.current[0];
    platforms.current = firstLevel.platforms;
    fishes.current = firstLevel.fishes.map(f => ({ ...f, collected: false }));
    scratcher.current = firstLevel.scratcher;
    
    // Reset kitty position to level start
    kitty.current = {
      x: firstLevel.playerStart.x,
      y: firstLevel.playerStart.y,
      width: 40,
      height: 40,
      vx: 0,
      vy: 0,
      animationState: 'idle',
      animationFrame: 0,
      facingDirection: 'right'
    };
    
    toast({
      title: "🎮 Nível 1 iniciado!",
      description: "Colete peixes e leve-os ao arranhador 🪚",
    });
  };

  const resetGame = () => {
    setGameStarted(false);
    setGameStatus('playing');
    setScore(0);
    setFishCount(0);
    setTimeLeft(60);
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-background flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent animate-float">
            🐱 Theoness
          </h1>
          <p className="text-muted-foreground">Colete todos os peixinhos antes do tempo acabar!</p>
          {!user && (
            <p className="text-sm text-muted-foreground mt-2">
              ⚠️ Modo demo - progresso não será salvo
            </p>
          )}
        </div>

        <Button 
          onClick={startGame}
          className="bg-gradient-primary hover:opacity-90"
          size="lg"
        >
          🎮 Iniciar Jogo
        </Button>

        {onBackToProfile && (
          <Button 
            onClick={onBackToProfile}
            variant="outline"
          >
            Voltar ao Perfil
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
          🐱 Theoness
        </h1>
        <p className="text-muted-foreground">Colete todos os peixinhos antes do tempo acabar!</p>
      </div>

      <div className="game-ui-card p-4 rounded-2xl">
        <div className="flex gap-6 text-lg font-semibold flex-wrap justify-center items-center">
          <div className="flex items-center gap-2 text-primary">
            <span className="text-2xl">⭐</span>
            <span>{score}</span>
          </div>
          <div className="flex items-center gap-2 text-accent">
            <span className="text-xl">🎯</span>
            <span>Nível {currentLevel + 1}/{levels.current.length}</span>
          </div>
          <div className="flex items-center gap-2 text-accent">
            <span className="text-xl">🏆</span>
            <span>{fishCount}</span>
          </div>
          <div className="flex items-center gap-2 text-fish-orange">
            <span className="text-xl animate-float">🐟</span>
            <span>{carriedFish}</span>
          </div>
          <div className="flex items-center gap-2 text-destructive">
            <span className="text-xl">⏰</span>
            <span>{timeLeft}s</span>
          </div>
        </div>
      </div>

      <Card className="p-2 shadow-lg game-ui-card">
        <canvas 
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border-2 border-primary/30 rounded-lg shadow-inner"
          style={{ background: 'var(--gradient-sky)' }}
        />
      </Card>

      {gameStatus !== 'playing' && (
        <Card className="p-6 text-center">
          <div className="text-2xl font-bold mb-4">
            {gameStatus === 'won' ? '🎉 Parabéns!' : '⏰ Tempo Esgotado!'}
          </div>
          <div className="mb-4 text-muted-foreground">
            Score Final: {score} | Peixinhos: {fishCount}/5
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={resetGame}
              className="bg-gradient-primary hover:opacity-90"
            >
              Jogar Novamente
            </Button>
            {onBackToProfile && (
              <Button 
                onClick={onBackToProfile}
                variant="outline"
              >
                Perfil
              </Button>
            )}
          </div>
        </Card>
      )}

      {gameStarted && gameStatus === 'playing' && (
        <div className="text-center text-sm text-muted-foreground">
          <p>🎮 Use WASD ou setas para mover</p>
          <p>⬆️ Pule nas plataformas para alcançar os peixinhos!</p>
        </div>
      )}
    </div>
  );
};