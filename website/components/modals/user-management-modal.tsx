'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Trash2,
  Mail,
  Loader2,
  Clock,
  Plus,
  Search,
  Shield,
  AlertTriangle
} from "lucide-react";
// Removed Firebase imports - using mock data instead
import { ALLOWED_USERS } from '@/config/allowed-users';

interface User {
  email: string;
  isAdmin: boolean;
  lastLogin?: string | null;
  createdAt?: string;
  updatedAt?: string;
  status?: 'active' | 'inactive';
  testsRun?: number;
}

interface UserManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserManagementModal({ open, onOpenChange }: UserManagementModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [systemStats, setSystemStats] = useState({
    activeUsers: 0,
    testsRunToday: 0,
    totalTests: 0
  });

  // Fetch users and their stats
  useEffect(() => {
    const fetchUsersAndStats = async () => {
      if (!open) return;

      try {
        setLoading(true);
        const usersCollection = collection(db, 'users');
        const snapshot = await getDocs(usersCollection);

        if (snapshot.empty) {
          // Initialize with ALLOWED_USERS if empty
          const initialUsers = ALLOWED_USERS.map(user => ({
            ...user,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: 'active',
            testsRun: 0
          }));

          await Promise.all(
              initialUsers.map(user =>
                  setDoc(doc(db, 'users', user.email), user)
              )
          );
          setUsers(initialUsers);
        } else {
          const fetchedUsers = snapshot.docs.map(doc => ({
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate().toISOString(),
            updatedAt: doc.data().updatedAt?.toDate().toISOString()
          } as User));
          setUsers(fetchedUsers);
        }

        // Fetch system stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const testsCollection = collection(db, 'tests');
        const todayTests = await getDocs(
            query(testsCollection,
                where('createdAt', '>=', today),
                orderBy('createdAt', 'desc')
            )
        );

        const allTests = await getDocs(testsCollection);

        // Calculate active users - a user is considered active when their status is 'active'
        const activeUserCount = users.filter(u => u.status === 'active').length;

        setSystemStats({
          activeUsers: activeUserCount,
          testsRunToday: todayTests.size,
          totalTests: allTests.size
        });

      } catch (error) {
        console.error('Error fetching data:', error);
        setUsers(ALLOWED_USERS);
        toast.error('Error loading users, using local data');
      } finally {
        setLoading(false);
      }
    };

    fetchUsersAndStats();
  }, [open, users.length]);

  const handleAddUser = async () => {
    if (!newEmail) {
      toast.error('Please enter an email address');
      return;
    }

    if (!newEmail.endsWith('@umich.edu')) {
      toast.error('Only @umich.edu email addresses are allowed');
      return;
    }

    setIsAdding(true);
    try {
      const userRef = doc(db, 'users', newEmail);
      const newUser = {
        email: newEmail,
        isAdmin: newIsAdmin,
        lastLogin: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'active',
        testsRun: 0
      };

      await setDoc(userRef, newUser);
      setUsers(prev => [...prev, { ...newUser, createdAt: new Date().toISOString() }]);
      setNewEmail('');
      setNewIsAdmin(false);
      toast.success('User added successfully');
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error('Failed to add user');
    } finally {
      setIsAdding(false);
    }
  };

  const confirmDeleteUser = (email: string) => {
    setUserToDelete(email);
    setShowDeleteConfirm(true);
  };

  const handleRemoveUser = async () => {
    if (!userToDelete) return;

    try {
      await deleteDoc(doc(db, 'users', userToDelete));
      setUsers(users.filter(user => user.email !== userToDelete));
      toast.success('User removed successfully');
    } catch (error) {
      console.error('Error removing user:', error);
      toast.error('Failed to remove user');
    } finally {
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };

  const cancelDeleteUser = () => {
    setUserToDelete(null);
    setShowDeleteConfirm(false);
  };

  const handleToggleAdmin = async (email: string, currentIsAdmin: boolean) => {
    try {
      const userRef = doc(db, 'users', email);
      await updateDoc(userRef, {
        isAdmin: !currentIsAdmin,
        updatedAt: serverTimestamp()
      });

      setUsers(users.map(user =>
          user.email === email ? { ...user, isAdmin: !currentIsAdmin } : user
      ));
      toast.success('User permissions updated');
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user permissions');
    }
  };

  const handleToggleStatus = async (email: string, currentStatus: string) => {
    try {
      const userRef = doc(db, 'users', email);
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

      await updateDoc(userRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      setUsers(users.map(user =>
          user.email === email ? { ...user, status: newStatus as 'active' | 'inactive' } : user
      ));
      toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Failed to update user status');
    }
  };

  const filteredUsers = users.filter(user =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatLastLogin = (lastLogin: string | null | undefined) => {
    if (!lastLogin) return 'Never';

    const date = new Date(lastLogin);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-4">
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Site Settings
              </DialogTitle>
            </DialogHeader>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Active Users</div>
                <div className="text-2xl font-semibold">{systemStats.activeUsers}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Tests Today</div>
                <div className="text-2xl font-semibold">{systemStats.testsRunToday}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Total Tests</div>
                <div className="text-2xl font-semibold">{systemStats.totalTests}</div>
              </div>
            </div>

            {/* User Management Section */}
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              {/* Add User Controls */}
              <div className="flex gap-2 items-center">
                <Input
                    placeholder="user@umich.edu"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="flex-1"
                    style={{
                      outline: 'none',
                      boxShadow: 'none',
                      border: '1px solid #e2e8f0'
                    }}
                />
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Switch
                      checked={newIsAdmin}
                      onCheckedChange={setNewIsAdmin}
                  />
                  <span className="text-sm">Admin</span>
                </div>
                <Button
                    onClick={handleAddUser}
                    disabled={isAdding}
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                >
                  {isAdding ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                      <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add User
                </Button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    style={{
                      outline: 'none',
                      boxShadow: 'none',
                      border: '1px solid #e2e8f0'
                    }}
                />
              </div>

              {/* Users Table */}
              <div className="border rounded-lg overflow-hidden flex-1">
                <div className="overflow-auto max-h-[40vh]">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0" style={{ zIndex: 10 }}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tests</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Login</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y bg-background">
                    {loading ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                            <p className="text-muted-foreground mt-2">Loading users...</p>
                          </td>
                        </tr>
                    ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <p className="text-muted-foreground">No users found</p>
                          </td>
                        </tr>
                    ) : (
                        filteredUsers.map((user) => (
                            <tr key={user.email} className="hover:bg-muted/50">
                              <td className="px-4 py-2">
                                <div className="flex items-center">
                                  <Mail className="h-4 w-4 text-muted-foreground mr-2" />
                                  <span className="font-medium text-sm">{user.email}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2" style={{ zIndex: 1 }}>
                                  <Switch
                                      checked={user.isAdmin}
                                      onCheckedChange={() => handleToggleAdmin(user.email, user.isAdmin)}
                                  />
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                {user.isAdmin ? 'Admin' : 'User'}
                              </span>
                                </div>
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {user.testsRun || 0}
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {formatLastLogin(user.lastLogin)}
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleStatus(user.email, user.status || 'active')}
                                    className={`rounded-full px-2 py-0 h-auto text-xs ${
                                        (user.status || 'active') === 'active'
                                            ? 'bg-muted text-foreground'
                                            : 'bg-muted/50 text-muted-foreground'
                                    }`}
                                >
                                  {user.status || 'active'}
                                </Button>
                              </td>
                              <td className="px-4 py-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => confirmDeleteUser(user.email)}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 pt-4 border-t">
              <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full"
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Separate Alert Dialog for confirmation that will appear on top */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span>Remove user?</span>
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {userToDelete}?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelDeleteUser}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                  onClick={handleRemoveUser}
                  className="bg-red-600 hover:bg-red-700 text-white"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
  );
}