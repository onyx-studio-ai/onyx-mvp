'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Tag, RefreshCw, Pencil, Trash2, X, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Promo {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  value: number;
  usage_count: number;
  max_uses: number | null;
  status: 'active' | 'expired';
  expires_at: string | null;
  created_at: string;
}

const EMPTY_FORM = {
  code: '',
  discount_type: 'percentage' as 'percentage' | 'fixed',
  value: '',
  max_uses: '',
  expires_at: '',
  status: 'active' as 'active' | 'expired',
};

export default function AdminPromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [deletePromo, setDeletePromo] = useState<Promo | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchPromos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('promos')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setPromos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  const openCreate = () => {
    setEditingPromo(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (promo: Promo) => {
    setEditingPromo(promo);
    setForm({
      code: promo.code,
      discount_type: promo.discount_type,
      value: String(promo.value),
      max_uses: promo.max_uses != null ? String(promo.max_uses) : '',
      expires_at: promo.expires_at ? promo.expires_at.split('T')[0] : '',
      status: promo.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.value) return;

    const parsedValue = parseFloat(form.value);
    if (isNaN(parsedValue) || parsedValue < 0) {
      showToast('Discount value must be a positive number');
      return;
    }
    if (form.discount_type === 'percentage' && parsedValue > 100) {
      showToast('Percentage discount cannot exceed 100%');
      return;
    }
    if (form.max_uses) {
      const parsedMax = parseInt(form.max_uses);
      if (isNaN(parsedMax) || parsedMax < 1) {
        showToast('Max uses must be a positive integer');
        return;
      }
    }

    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      value: parsedValue,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      status: form.status,
    };

    if (editingPromo) {
      const { error } = await supabase.from('promos').update(payload).eq('id', editingPromo.id);
      if (error) { showToast('Error updating promo'); }
      else { showToast('Promo updated'); setDialogOpen(false); fetchPromos(); }
    } else {
      const { error } = await supabase.from('promos').insert({ ...payload, usage_count: 0 });
      if (error) { showToast('Error creating promo'); }
      else { showToast('Promo created'); setDialogOpen(false); fetchPromos(); }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletePromo) return;
    const { error } = await supabase.from('promos').delete().eq('id', deletePromo.id);
    if (error) {
      showToast('Error deleting promo: ' + error.message);
    } else {
      showToast('Promo deleted');
    }
    setDeletePromo(null);
    fetchPromos();
  };

  const filteredPromos = promos.filter((p) => {
    const matchesSearch =
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const totalPromos = promos.length;
  const activePromos = promos.filter((p) => p.status === 'active').length;
  const totalUsage = promos.reduce((sum, p) => sum + p.usage_count, 0);

  const formatExpiry = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="p-8 min-h-screen text-white">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-zinc-800 border border-zinc-700 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-2">
          <Check size={16} className="text-green-400" />
          {toast}
        </div>
      )}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Promo Code Management</h1>
          <p className="text-gray-400">Create and manage discount codes</p>
        </div>
        <Button
          variant="outline"
          onClick={fetchPromos}
          disabled={loading}
          className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-gray-200"
        >
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Promos</p>
          <p className="text-2xl font-bold mt-1">{totalPromos}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Active Promos</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{activePromos}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Redemptions</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{totalUsage}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Avg. Uses per Code</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">
            {totalPromos > 0 ? Math.round(totalUsage / totalPromos) : 0}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            placeholder="Search by promo code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'expired'] as const).map((f) => (
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
        <Button
          className="gap-2 bg-blue-600 hover:bg-blue-500"
          onClick={openCreate}
        >
          <Plus size={16} />
          Create Promo
        </Button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading promos...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-950 border-b border-zinc-800">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Code</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Type</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Value</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Used</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Max Uses</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Expires</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredPromos.map((promo) => (
                  <tr key={promo.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Tag size={15} className="text-gray-400" />
                        <span className="font-bold tracking-wide text-white">{promo.code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={promo.discount_type === 'percentage' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}>
                        {promo.discount_type === 'percentage' ? 'Percentage' : 'Fixed'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-lg font-bold text-green-400">
                        {promo.discount_type === 'percentage' ? `${promo.value}%` : `US$${promo.value}`}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold">{promo.usage_count}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-400">{promo.max_uses ?? '∞'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={promo.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}>
                        {promo.status === 'active' ? 'Active' : 'Expired'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-400">{formatExpiry(promo.expires_at)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-gray-200"
                          onClick={() => openEdit(promo)}
                        >
                          <Pencil size={13} className="mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400"
                          onClick={() => setDeletePromo(promo)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPromos.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                {promos.length === 0 ? 'No promo codes yet. Create one above.' : 'No promos match your filter.'}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPromo ? 'Edit Promo Code' : 'Create Promo Code'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Code *</label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. WELCOME20"
                className="bg-black border-zinc-700 text-white uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Type</label>
                <select
                  value={form.discount_type}
                  onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })}
                  className="w-full bg-black border border-zinc-700 rounded-md px-3 py-2 text-white text-sm"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Value *</label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder={form.discount_type === 'percentage' ? '10' : '100'}
                  className="bg-black border-zinc-700 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Max Uses (optional)</label>
                <Input
                  type="number"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  placeholder="Unlimited"
                  className="bg-black border-zinc-700 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Expires (optional)</label>
                <Input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                  className="bg-black border-zinc-700 text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'expired' })}
                className="w-full bg-black border border-zinc-700 rounded-md px-3 py-2 text-white text-sm"
              >
                <option value="active">Active</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-gray-200"
                onClick={() => setDialogOpen(false)}
              >
                <X size={16} className="mr-2" />
                Cancel
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-500"
                onClick={handleSave}
                disabled={saving || !form.code || !form.value}
              >
                {saving ? 'Saving...' : editingPromo ? 'Save Changes' : 'Create Promo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePromo} onOpenChange={() => setDeletePromo(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promo Code</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Delete <span className="font-bold text-white">{deletePromo?.code}</span>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-gray-200">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
