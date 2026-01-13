import { useEffect, useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { ServiceTicket, ServiceStatus, Profile } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

const statusColors: Record<string, string> = {
  OPEN: 'bg-chart-1/20 text-chart-1 border-chart-1/30',
  IN_PROGRESS: 'bg-secondary/20 text-secondary-foreground border-secondary/30',
  RESOLVED: 'bg-chart-4/20 text-chart-4 border-chart-4/30',
  CLOSED: 'bg-muted text-muted-foreground border-muted',
};

export default function Services() {
  const { user, hasRole, hasAnyRole } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    battery_model: '',
    issue_description: '',
  });

  useEffect(() => {
    fetchTickets();
    fetchProfiles();

    const channel = supabase
      .channel('service-tickets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets' }, () => {
        fetchTickets();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [statusFilter]);

  const fetchTickets = async () => {
    try {
      let query = supabase
        .from('service_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as ServiceStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTickets((data as ServiceTicket[]) || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*');
    setProfiles((data as Profile[]) || []);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    try {
      const { error } = await supabase.from('service_tickets').insert({
        ...formData,
        created_by: user.id,
        status: 'OPEN',
      });

      if (error) throw error;

      // Log the action
      toast({ title: 'Ticket created successfully' });
      setIsCreateOpen(false);
      setFormData({
        customer_name: '',
        customer_phone: '',
        battery_model: '',
        issue_description: '',
      });
      fetchTickets();
    } catch (error: any) {
      toast({ title: 'Error creating ticket', description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: ServiceStatus) => {
    try {
      const { error } = await supabase
        .from('service_tickets')
        .update({ status: newStatus })
        .eq('id', ticketId);

      if (error) throw error;

      // Log the action
      await supabase.from('service_logs').insert({
        ticket_id: ticketId,
        action: `Status changed to ${newStatus}`,
        user_id: user?.id,
      });

      toast({ title: `Ticket ${newStatus.toLowerCase().replace('_', ' ')}` });
      setSelectedTicket(null);
      fetchTickets();
    } catch (error: any) {
      toast({ title: 'Error updating ticket', description: error.message, variant: 'destructive' });
    }
  };

  const handleAssignTicket = async (ticketId: string, assigneeId: string) => {
    try {
      const { error } = await supabase
        .from('service_tickets')
        .update({ assigned_to: assigneeId, status: 'IN_PROGRESS' })
        .eq('id', ticketId);

      if (error) throw error;

      await supabase.from('service_logs').insert({
        ticket_id: ticketId,
        action: 'Ticket assigned',
        user_id: user?.id,
      });

      toast({ title: 'Ticket assigned successfully' });
      setSelectedTicket(null);
      fetchTickets();
    } catch (error: any) {
      toast({ title: 'Error assigning ticket', description: error.message, variant: 'destructive' });
    }
  };

  const filteredTickets = tickets.filter(ticket =>
    ticket.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    ticket.battery_model.toLowerCase().includes(search.toLowerCase())
  );

  const getProfileName = (userId: string | null) => {
    if (!userId) return 'Unassigned';
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.name || 'Unknown';
  };

  const canCreateTicket = hasAnyRole(['admin', 'counter_staff']);
  const canAssignTicket = hasAnyRole(['admin', 'counter_staff']);
  const canUpdateStatus = hasAnyRole(['admin', 'service_agent', 'counter_staff']);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Service Tickets</h1>
            <p className="text-muted-foreground">Manage customer service requests</p>
          </div>
          {canCreateTicket && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Ticket
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Service Ticket</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateTicket} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer_name">Customer Name</Label>
                      <Input
                        id="customer_name"
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer_phone">Phone Number</Label>
                      <Input
                        id="customer_phone"
                        value={formData.customer_phone}
                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="battery_model">Battery Model</Label>
                    <Input
                      id="battery_model"
                      value={formData.battery_model}
                      onChange={(e) => setFormData({ ...formData, battery_model: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issue_description">Issue Description</Label>
                    <Textarea
                      id="issue_description"
                      value={formData.issue_description}
                      onChange={(e) => setFormData({ ...formData, issue_description: e.target.value })}
                      required
                      rows={4}
                    />
                  </div>
                  <Button type="submit" className="w-full">Create Ticket</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-muted-foreground">Loading tickets...</div>
          </div>
        ) : filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No tickets found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredTickets.map((ticket) => (
              <Card 
                key={ticket.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedTicket(ticket)}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{ticket.customer_name}</h3>
                        <Badge variant="outline" className={statusColors[ticket.status]}>
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{ticket.customer_phone}</p>
                      <p className="font-medium">{ticket.battery_model}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ticket.issue_description}
                      </p>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </span>
                      <span className="text-muted-foreground">
                        Assigned to: {getProfileName(ticket.assigned_to)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Ticket Detail Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ticket Details</DialogTitle>
            </DialogHeader>
            {selectedTicket && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Customer</Label>
                    <p className="font-medium">{selectedTicket.customer_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{selectedTicket.customer_phone}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Battery Model</Label>
                    <p className="font-medium">{selectedTicket.battery_model}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge variant="outline" className={statusColors[selectedTicket.status]}>
                      {selectedTicket.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">Issue Description</Label>
                  <p className="mt-1">{selectedTicket.issue_description}</p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                  {canAssignTicket && selectedTicket.status === 'OPEN' && (
                    <Select onValueChange={(value) => handleAssignTicket(selectedTicket.id, value)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Assign to..." />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((profile) => (
                          <SelectItem key={profile.id} value={profile.user_id}>
                            {profile.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {canUpdateStatus && (
                    <div className="flex gap-2 flex-wrap">
                      {selectedTicket.status === 'IN_PROGRESS' && (
                        <Button 
                          variant="outline"
                          onClick={() => handleUpdateStatus(selectedTicket.id, 'RESOLVED')}
                        >
                          Mark Resolved
                        </Button>
                      )}
                      {selectedTicket.status === 'RESOLVED' && (
                        <Button 
                          onClick={() => handleUpdateStatus(selectedTicket.id, 'CLOSED')}
                        >
                          Close Ticket
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
