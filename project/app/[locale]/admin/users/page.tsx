'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Search, Shield, Ban, RefreshCw, ShoppingCart, Mail, Trash2, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  voice_order_count: number;
  voice_spend: number;
  music_order_count: number;
  music_spend: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'banned'>('all');
  const [actionUser, setActionUser] = useState<UserRow | null>(null);
  const [actionType, setActionType] = useState<'ban' | 'unban' | 'delete' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [emailDialogUser, setEmailDialogUser] = useState<UserRow | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin.rpc('get_admin_users');
      if (error) throw error;
      setUsers(data || []);
    } catch {
      const { data: voiceOrders } = await supabaseAdmin
        .from('voice_orders')
        .select('email, price, payment_status, created_at');
      const { data: musicOrders } = await supabaseAdmin
        .from('music_orders')
        .select('email, price, payment_status, created_at');

      const emailMap: Record<string, UserRow> = {};

      (voiceOrders || []).forEach((o) => {
        if (!emailMap[o.email]) {
          emailMap[o.email] = {
            id: o.email,
            email: o.email,
            created_at: o.created_at,
            last_sign_in_at: null,
            banned_until: null,
            voice_order_count: 0,
            voice_spend: 0,
            music_order_count: 0,
            music_spend: 0,
          };
        }
        emailMap[o.email].voice_order_count++;
        if (o.payment_status === 'completed') {
          emailMap[o.email].voice_spend += parseFloat(o.price || '0');
        }
      });

      (musicOrders || []).forEach((o) => {
        if (!emailMap[o.email]) {
          emailMap[o.email] = {
            id: o.email,
            email: o.email,
            created_at: o.created_at,
            last_sign_in_at: null,
            banned_until: null,
            voice_order_count: 0,
            voice_spend: 0,
            music_order_count: 0,
            music_spend: 0,
          };
        }
        emailMap[o.email].music_order_count++;
        if (o.payment_status === 'completed') {
          emailMap[o.email].music_spend += parseFloat(o.price || '0');
        }
      });

      setUsers(Object.values(emailMap));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const isBanned = (user: UserRow) => {
    if (!user.banned_until) return false;
    return new Date(user.banned_until) > new Date();
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase());
    const banned = isBanned(user);
    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'banned' && banned) ||
      (filterStatus === 'active' && !banned);
    return matchesSearch && matchesFilter;
  });

  const handleAction = async () => {
    if (!actionUser || !actionType) return;
    setActionLoading(true);
    try {
      if (actionType === 'delete') {
        const res = await fetch('/api/admin/users/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: actionUser.email }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || 'Failed to delete user');
        }
      } else {
        const res = await fetch('/api/admin/users/ban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: actionUser.email, action: actionType }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || 'Failed to update user');
        }
      }
    } catch {
      alert('Failed to perform action');
    } finally {
      setActionLoading(false);
      setActionUser(null);
      setActionType(null);
      fetchUsers();
    }
  };

  const handleSendEmail = async () => {
    if (!emailDialogUser || !emailSubject.trim()) return;
    setSendingEmail(true);
    try {
      const res = await fetch('/api/admin/users/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailDialogUser.email,
          subject: emailSubject,
          body: emailBody,
        }),
      });
      if (res.ok) {
        alert('Email sent successfully');
        setEmailDialogUser(null);
        setEmailSubject('');
        setEmailBody('');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send email');
      }
    } catch {
      alert('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => !isBanned(u)).length;
  const bannedUsers = users.filter((u) => isBanned(u)).length;
  const totalRevenue = users.reduce(
    (sum, u) => sum + u.voice_spend + u.music_spend,
    0
  );

  const formatCurrency = (val: number) => {
    if (val >= 1000) return `US$${(val / 1000).toFixed(1)}K`;
    return `US$${val.toFixed(0)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="p-8 min-h-screen text-white">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">User Management</h1>
          <p className="text-gray-400">Real customer accounts from your database</p>
        </div>
        <Button
          variant="outline"
          onClick={fetchUsers}
          disabled={loading}
          className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-gray-200"
        >
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Users</p>
          <p className="text-2xl font-bold mt-1">{totalUsers}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Active Users</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{activeUsers}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Banned Users</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{bannedUsers}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Revenue</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            placeholder="Search by email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'banned'] as const).map((f) => (
            <Button
              key={f}
              variant={filterStatus === f ? 'default' : 'outline'}
              onClick={() => setFilterStatus(f)}
              className="bg-zinc-800 hover:bg-zinc-700 text-gray-200 capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-950 border-b border-zinc-800">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Email</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Voice Orders</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Music Orders</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Total Spend</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Last Active</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredUsers.map((user) => {
                  const banned = isBanned(user);
                  const totalSpend = user.voice_spend + user.music_spend;
                  return (
                    <tr key={user.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-white">{user.email}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-300">{user.voice_order_count}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-300">{user.music_order_count}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-green-400">{formatCurrency(totalSpend)}</span>
                      </td>
                      <td className="px-6 py-4">
                        {banned ? (
                          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20">
                            Banned
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-400">{formatDate(user.last_sign_in_at)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 border-zinc-600 text-gray-200 hover:bg-zinc-700 hover:text-white"
                            onClick={() => router.push(`/admin/orders?search=${encodeURIComponent(user.email)}`)}
                          >
                            <ShoppingCart size={14} className="mr-1" />
                            Orders
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 border-zinc-600 text-gray-200 hover:bg-zinc-700 hover:text-white"
                            onClick={() => {
                              setEmailDialogUser(user);
                              setEmailSubject('');
                              setEmailBody('');
                            }}
                          >
                            <Mail size={14} className="mr-1" />
                            Email
                          </Button>
                          {banned ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-400"
                              onClick={() => {
                                setActionUser(user);
                                setActionType('unban');
                              }}
                            >
                              <Shield size={14} className="mr-1" />
                              Unban
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400"
                              onClick={() => {
                                setActionUser(user);
                                setActionType('ban');
                              }}
                            >
                              <Ban size={14} className="mr-1" />
                              Ban
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400"
                            onClick={() => {
                              setActionUser(user);
                              setActionType('delete');
                            }}
                          >
                            <Trash2 size={14} className="mr-1" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-gray-400">No users found.</div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={!!actionUser} onOpenChange={() => setActionUser(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'delete' ? 'Delete User' : actionType === 'ban' ? 'Ban User' : 'Unban User'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {actionType === 'delete'
                ? `Permanently delete ${actionUser?.email}? This action cannot be undone.`
                : actionType === 'ban'
                ? `Ban ${actionUser?.email}? They will lose access to all services.`
                : `Restore access for ${actionUser?.email}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 hover:bg-zinc-700 border-zinc-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={actionLoading}
              className={actionType === 'delete' || actionType === 'ban' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
            >
              {actionLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Email Dialog */}
      <AlertDialog open={!!emailDialogUser} onOpenChange={() => setEmailDialogUser(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail size={18} /> Send Email to {emailDialogUser?.email}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white"
            />
            <textarea
              placeholder="Message body..."
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={5}
              className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 hover:bg-zinc-700 border-zinc-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSendEmail}
              disabled={sendingEmail || !emailSubject.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sendingEmail ? 'Sending...' : <><Send size={14} className="mr-1" /> Send</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
