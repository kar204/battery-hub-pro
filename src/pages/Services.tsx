import { useEffect, useState } from 'react';
import { Plus, Search, Filter, Download, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { ServiceTicket, ServiceStatus, Profile, UserRole } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { PrintTicket } from '@/components/PrintTicket';
import { downloadCSV, formatTicketForExport } from '@/utils/exportUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [spBatteryAgents, setSpBatteryAgents] = useState<string[]>([]);
  const [spInvertorAgents, setSpInvertorAgents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<ServiceTicket | null>(null);
  
  // Battery resolution state
  const [ticketToResolveBattery, setTicketToResolveBattery] = useState<ServiceTicket | null>(null);
  const [batteryRechargeable, setBatteryRechargeable] = useState<'yes' | 'no' | ''>('');
  const [batteryPrice, setBatteryPrice] = useState('');
  
  // Invertor resolution state
  const [ticketToResolveInvertor, setTicketToResolveInvertor] = useState<ServiceTicket | null>(null);
  const [invertorResolved, setInvertorResolved] = useState<'yes' | 'no' | ''>('');
  const [invertorIssueDescription, setInvertorIssueDescription] = useState('');
  const [invertorPrice, setInvertorPrice] = useState('');
  
  // Close ticket state
  const [ticketToClose, setTicketToClose] = useState<ServiceTicket | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI' | ''>('');
  
  // Form state
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    battery_model: '',
    invertor_model: '',
    issue_description: '',
  });

  const [showNewTicketPrint, setShowNewTicketPrint] = useState<ServiceTicket | null>(null);
  const [showClosedPrint, setShowClosedPrint] = useState<ServiceTicket | null>(null);

  useEffect(() => {
    fetchTickets();
    fetchProfiles();
    fetchServiceAgents();

    const channel = supabase
      .channel('service-tickets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets' }, () => {
        fetchTickets();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const fetchServiceAgents = async () => {
    // Get SP Battery agents
    const { data: batteryData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'sp_battery');
    
    // Get SP Invertor agents
    const { data: invertorData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'sp_invertor');
    
    setSpBatteryAgents((batteryData || []).map((r: { user_id: string }) => r.user_id));
    setSpInvertorAgents((invertorData || []).map((r: { user_id: string }) => r.user_id));
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    try {
      const hasInvertor = !!formData.invertor_model;
      
      // Auto-assign to SP Battery (first available)
      const batteryAgentId = spBatteryAgents.length > 0 ? spBatteryAgents[0] : null;
      // Auto-assign to SP Invertor if invertor model is provided
      const invertorAgentId = hasInvertor && spInvertorAgents.length > 0 ? spInvertorAgents[0] : null;

      const { data, error } = await supabase.from('service_tickets').insert({
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        battery_model: formData.battery_model,
        invertor_model: formData.invertor_model || null,
        issue_description: formData.issue_description,
        created_by: user.id,
        assigned_to_battery: batteryAgentId,
        assigned_to_invertor: invertorAgentId,
        assigned_to: batteryAgentId, // Keep for backward compatibility
        status: batteryAgentId ? 'IN_PROGRESS' : 'OPEN',
        battery_resolved: false,
        invertor_resolved: hasInvertor ? false : null,
      }).select().single();

      if (error) throw error;

      toast({ title: 'Ticket created successfully' });
      setIsCreateOpen(false);
      setFormData({
        customer_name: '',
        customer_phone: '',
        battery_model: '',
        invertor_model: '',
        issue_description: '',
      });
      
      // Show print dialog for new ticket
      setShowNewTicketPrint(data as ServiceTicket);
      
      fetchTickets();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({ title: 'Error creating ticket', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleAssignBattery = async (ticketId: string, assigneeId: string) => {
    try {
      const { error } = await supabase
        .from('service_tickets')
        .update({ 
          assigned_to_battery: assigneeId, 
          assigned_to: assigneeId,
          status: 'IN_PROGRESS' 
        })
        .eq('id', ticketId);

      if (error) throw error;

      await supabase.from('service_logs').insert({
        ticket_id: ticketId,
        action: 'Battery assigned to SP',
        user_id: user?.id,
      });

      toast({ title: 'SP Battery assigned successfully' });
      setSelectedTicket(null);
      fetchTickets();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({ title: 'Error assigning', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleAssignInvertor = async (ticketId: string, assigneeId: string) => {
    try {
      const { error } = await supabase
        .from('service_tickets')
        .update({ assigned_to_invertor: assigneeId })
        .eq('id', ticketId);

      if (error) throw error;

      await supabase.from('service_logs').insert({
        ticket_id: ticketId,
        action: 'Invertor assigned to SP',
        user_id: user?.id,
      });

      toast({ title: 'SP Invertor assigned successfully' });
      setSelectedTicket(null);
      fetchTickets();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({ title: 'Error assigning', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return;
    
    try {
      const { error } = await supabase
        .from('service_tickets')
        .delete()
        .eq('id', ticketToDelete.id);

      if (error) throw error;

      toast({ title: 'Ticket deleted successfully' });
      setTicketToDelete(null);
      setSelectedTicket(null);
      fetchTickets();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({ title: 'Error deleting ticket', description: errorMessage, variant: 'destructive' });
    }
  };

  // Handle Battery Resolution
  const handleBatteryResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketToResolveBattery || !user || !batteryRechargeable) return;

    const priceNumber = Number(batteryPrice);
    if (Number.isNaN(priceNumber) || priceNumber < 0) {
      toast({ title: 'Enter a valid price', variant: 'destructive' });
      return;
    }

    try {
      const hasInvertor = !!ticketToResolveBattery.invertor_model;
      const invertorAlreadyResolved = ticketToResolveBattery.invertor_resolved === true;
      
      // Determine if ticket should be marked as RESOLVED
      const shouldResolve = !hasInvertor || invertorAlreadyResolved;

      const updateData: Partial<ServiceTicket> = {
        battery_rechargeable: batteryRechargeable === 'yes',
        battery_resolved: true,
        battery_price: priceNumber,
        battery_resolved_by: user.id,
        battery_resolved_at: new Date().toISOString(),
      };

      if (shouldResolve) {
        updateData.status = 'RESOLVED';
        // Calculate total price
        updateData.service_price = priceNumber + (ticketToResolveBattery.invertor_price || 0);
        updateData.resolution_notes = `Battery: ${batteryRechargeable === 'yes' ? 'Rechargeable' : 'Not rechargeable'}`;
      }

      const { error } = await supabase
        .from('service_tickets')
        .update(updateData)
        .eq('id', ticketToResolveBattery.id);

      if (error) throw error;

      await supabase.from('service_logs').insert({
        ticket_id: ticketToResolveBattery.id,
        action: `Battery resolved - Rechargeable: ${batteryRechargeable}, Price: ₹${priceNumber}`,
        user_id: user.id,
      });

      toast({ title: 'Battery resolution saved' });
      
      setTicketToResolveBattery(null);
      setBatteryRechargeable('');
      setBatteryPrice('');
      setSelectedTicket(null);
      fetchTickets();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({ title: 'Error saving resolution', description: errorMessage, variant: 'destructive' });
    }
  };

  // Handle Invertor Resolution
  const handleInvertorResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketToResolveInvertor || !user || !invertorResolved) return;

    const priceNumber = Number(invertorPrice);
    if (Number.isNaN(priceNumber) || priceNumber < 0) {
      toast({ title: 'Enter a valid price', variant: 'destructive' });
      return;
    }

    try {
      const batteryAlreadyResolved = ticketToResolveInvertor.battery_resolved === true;
      
      // Determine if ticket should be marked as RESOLVED
      const shouldResolve = batteryAlreadyResolved;

      const updateData: Partial<ServiceTicket> = {
        invertor_resolved: true,
        invertor_price: priceNumber,
        invertor_issue_description: invertorIssueDescription || null,
        invertor_resolved_by: user.id,
        invertor_resolved_at: new Date().toISOString(),
      };

      if (shouldResolve) {
        updateData.status = 'RESOLVED';
        // Calculate total price
        updateData.service_price = (ticketToResolveInvertor.battery_price || 0) + priceNumber;
        const batteryNotes = ticketToResolveInvertor.battery_rechargeable !== null 
          ? `Battery: ${ticketToResolveInvertor.battery_rechargeable ? 'Rechargeable' : 'Not rechargeable'}` 
          : '';
        updateData.resolution_notes = `${batteryNotes}${batteryNotes ? ' | ' : ''}Invertor: ${invertorResolved === 'yes' ? 'Resolved' : 'Not resolved'}${invertorIssueDescription ? ` - ${invertorIssueDescription}` : ''}`;
      }

      const { error } = await supabase
        .from('service_tickets')
        .update(updateData)
        .eq('id', ticketToResolveInvertor.id);

      if (error) throw error;

      await supabase.from('service_logs').insert({
        ticket_id: ticketToResolveInvertor.id,
        action: `Invertor resolved - Resolved: ${invertorResolved}, Price: ₹${priceNumber}`,
        notes: invertorIssueDescription || null,
        user_id: user.id,
      });

      toast({ title: 'Invertor resolution saved' });
      
      setTicketToResolveInvertor(null);
      setInvertorResolved('');
      setInvertorIssueDescription('');
      setInvertorPrice('');
      setSelectedTicket(null);
      fetchTickets();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({ title: 'Error saving resolution', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketToClose || !user || !paymentMethod) return;

    try {
      const { error } = await supabase
        .from('service_tickets')
        .update({
          status: 'CLOSED',
          payment_method: paymentMethod,
        })
        .eq('id', ticketToClose.id);

      if (error) throw error;

      await supabase.from('service_logs').insert({
        ticket_id: ticketToClose.id,
        action: `Ticket closed (payment: ${paymentMethod})`,
        user_id: user.id,
      });

      // Get updated ticket with payment info for print
      const { data: updatedTicket } = await supabase
        .from('service_tickets')
        .select('*')
        .eq('id', ticketToClose.id)
        .single();

      toast({ title: 'Ticket closed' });
      
      // Show print dialog with closed ticket
      setShowClosedPrint(updatedTicket as ServiceTicket);
      
      setTicketToClose(null);
      setPaymentMethod('');
      setSelectedTicket(null);
      fetchTickets();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({ title: 'Error closing ticket', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleExportSingle = (ticket: ServiceTicket) => {
    const data = [formatTicketForExport(ticket, getProfileName(ticket.assigned_to))];
    downloadCSV(data, `ticket-${ticket.ticket_number || ticket.id}`);
  };

  const handleExportAll = () => {
    const data = filteredTickets.map(ticket => 
      formatTicketForExport(ticket, getProfileName(ticket.assigned_to))
    );
    downloadCSV(data, `service-tickets-${new Date().toISOString().split('T')[0]}`);
  };

  const filteredTickets = tickets.filter(ticket =>
    ticket.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    ticket.battery_model.toLowerCase().includes(search.toLowerCase()) ||
    (ticket.ticket_number && ticket.ticket_number.toLowerCase().includes(search.toLowerCase()))
  );

  const getProfileName = (userId: string | null) => {
    if (!userId) return 'Unassigned';
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.name || 'Unknown';
  };

  // Filter profiles for assignment
  const spBatteryProfiles = profiles.filter(p => spBatteryAgents.includes(p.user_id));
  const spInvertorProfiles = profiles.filter(p => spInvertorAgents.includes(p.user_id));

  const canCreateTicket = hasAnyRole(['admin', 'counter_staff']);
  const canAssignTicket = hasAnyRole(['admin', 'counter_staff']);
  const canDeleteTicket = hasRole('admin');
  const isAdmin = hasRole('admin');
  const isSpBattery = hasRole('sp_battery');
  const isSpInvertor = hasRole('sp_invertor');
  const isCounterStaff = hasRole('counter_staff');
  const canCloseTicket = isCounterStaff || isAdmin;

  // Check if current user can resolve battery part
  const canResolveBattery = (ticket: ServiceTicket) => {
    if (isAdmin || isCounterStaff) return true;
    if (isSpBattery && ticket.assigned_to_battery === user?.id) return true;
    return false;
  };

  // Check if current user can resolve invertor part
  const canResolveInvertor = (ticket: ServiceTicket) => {
    if (!ticket.invertor_model) return false;
    if (isAdmin || isCounterStaff) return true;
    if (isSpInvertor && ticket.assigned_to_invertor === user?.id) return true;
    return false;
  };

  // Calculate total price for display
  const getTotalPrice = (ticket: ServiceTicket) => {
    return (ticket.battery_price || 0) + (ticket.invertor_price || 0);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Service Tickets</h1>
            <p className="text-muted-foreground">Manage customer service requests</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportAll} disabled={filteredTickets.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export All
            </Button>
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
                    <div className="grid grid-cols-2 gap-4">
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
                        <Label htmlFor="invertor_model">Invertor Model (Optional)</Label>
                        <Input
                          id="invertor_model"
                          value={formData.invertor_model}
                          onChange={(e) => setFormData({ ...formData, invertor_model: e.target.value })}
                          placeholder="Leave empty for battery-only"
                        />
                      </div>
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
                    <p className="text-sm text-muted-foreground">
                      {formData.invertor_model 
                        ? 'Ticket will be assigned to SP Battery and SP Invertor'
                        : 'Ticket will be assigned to SP Battery only'}
                    </p>
                    <Button type="submit" className="w-full">Create Ticket</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
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
                      <div className="flex items-center gap-3 flex-wrap">
                        {ticket.ticket_number && (
                          <Badge variant="outline" className="font-mono text-xs">
                            {ticket.ticket_number}
                          </Badge>
                        )}
                        <h3 className="font-semibold text-lg">{ticket.customer_name}</h3>
                        <Badge variant="outline" className={statusColors[ticket.status]}>
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{ticket.customer_phone}</p>
                      <p className="font-medium">
                        {ticket.battery_model}
                        {ticket.invertor_model && ` / ${ticket.invertor_model}`}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ticket.issue_description}
                      </p>
                      {/* Show resolution status */}
                      <div className="flex gap-2 flex-wrap">
                        {ticket.battery_resolved !== null && (
                          <Badge variant={ticket.battery_resolved ? "default" : "secondary"}>
                            Battery: {ticket.battery_resolved ? '✓ Resolved' : 'Pending'}
                          </Badge>
                        )}
                        {ticket.invertor_model && ticket.invertor_resolved !== null && (
                          <Badge variant={ticket.invertor_resolved ? "default" : "secondary"}>
                            Invertor: {ticket.invertor_resolved ? '✓ Resolved' : 'Pending'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </span>
                      <span className="text-muted-foreground">
                        Battery: {getProfileName(ticket.assigned_to_battery)}
                      </span>
                      {ticket.invertor_model && (
                        <span className="text-muted-foreground">
                          Invertor: {getProfileName(ticket.assigned_to_invertor)}
                        </span>
                      )}
                      {ticket.status === 'RESOLVED' && (
                        <span className="font-semibold text-chart-4">
                          Total: ₹{getTotalPrice(ticket).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Ticket Detail Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                Ticket Details
                {selectedTicket?.ticket_number && (
                  <Badge variant="outline" className="font-mono">
                    {selectedTicket.ticket_number}
                  </Badge>
                )}
              </DialogTitle>
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
                    <Label className="text-muted-foreground">Invertor Model</Label>
                    <p className="font-medium">{selectedTicket.invertor_model || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge variant="outline" className={statusColors[selectedTicket.status]}>
                      {selectedTicket.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">SP Battery</Label>
                    <p className="font-medium">{getProfileName(selectedTicket.assigned_to_battery)}</p>
                  </div>
                  {selectedTicket.invertor_model && (
                    <div>
                      <Label className="text-muted-foreground">SP Invertor</Label>
                      <p className="font-medium">{getProfileName(selectedTicket.assigned_to_invertor)}</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <Label className="text-muted-foreground">Issue Description</Label>
                  <p className="mt-1">{selectedTicket.issue_description}</p>
                </div>

                {/* Battery Resolution Details */}
                {selectedTicket.battery_resolved && (
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <h4 className="font-semibold">Battery Resolution</h4>
                    <p>Rechargeable: {selectedTicket.battery_rechargeable ? 'Yes' : 'No'}</p>
                    <p>Price: ₹{(selectedTicket.battery_price || 0).toFixed(2)}</p>
                  </div>
                )}

                {/* Invertor Resolution Details */}
                {selectedTicket.invertor_model && selectedTicket.invertor_resolved && (
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <h4 className="font-semibold">Invertor Resolution</h4>
                    {selectedTicket.invertor_issue_description && (
                      <p>Issue: {selectedTicket.invertor_issue_description}</p>
                    )}
                    <p>Price: ₹{(selectedTicket.invertor_price || 0).toFixed(2)}</p>
                  </div>
                )}

                {/* Total Price */}
                {(selectedTicket.battery_resolved || selectedTicket.invertor_resolved) && (
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="font-semibold text-lg">
                      Total Service Price: ₹{getTotalPrice(selectedTicket).toFixed(2)}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
                  <div className="flex gap-2 flex-wrap">
                    <PrintTicket 
                      ticket={selectedTicket} 
                      profileName={getProfileName(selectedTicket.assigned_to_battery)} 
                      invertorProfileName={getProfileName(selectedTicket.assigned_to_invertor)}
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleExportSingle(selectedTicket)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    {canDeleteTicket && (
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => setTicketToDelete(selectedTicket)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    {/* Assign SP Battery */}
                    {canAssignTicket && !selectedTicket.assigned_to_battery && selectedTicket.status === 'OPEN' && (
                      <Select onValueChange={(value) => handleAssignBattery(selectedTicket.id, value)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Assign SP Battery..." />
                        </SelectTrigger>
                        <SelectContent>
                          {spBatteryProfiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.user_id}>
                              {profile.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Assign SP Invertor */}
                    {canAssignTicket && selectedTicket.invertor_model && !selectedTicket.assigned_to_invertor && (
                      <Select onValueChange={(value) => handleAssignInvertor(selectedTicket.id, value)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Assign SP Invertor..." />
                        </SelectTrigger>
                        <SelectContent>
                          {spInvertorProfiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.user_id}>
                              {profile.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Resolve Battery */}
                    {canResolveBattery(selectedTicket) && 
                     selectedTicket.status === 'IN_PROGRESS' && 
                     !selectedTicket.battery_resolved && (
                      <Button 
                        variant="outline"
                        onClick={() => {
                          const ticket = selectedTicket;
                          setSelectedTicket(null);
                          // Small delay to allow first dialog to close and focus to reset
                          setTimeout(() => {
                            setTicketToResolveBattery(ticket);
                            setBatteryRechargeable('');
                            setBatteryPrice('');
                          }, 100);
                        }}
                      >
                        Resolve Battery
                      </Button>
                    )}

                    {/* Resolve Invertor */}
                    {canResolveInvertor(selectedTicket) && 
                     selectedTicket.status === 'IN_PROGRESS' && 
                     !selectedTicket.invertor_resolved && (
                      <Button 
                        variant="outline"
                        onClick={() => {
                          const ticket = selectedTicket;
                          setSelectedTicket(null);
                          // Small delay to allow first dialog to close and focus to reset
                          setTimeout(() => {
                            setTicketToResolveInvertor(ticket);
                            setInvertorResolved('');
                            setInvertorIssueDescription('');
                            setInvertorPrice('');
                          }, 100);
                        }}
                      >
                        Resolve Invertor
                      </Button>
                    )}

                    {/* Close Ticket */}
                    {canCloseTicket && selectedTicket.status === 'RESOLVED' && (
                      <Button 
                        onClick={() => {
                          setSelectedTicket(null);
                          setTicketToClose(selectedTicket);
                          setPaymentMethod('');
                        }}
                      >
                        Close Ticket
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Battery Resolution Dialog */}
        <Dialog open={!!ticketToResolveBattery} onOpenChange={() => setTicketToResolveBattery(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Battery Resolution</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleBatteryResolveSubmit} className="space-y-4">
              <div className="space-y-3">
                <Label>Battery Rechargeable?</Label>
                <RadioGroup 
                  value={batteryRechargeable} 
                  onValueChange={(val) => setBatteryRechargeable(val as 'yes' | 'no')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="rechargeable-yes" />
                    <Label htmlFor="rechargeable-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="rechargeable-no" />
                    <Label htmlFor="rechargeable-no">No</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="battery_price">Price (₹)</Label>
                <Input
                  id="battery_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={batteryPrice}
                  onChange={(e) => setBatteryPrice(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder={batteryRechargeable === 'no' ? 'Can be 0' : 'Enter price'}
                  autoComplete="off"
                  required
                />
                {batteryRechargeable === 'no' && (
                  <p className="text-sm text-muted-foreground">Price can be 0 if battery is not rechargeable</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTicketToResolveBattery(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!batteryRechargeable}>
                  Save Battery Resolution
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Invertor Resolution Dialog */}
        <Dialog open={!!ticketToResolveInvertor} onOpenChange={() => setTicketToResolveInvertor(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invertor Resolution</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvertorResolveSubmit} className="space-y-4">
              <div className="space-y-3">
                <Label>Resolved?</Label>
                <RadioGroup 
                  value={invertorResolved} 
                  onValueChange={(val) => setInvertorResolved(val as 'yes' | 'no')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="invertor-yes" />
                    <Label htmlFor="invertor-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="invertor-no" />
                    <Label htmlFor="invertor-no">No</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invertor_issue">Issue / Reason Description (Optional)</Label>
                <Textarea
                  id="invertor_issue"
                  value={invertorIssueDescription}
                  onChange={(e) => setInvertorIssueDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the issue or reason..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invertor_price">Price (₹)</Label>
                <Input
                  id="invertor_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={invertorPrice}
                  onChange={(e) => setInvertorPrice(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder={invertorResolved === 'no' ? 'Can be 0' : 'Enter price'}
                  autoComplete="off"
                  required
                />
                {invertorResolved === 'no' && (
                  <p className="text-sm text-muted-foreground">Price can be 0 if issue could not be resolved</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTicketToResolveInvertor(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!invertorResolved}>
                  Save Invertor Resolution
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Close Ticket Dialog */}
        <Dialog open={!!ticketToClose} onOpenChange={() => setTicketToClose(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Close Ticket</DialogTitle>
            </DialogHeader>
            {ticketToClose && (
              <form onSubmit={handleCloseSubmit} className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-lg font-semibold">Total Amount: ₹{getTotalPrice(ticketToClose).toFixed(2)}</p>
                  {ticketToClose.battery_price !== null && (
                    <p className="text-sm text-muted-foreground">Battery: ₹{ticketToClose.battery_price.toFixed(2)}</p>
                  )}
                  {ticketToClose.invertor_price !== null && (
                    <p className="text-sm text-muted-foreground">Invertor: ₹{ticketToClose.invertor_price.toFixed(2)}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(value) =>
                      setPaymentMethod(value as 'CASH' | 'CARD' | 'UPI')
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="CARD">Card</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <PrintTicket 
                    ticket={ticketToClose} 
                    profileName={getProfileName(ticketToClose.assigned_to_battery)} 
                    invertorProfileName={getProfileName(ticketToClose.assigned_to_invertor)}
                  />
                  <Button type="button" variant="outline" onClick={() => setTicketToClose(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!paymentMethod}>
                    Confirm & Close
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!ticketToDelete} onOpenChange={() => setTicketToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Ticket?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete ticket {ticketToDelete?.ticket_number} for {ticketToDelete?.customer_name}. 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTicket} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>

        {/* Print After Close Dialog */}
        <Dialog open={!!showClosedPrint} onOpenChange={() => setShowClosedPrint(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ticket Closed Successfully</DialogTitle>
            </DialogHeader>
            {showClosedPrint && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Ticket <strong>{showClosedPrint.ticket_number}</strong> has been closed with payment received. 
                  Would you like to print the final ticket?
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowClosedPrint(null)}>
                    Close
                  </Button>
                  <PrintTicket 
                    ticket={showClosedPrint} 
                    profileName={getProfileName(showClosedPrint.assigned_to_battery)} 
                    invertorProfileName={getProfileName(showClosedPrint.assigned_to_invertor)}
                  />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Print After Create Dialog */}
        <Dialog open={!!showNewTicketPrint} onOpenChange={() => setShowNewTicketPrint(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ticket Created Successfully</DialogTitle>
            </DialogHeader>
            {showNewTicketPrint && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Ticket <strong>{showNewTicketPrint.ticket_number}</strong> has been created. 
                  Would you like to print the ticket?
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNewTicketPrint(null)}>
                    Close
                  </Button>
                  <PrintTicket 
                    ticket={showNewTicketPrint} 
                    profileName={getProfileName(showNewTicketPrint.assigned_to_battery)} 
                    invertorProfileName={getProfileName(showNewTicketPrint.assigned_to_invertor)}
                  />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}