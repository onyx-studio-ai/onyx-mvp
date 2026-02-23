'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Award, Search, Download, ExternalLink, RefreshCw,
  FileText, Calendar, Mail, Loader2
} from 'lucide-react';

interface Certificate {
  id: string;
  license_id: string;
  order_id: string;
  order_type: string;
  order_number: string;
  client_email: string;
  client_name: string;
  project_name: string;
  product_category: string;
  asset_type: string;
  rights_level: string;
  voice_id_ref: string;
  talent_name: string;
  pdf_url: string;
  issued_at: string;
  created_at: string;
}

const RIGHTS_COLORS: Record<string, string> = {
  standard: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  broadcast: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  global: 'bg-green-500/20 text-green-300 border-green-500/30',
};

const RIGHTS_LABELS: Record<string, string> = {
  standard: 'Standard',
  broadcast: 'Broadcast',
  global: 'Global',
};

export default function AdminCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/certificates');
      const data = await res.json();
      if (res.ok) {
        setCertificates(data.data || []);
      } else {
        toast.error('Failed to load certificates');
      }
    } catch {
      toast.error('Failed to load certificates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCertificates(); }, []);

  const filtered = certificates.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.license_id.toLowerCase().includes(q) ||
      c.order_number.toLowerCase().includes(q) ||
      c.client_email.toLowerCase().includes(q) ||
      c.client_name.toLowerCase().includes(q) ||
      c.product_category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 lg:p-8 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Award className="w-6 h-6 text-green-400" />
            License Certificates
          </h1>
          <p className="text-gray-400 text-sm mt-1">{certificates.length} certificates issued</p>
        </div>
        <button
          onClick={fetchCertificates}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-lg transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by License ID, Order #, Email..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-zinc-600"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400">No certificates found</p>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-gray-400 text-xs font-medium uppercase tracking-wider px-5 py-3">License ID</th>
                  <th className="text-left text-gray-400 text-xs font-medium uppercase tracking-wider px-5 py-3">Order</th>
                  <th className="text-left text-gray-400 text-xs font-medium uppercase tracking-wider px-5 py-3">Client</th>
                  <th className="text-left text-gray-400 text-xs font-medium uppercase tracking-wider px-5 py-3">Product</th>
                  <th className="text-left text-gray-400 text-xs font-medium uppercase tracking-wider px-5 py-3">Rights</th>
                  <th className="text-left text-gray-400 text-xs font-medium uppercase tracking-wider px-5 py-3">Issued</th>
                  <th className="text-left text-gray-400 text-xs font-medium uppercase tracking-wider px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(cert => (
                  <tr key={cert.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-green-400 font-mono text-sm font-medium">#{cert.license_id}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-white text-sm">#{cert.order_number}</span>
                      <span className="text-gray-400 text-xs block capitalize">{cert.order_type}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-white text-sm">{cert.client_name || cert.client_email}</span>
                      {cert.client_name && (
                        <span className="text-gray-400 text-xs block">{cert.client_email}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-gray-300 text-sm">{cert.product_category}</span>
                      <span className="text-gray-500 text-xs block">{cert.asset_type}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${RIGHTS_COLORS[cert.rights_level] || RIGHTS_COLORS.standard}`}>
                        {RIGHTS_LABELS[cert.rights_level] || cert.rights_level}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-gray-400 text-sm">
                        {new Date(cert.issued_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        {cert.pdf_url && (
                          <a
                            href={cert.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <a
                          href={`/verify/${cert.license_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                          title="View Public Page"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
