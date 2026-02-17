import { useEffect, useState } from 'react';
import { Wrench, Package, CheckCircle, AlertTriangle, TrendingUp, Download, Activity } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RecentTickets } from '@/components/dashboard/RecentTickets';
import { LowStockAlert } from '@/components/dashboard/LowStockAlert';
import { supabase } from '@/integrations/supabase/client';
import { ServiceTicket, WarehouseStock, Product } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { downloadCSV, formatDashboardStatsForExport } from '@/utils/exportUtils';

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    openTickets: 0,
    closedToday: 0,
    totalStock: 0,
    lowStockCount: 0,
    inProgressTickets: 0,
  });
  const [recentTickets, setRecentTickets] = useState<ServiceTicket[]>([]);
  const [lowStockItems, setLowStockItems] = useState<WarehouseStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    
    const ticketChannel = supabase
      .channel('dashboard-tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    const stockChannel = supabase
      .channel('dashboard-stock')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_stock' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      ticketChannel.unsubscribe();
      stockChannel.unsubscribe();
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: tickets } = await supabase
        .from('service_tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: openTickets } = await supabase
        .from('service_tickets')
        .select('id', { count: 'exact' })
        .eq('status', 'OPEN');

      const { data: inProgressTickets } = await supabase
        .from('service_tickets')
        .select('id', { count: 'exact' })
        .eq('status', 'IN_PROGRESS');

      const { data: closedToday } = await supabase
        .from('service_tickets')
        .select('id', { count: 'exact' })
        .eq('status', 'CLOSED')
        .gte('updated_at', today.toISOString());

      const { data: stockData } = await supabase
        .from('warehouse_stock')
        .select('*, product:products(*)');

      const lowStock = (stockData || []).filter((s: WarehouseStock & { product: Product }) => s.quantity < 5);
      const totalStock = (stockData || []).reduce((acc: number, s: WarehouseStock & { product: Product }) => acc + s.quantity, 0);

      setStats({
        openTickets: openTickets?.length || 0,
        closedToday: closedToday?.length || 0,
        totalStock,
        lowStockCount: lowStock.length,
        inProgressTickets: inProgressTickets?.length || 0,
      });

      setRecentTickets((tickets as ServiceTicket[]) || []);
      setLowStockItems(lowStock as WarehouseStock[]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 animate-spin" />
            Loading dashboard...
          </div>
        </div>
      </AppLayout>
    );
  }

  const handleExportDashboard = () => {
    const data = formatDashboardStatsForExport(stats, new Date());
    downloadCSV(data, `dashboard-report-${new Date().toISOString().split('T')[0]}`);
  };

  const totalActiveTickets = stats.openTickets + stats.inProgressTickets;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, {profile?.name || 'User'} 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your business today.
            </p>
          </div>
          <Button variant="outline" onClick={handleExportDashboard} className="rounded-xl glass">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>

        {/* Overview banner */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-1">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Today's Overview</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
            <div>
              <p className="text-2xl font-bold text-primary">{totalActiveTickets}</p>
              <p className="text-xs text-muted-foreground">Active Tickets</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-chart-3">{stats.closedToday}</p>
              <p className="text-xs text-muted-foreground">Resolved Today</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalStock}</p>
              <p className="text-xs text-muted-foreground">Stock Units</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${stats.lowStockCount > 0 ? 'text-destructive' : 'text-chart-3'}`}>{stats.lowStockCount}</p>
              <p className="text-xs text-muted-foreground">Low Stock Items</p>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatsCard
            title="Open Tickets"
            value={stats.openTickets}
            icon={Wrench}
            variant="primary"
            description="Waiting for assignment"
          />
          <StatsCard
            title="In Progress"
            value={stats.inProgressTickets}
            icon={TrendingUp}
            variant="secondary"
            description="Being worked on"
          />
          <StatsCard
            title="Closed Today"
            value={stats.closedToday}
            icon={CheckCircle}
            variant="success"
            description="Resolved & closed"
          />
          <StatsCard
            title="Total Stock"
            value={stats.totalStock}
            icon={Package}
            variant="default"
            description="Units in warehouse"
          />
          <StatsCard
            title="Low Stock"
            value={stats.lowStockCount}
            icon={AlertTriangle}
            variant={stats.lowStockCount > 0 ? 'warning' : 'default'}
            description="Items below threshold"
          />
        </div>

        {/* Detail panels */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentTickets tickets={recentTickets} />
          <LowStockAlert items={lowStockItems} />
        </div>
      </div>
    </AppLayout>
  );
}
