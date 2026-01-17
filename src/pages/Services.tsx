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
  const [serviceAgents, setServiceAgents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<ServiceTicket | null>(null);
  const [ticketToResolve, setTicketToResolve] = useState<ServiceTicket | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolvePrice, setResolvePrice] = useState('');
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
    // Get user_ids of service_agents
    const { data } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'service_agent');
    
    setServiceAgents((data || []).map((r: any) => r.user_id));
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    try {
      // Find a service agent to auto-assign
      const serviceAgentId = serviceAgents.length > 0 ? serviceAgents[0] : null;

      const { error } = await supabase.from('service_tickets').insert({
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        battery_model: formData.battery_model,
        invertor_model: formData.invertor_model || null,
        issue_description: formData.issue_description,
        created_by: user.id,
        assigned_to: serviceAgentId,
        status: serviceAgentId ? 'IN_PROGRESS' : 'OPEN',
      });

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
    } catch (error: any) {
      toast({ title: 'Error deleting ticket', description: error.message, variant: 'destructive' });
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

  // Filter profiles to only show service agents for assignment
  const serviceAgentProfiles = profiles.filter(p => serviceAgents.includes(p.user_id));

  const canCreateTicket = hasAnyRole(['admin', 'counter_staff']);
  const canAssignTicket = hasAnyRole(['admin', 'counter_staff']);
  const canUpdateStatus = hasAnyRole(['admin', 'service_agent', 'counter_staff']);
  const canDeleteTicket = hasRole('admin');
  const isAdmin = hasRole('admin');
  const isServiceAgent = hasRole('service_agent');
  const isCounterStaff = hasRole('counter_staff');
  const canMarkResolved = canUpdateStatus && (isServiceAgent || isAdmin);
  const canCloseTicket = canUpdateStatus && (isCounterStaff || isAdmin);

  const [showResolvedPrint, setShowResolvedPrint] = useState<ServiceTicket | null>(null);

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketToResolve || !user) return;

    const priceNumber = Number(resolvePrice);
    if (Number.isNaN(priceNumber) || priceNumber < 0) {
      toast({ title: 'Enter a valid price', variant: 'destructive' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('service_tickets')
        .update({
          status: 'RESOLVED',
          resolution_notes: resolveNotes || null,
          service_price: priceNumber,
        })
        .eq('id', ticketToResolve.id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('service_logs').insert({
        ticket_id: ticketToResolve.id,
        action: 'Ticket resolved',
        notes: resolveNotes || null,
        user_id: user.id,
      });

      toast({ title: 'Ticket marked as resolved' });
      
      // Show print dialog with updated ticket
      setShowResolvedPrint(data as ServiceTicket);
      
      setTicketToResolve(null);
      setResolveNotes('');
      setResolvePrice('');
      setSelectedTicket(null);
      fetchTickets();
    } catch (error: any) {
      toast({ title: 'Error resolving ticket', description: error.message, variant: 'destructive' });
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

      toast({ title: 'Ticket closed' });
      setTicketToClose(null);
      setPaymentMethod('');
      setSelectedTicket(null);
      fetchTickets();
    } catch (error: any) {
      toast({ title: 'Error closing ticket', description: error.message, variant: 'destructive' });
    }
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
                        <Label htmlFor="invertor_model">Invertor Model</Label>
                        <Input
                          id="invertor_model"
                          value={formData.invertor_model}
                          onChange={(e) => setFormData({ ...formData, invertor_model: e.target.value })}
                          placeholder="Optional"
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
                      Ticket will be auto-assigned to a Service Agent
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
                      <div className="flex items-center gap-3">
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
                    <Label className="text-muted-foreground">Assigned To</Label>
                    <p className="font-medium">{getProfileName(selectedTicket.assigned_to)}</p>
                  </div>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">Issue Description</Label>
                  <p className="mt-1">{selectedTicket.issue_description}</p>
                </div>

                {(selectedTicket.resolution_notes ||
                  typeof selectedTicket.service_price === 'number') && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Resolution Details</Label>
                    {selectedTicket.resolution_notes && (
                      <p className="mt-1">{selectedTicket.resolution_notes}</p>
                    )}
                    {typeof selectedTicket.service_price === 'number' && (
                      <p className="mt-1 font-medium">
                        Service Price: ₹{selectedTicket.service_price.toFixed(2)}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
                  <div className="flex gap-2">
                    <PrintTicket 
                      ticket={selectedTicket} 
                      profileName={getProfileName(selectedTicket.assigned_to)} 
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
                    {canAssignTicket && selectedTicket.status === 'OPEN' && (
                      <Select onValueChange={(value) => handleAssignTicket(selectedTicket.id, value)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Assign to agent..." />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceAgentProfiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.user_id}>
                              {profile.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {canMarkResolved && selectedTicket.status === 'IN_PROGRESS' && (
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setSelectedTicket(null);
                          setTicketToResolve(selectedTicket);
                          setResolveNotes(selectedTicket.resolution_notes || '');
                          setResolvePrice(
                            selectedTicket.service_price !== null
                              ? String(selectedTicket.service_price)
                              : ''
                          );
                        }}
                      >
                        Mark Resolved
                      </Button>
                    )}

                    {canCloseTicket && selectedTicket.status === 'RESOLVED' && (
                      <Button 
                        onClick={() => {
                          setSelectedTicket(null);
                          setTicketToClose(selectedTicket);
                          setPaymentMethod(
                            (selectedTicket.payment_method as 'CASH' | 'CARD' | 'UPI' | null) || ''
                          );
                        }}
                      >
                        Close Ticket
                      </Button>
                    )}

                    {canUpdateStatus && !canMarkResolved && selectedTicket.status === 'IN_PROGRESS' && (
                      <>
                        <Button 
                          variant="outline"
                          onClick={() => handleUpdateStatus(selectedTicket.id, 'RESOLVED')}
                        >
                          Mark Resolved
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Resolve Ticket Dialog */}
        <Dialog open={!!ticketToResolve} onOpenChange={() => setTicketToResolve(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark Ticket as Resolved</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resolution_notes">Issue Brief / Resolution</Label>
                <Textarea
                  id="resolution_notes"
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  required
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service_price">Service Price</Label>
                <Input
                  id="service_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={resolvePrice}
                  onChange={(e) => setResolvePrice(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTicketToResolve(null)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save & Mark Resolved
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
            <form onSubmit={handleCloseSubmit} className="space-y-4">
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
                <Button type="button" variant="outline" onClick={() => setTicketToClose(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!paymentMethod}>
                  Confirm & Close
                </Button>
              </div>
            </form>
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

        {/* Print After Resolve Dialog */}
        <Dialog open={!!showResolvedPrint} onOpenChange={() => setShowResolvedPrint(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ticket Resolved Successfully</DialogTitle>
            </DialogHeader>
            {showResolvedPrint && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Ticket <strong>{showResolvedPrint.ticket_number}</strong> has been marked as resolved. 
                  Would you like to print the updated ticket with resolution details?
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowResolvedPrint(null)}>
                    Close
                  </Button>
                  <PrintTicket 
                    ticket={showResolvedPrint} 
                    profileName={getProfileName(showResolvedPrint.assigned_to)} 
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
