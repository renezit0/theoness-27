import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MultiplayerChat } from './MultiplayerChat';
import { RankingBoard } from './RankingBoard';

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

interface MobileChatOverlayProps {
  roomId: string;
  user: any;
  players: Player[];
  isOpen: boolean;
  onClose: () => void;
}

export const MobileChatOverlay = ({ roomId, user, players, isOpen, onClose }: MobileChatOverlayProps) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'ranking'>('chat');

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md h-[70vh] flex flex-col">
        {/* Header */}
        <div className="p-3 border-b flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'chat' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('chat')}
            >
              💬 Chat
            </Button>
            <Button
              variant={activeTab === 'ranking' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('ranking')}
            >
              🏆 Ranking
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            ✕
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' ? (
            <MultiplayerChat roomId={roomId} user={user} players={players} />
          ) : (
            <div className="p-4">
              <RankingBoard roomId={roomId} players={players} />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};