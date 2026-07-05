import { Settings } from 'lucide-react';
import { EmailStatus } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function GearButton({ onClick }: { onClick: () => void }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClick}
            aria-label="Request changes"
          >
            <Settings className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Request changes</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StatusBadge({ status }: { status: EmailStatus }) {
  const config = {
    handled: { variant: 'secondary' as const, label: 'Handled', className: 'bg-green-500/10 text-green-700' },
    pending: { variant: 'secondary' as const, label: 'Pending', className: 'bg-yellow-500/10 text-yellow-700' },
    escalated: { variant: 'destructive' as const, label: 'Escalated', className: '' },
  };
  const c = config[status];
  return (
    <Badge variant={c.variant} className={cn(c.className)}>
      {c.label}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge variant="outline" className="capitalize text-primary">
      {category}
    </Badge>
  );
}
