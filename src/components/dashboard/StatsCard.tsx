import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

const variantStyles = {
  default: 'bg-card',
  primary: 'bg-primary/10 border-primary/20',
  secondary: 'bg-secondary/50 border-secondary',
  warning: 'bg-destructive/10 border-destructive/20',
  success: 'bg-chart-4/20 border-chart-4/30',
};

const iconVariantStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  warning: 'bg-destructive text-destructive-foreground',
  success: 'bg-chart-4 text-foreground',
};

export function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  variant = 'default' 
}: StatsCardProps) {
  return (
    <Card className={cn('transition-all hover:shadow-md', variantStyles[variant])}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight truncate" title={String(value)}>{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className={cn(
            'flex h-12 w-12 items-center justify-center rounded-lg',
            iconVariantStyles[variant]
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
