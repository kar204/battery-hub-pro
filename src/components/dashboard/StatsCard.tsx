import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'primary' | 'secondary' | 'warning' | 'success';
}

const iconVariantStyles = {
  default: 'bg-muted/50 text-muted-foreground',
  primary: 'bg-primary/15 text-primary',
  secondary: 'bg-secondary/15 text-secondary',
  warning: 'bg-destructive/15 text-destructive',
  success: 'bg-chart-3/20 text-chart-3',
};

export function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  variant = 'default' 
}: StatsCardProps) {
  return (
    <div className="glass-card rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight" title={String(value)}>{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl',
          iconVariantStyles[variant]
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
