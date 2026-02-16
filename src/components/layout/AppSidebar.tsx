import { 
  LayoutDashboard, 
  Wrench, 
  Package, 
  ClipboardList, 
  Users,
  LogOut,
  Store,
  Recycle
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const menuItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['admin', 'counter_staff', 'service_agent', 'warehouse_staff', 'procurement_staff'] },
  { title: 'Service Tickets', icon: Wrench, path: '/services', roles: ['admin', 'counter_staff', 'service_agent', 'sp_battery', 'sp_invertor'] },
  { title: 'Inventory', icon: Package, path: '/inventory', roles: ['admin', 'warehouse_staff', 'procurement_staff'] },
  { title: 'Shop', icon: Store, path: '/shop', roles: ['admin', 'counter_staff', 'warehouse_staff', 'seller'] },
  { title: 'Scrap', icon: Recycle, path: '/scrap', roles: ['admin', 'counter_staff', 'scrap_manager'] },
  { title: 'Transactions', icon: ClipboardList, path: '/transactions', roles: ['admin', 'warehouse_staff', 'procurement_staff'] },
  { title: 'Users', icon: Users, path: '/users', roles: ['admin'] },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, roles, signOut, hasAnyRole } = useAuth();

  const filteredMenuItems = menuItems.filter(item => 
    hasAnyRole(item.roles as any[])
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm overflow-hidden">
            <img
              src="/afsal-logo.png"
              alt="Afsal Traders logo"
              className="h-12 w-12 object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sidebar-foreground">BatteryPro</span>
            <span className="text-xs text-sidebar-foreground/60">Management System</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    className="cursor-pointer"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent">
              <span className="text-sm font-medium text-sidebar-accent-foreground">
                {profile?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.name || 'User'}
              </span>
              <span className="text-xs text-sidebar-foreground/60 truncate">
                {roles.length > 0 ? roles[0].replace('_', ' ') : 'No role'}
              </span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSignOut}
            className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
