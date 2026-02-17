import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ServiceTicket } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';

interface RecentTicketsProps {
  tickets: ServiceTicket[];
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-primary/15 text-primary border-primary/20',
  IN_PROGRESS: 'bg-chart-4/15 text-chart-4 border-chart-4/20',
  RESOLVED: 'bg-chart-3/15 text-chart-3 border-chart-3/20',
  CLOSED: 'bg-muted/50 text-muted-foreground border-muted',
};

export function RecentTickets({ tickets }: RecentTicketsProps) {
  return (
    <div className="glass-card rounded-2xl">
      <div className="p-6 pb-3">
        <h3 className="text-lg font-semibold">Recent Service Tickets</h3>
      </div>
      <div className="px-6 pb-6">
        {tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No service tickets yet
          </p>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div 
                key={ticket.id} 
                className="flex items-center justify-between p-3 rounded-xl bg-background/40 border border-border/30 transition-colors hover:bg-background/60"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{ticket.customer_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {ticket.battery_model} - {ticket.issue_description.substring(0, 40)}...
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 ml-4">
                  <Badge variant="outline" className={statusColors[ticket.status]}>
                    {ticket.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
