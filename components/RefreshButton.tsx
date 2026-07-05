'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RefreshButtonProps {
  onRefresh: () => void;
  intervalMs?: number;
}

export default function RefreshButton({ onRefresh, intervalMs = 30000 }: RefreshButtonProps) {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (intervalMs <= 0) return;
    const interval = setInterval(() => {
      onRefresh();
      setLastRefresh(new Date());
    }, intervalMs);
    return () => clearInterval(interval);
  }, [onRefresh, intervalMs]);

  const handleClick = () => {
    setSpinning(true);
    onRefresh();
    setLastRefresh(new Date());
    setTimeout(() => setSpinning(false), 1500);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      title="Refresh data"
      className="shrink-0 whitespace-nowrap"
    >
      <RefreshCw className={cn('size-3.5', spinning && 'animate-spin text-primary')} />
      <span className="hidden sm:inline">
        {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </Button>
  );
}
