import { useEffect, useState } from 'react';
import { Search, Shield, UserCog } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Profile, UserRole, AppRole } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const allRoles: { value: AppRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Full system access' },
  { value: 'counter_staff', label: 'Counter Staff (SD)', description: 'Create and manage service tickets' },
  { value: 'sp_battery', label: 'SP Battery', description: 'Handle battery service requests' },
  { value: 'sp_invertor', label: 'SP Invertor', description: 'Handle invertor service requests' },
  { value: 'service_agent', label: 'Service Agent (Legacy)', description: 'Work on assigned tickets' },
  { value: 'warehouse_staff', label: 'Warehouse Staff', description: 'Manage inventory stock' },
  { value: 'procurement_staff', label: 'Procurement Staff', description: 'Add products and manage procurement' },
];

const roleColors: Record<AppRole, string> = {
  admin: 'bg-primary/20 text-primary border-primary/30',
  counter_staff: 'bg-secondary/20 text-secondary-foreground border-secondary/30',
  sp_battery: 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  sp_invertor: 'bg-chart-3/20 text-chart-3 border-chart-3/30',
  service_agent: 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  warehouse_staff: 'bg-chart-1/20 text-chart-1 border-chart-1/30',
  procurement_staff: 'bg-chart-4/20 text-chart-4 border-chart-4/30',
};

export default function Users() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('user_roles').select('*'),
      ]);

      setProfiles((profilesRes.data as Profile[]) || []);
      setUserRoles((rolesRes.data as UserRole[]) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserRoles = (userId: string): AppRole[] => {
    return userRoles.filter(ur => ur.user_id === userId).map(ur => ur.role);
  };

  const openEditRoles = (profile: Profile) => {
    setSelectedUser(profile);
    setSelectedRoles(getUserRoles(profile.user_id));
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;

    try {
      // Delete existing roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedUser.user_id);

      // Insert new roles
      if (selectedRoles.length > 0) {
        const { error } = await supabase
          .from('user_roles')
          .insert(selectedRoles.map(role => ({
            user_id: selectedUser.user_id,
            role,
          })));

        if (error) throw error;
      }

      toast({ title: 'Roles updated successfully' });
      setSelectedUser(null);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error updating roles', description: error.message, variant: 'destructive' });
    }
  };

  const toggleRole = (role: AppRole) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.name.toLowerCase().includes(search.toLowerCase()) ||
    profile.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage user roles and permissions</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-muted-foreground">Loading users...</div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                All Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProfiles.map((profile) => {
                      const roles = getUserRoles(profile.user_id);
                      return (
                        <TableRow key={profile.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                                <span className="text-sm font-medium">
                                  {profile.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-medium">{profile.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{profile.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {roles.length === 0 ? (
                                <Badge variant="outline" className="text-muted-foreground">
                                  No roles assigned
                                </Badge>
                              ) : (
                                roles.map(role => (
                                  <Badge key={role} variant="outline" className={roleColors[role]}>
                                    {role.replace('_', ' ')}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(profile.created_at), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditRoles(profile)}
                              disabled={profile.user_id === user?.id}
                            >
                              <UserCog className="h-4 w-4 mr-1" />
                              Edit Roles
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Edit Roles Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User Roles</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
                    <span className="font-medium">
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{selectedUser.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {allRoles.map(role => (
                    <div 
                      key={role.value}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={role.value}
                        checked={selectedRoles.includes(role.value)}
                        onCheckedChange={() => toggleRole(role.value)}
                      />
                      <div className="flex-1">
                        <Label htmlFor={role.value} className="font-medium cursor-pointer">
                          {role.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button onClick={handleSaveRoles} className="w-full">
                  Save Changes
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
