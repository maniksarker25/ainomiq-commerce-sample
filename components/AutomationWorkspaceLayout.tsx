'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type AutomationNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  active?: boolean;
  disabled?: boolean;
  group?: 'primary' | 'settings';
  onClick?: () => void;
};

type Props = {
  items: AutomationNavItem[];
  children: ReactNode;
  contentClassName?: string;
  variant?: 'default' | 'shadcn';
};

export default function AutomationWorkspaceLayout({
  items,
  children,
  contentClassName = '',
  variant = 'default',
}: Props) {
  const primaryItems = items.filter(item => item.group !== 'settings');
  const settingsItems = items.filter(item => item.group === 'settings');
  const isShadcn = variant === 'shadcn';

  const renderItem = (item: AutomationNavItem) => {
    const Icon = item.icon;
    if (isShadcn) {
      return (
        <Button
          key={item.id}
          type="button"
          variant={item.active ? 'default' : 'ghost'}
          disabled={item.disabled}
          onClick={item.onClick}
          className={cn(
            'h-auto w-full justify-start gap-3 px-3 py-2.5 text-left font-semibold',
            item.active && 'shadow-sm',
          )}
        >
          <Icon size={18} strokeWidth={1.8} />
          <span className="min-w-0 flex-1 text-sm">{item.label}</span>
          {item.badge ? (
            <Badge
              variant={item.active ? 'secondary' : 'default'}
              className="h-5 min-w-5 shrink-0 px-1.5 text-[11px]"
            >
              {item.badge}
            </Badge>
          ) : null}
        </Button>
      );
    }
    return (
      <button
        key={item.id}
        type="button"
        disabled={item.disabled}
        onClick={item.onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          item.active
            ? 'bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.18)]'
            : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Icon size={18} strokeWidth={1.8} />
        <span className="min-w-0 flex-1 font-semibold text-sm">{item.label}</span>
        {item.badge ? (
          <span className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${item.active ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>{item.badge}</span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)] 2xl:gap-6 2xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside
        className={cn(
          'h-fit min-w-0 p-3 xl:sticky xl:top-6 xl:self-start',
          isShadcn
            ? 'rounded-xl bg-card ring-1 ring-foreground/10'
            : 'glass rounded-xl border border-gray-200',
        )}
      >
        <nav className="space-y-1">
          {primaryItems.map(renderItem)}
        </nav>
        {settingsItems.length > 0 && (
          <nav className={cn('mt-3 space-y-1 border-t pt-3', isShadcn ? 'border-border' : 'border-gray-100')}>
            {settingsItems.map(renderItem)}
          </nav>
        )}
      </aside>

      <section
        className={cn(
          'min-h-[560px] min-w-0 overflow-hidden p-4 md:p-5 2xl:p-6',
          isShadcn
            ? 'rounded-xl bg-card ring-1 ring-foreground/10'
            : 'glass rounded-xl border border-gray-200',
          contentClassName,
        )}
      >
        {children}
      </section>
    </div>
  );
}
