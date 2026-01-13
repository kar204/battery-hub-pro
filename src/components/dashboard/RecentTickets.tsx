import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ServiceTicket } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';

interface RecentTicketsProps {
  tickets: ServiceTicket[];
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-chart-1/20 text-chart-1 border-chart-1/30',
  IN_PROGRESS: 'bg-secondary/20 text-secondary-foreground border-secondary/30',
  RESOLVED: 'bg-chart-4/20 text-chart-4 border-chart-4/30',
  CLOSED: 'bg-muted text-muted-foreground border-muted',
};

export function RecentTickets({ tickets }: RecentTicketsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Service Tickets</CardTitle>
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No service tickets yet
          </p>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <div 
                key={ticket.id} 
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50"
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
      </CardContent>
    </Card>
  );
}
