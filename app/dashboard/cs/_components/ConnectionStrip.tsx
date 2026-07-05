import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ConnectionStripProps = {
  googleConnected: boolean;
  metaConnected: boolean;
  twilioConnected: boolean;
  className?: string;
};

export function ConnectionStrip({
  googleConnected,
  metaConnected,
  twilioConnected,
  className,
}: ConnectionStripProps) {
  const chips = [
    { label: 'Gmail', connected: googleConnected },
    { label: 'Meta', connected: metaConnected },
    { label: 'Phone', connected: twilioConnected },
  ];

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {chips.map((chip) => (
        <Badge
          key={chip.label}
          variant="outline"
          className={cn(
            'gap-1.5 px-2.5 py-1 font-medium',
            chip.connected
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-border bg-muted/40 text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              chip.connected ? 'bg-green-500' : 'bg-muted-foreground/50',
            )}
          />
          {chip.label}
        </Badge>
      ))}
      <Link
        href="/dashboard/settings?tab=integrations"
        className="text-xs font-medium text-primary hover:underline"
      >
        Manage connections
      </Link>
    </div>
  );
}
