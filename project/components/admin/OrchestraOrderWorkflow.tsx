'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Upload, Play, CheckCircle2, Loader2, Send, FileAudio,
  Calendar, Download, MessageSquare, Clock, ArrowRight, X
} from 'lucide-react';

interface OrchestraOrder {
  id: string;
  order_number: string;
  email: string;
  project_name: string;
  tier_name: string;
  duration_minutes: number;
  price: number;
  genre: string;
  description: string;
  reference_url: string;
  usage_type: string;
  midi_file_url: string | null;
  score_file_url: string | null;
  delivery_file_url: string | null;
  delivery_stems: string[] | null;
  status: string;
  payment_status: string;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
  auto_complete_at: string | null;
  notes: string | null;
  created_at: string;
}

interface Message {
  id: string;
  order_id: string;
  sender_role: 'admin' | 'client';
  message: string;
  created_at: string;
}

interface OrchestraOrderWorkflowProps {
  order: OrchestraOrder;
  onRefresh: () => void;
}

const STATUS_FLOW = [
  { key: 'paid', label: 'Paid' },
  { key: 'awaiting_files', label: 'Awaiting Files' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'in_production', label: 'In Production' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'completed', label: 'Completed' },
];

function sanitizePath(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._\-/]/g, '_');
}

interface DeliveryFileItem {
  name: string;
  url: string;
  created_at: string;
  size: number;
}

export default function OrchestraOrderWorkflow({ order, onRefresh }: OrchestraOrderWorkflowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [estimatedDate, setEstimatedDate] = useState(order.estimated_delivery_date || '');
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deliveryFiles, setDeliveryFiles] = useState<DeliveryFileItem[]>([]);
  const deliveryInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const stepIndex = STATUS_FLOW.findIndex(s => s.key === order.status);

  const fetchMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/orders/orchestra/messages?order_id=${order.id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    } finally {
      setLoadingMessages(false);
    }
  }, [order.id]);

  const fetchDeliveryFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/orchestra/delivery-files?orderId=${order.id}`);
      if (res.ok) {
        const data = await res.json();
        setDeliveryFiles(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    }
  }, [order.id]);

  useEffect(() => {
    fetchMessages();
    fetchDeliveryFiles();
  }, [fetchMessages, fetchDeliveryFiles]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSendMessage() {
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const res = await fetch('/api/orders/orchestra/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          sender_role: 'admin',
          message: newMessage.trim(),
        }),
      });
      if (res.ok) {
        setNewMessage('');
        fetchMessages();
      }
    } catch {
      // silent
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleStatusChange(newStatus: string, extra?: Record<string, unknown>) {
    setUpdating(true);
    try {
      const res = await fetch('/api/orders/orchestra', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status: newStatus, ...extra }),
      });
      if (res.ok) {
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        alert('Failed to update status: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Failed to update status: ' + (err instanceof Error ? err.message : 'Network error'));
    } finally {
      setUpdating(false);
    }
  }

  async function handleStartProduction() {
    if (!estimatedDate) return;
    await handleStatusChange('in_production', {
      estimated_delivery_date: estimatedDate,
    });
    try {
      await fetch('/api/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: 'strings',
          type: 'production_started',
          email: order.email,
          orderNumber: order.order_number,
          orderId: order.id,
          category: 'PRODUCTION',
          estimatedDate: new Date(estimatedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        }),
      });
    } catch {
      // silent
    }
  }

  async function handleDeliveryUpload() {
    if (!deliveryFile) return;
    setUploading(true);
    setUploadProgress(20);
    try {
      const formData = new FormData();
      formData.append('file', deliveryFile);
      formData.append('orderId', order.id);

      setUploadProgress(50);

      const res = await fetch('/api/orders/orchestra/deliver', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(90);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      setUploadProgress(100);
      setDeliveryFile(null);
      onRefresh();
      fetchDeliveryFiles();
    } catch (err) {
      console.error('Delivery upload error:', err);
    } finally {
      setUploading(false);
    }
  }

  async function handleForceComplete() {
    await handleStatusChange('completed');
  }

  return (
    <div className="space-y-5">
      {/* Progress Bar */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3 font-medium">Workflow Progress</p>
        <div className="flex items-center gap-0">
          {STATUS_FLOW.map((step, i) => {
            const done = i <= stepIndex;
            const current = i === stepIndex;
            return (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${done ? 'bg-amber-500 text-black' : 'bg-white/[0.05] text-gray-600 border border-white/[0.08]'} ${current ? 'ring-2 ring-amber-400/40' : ''}`}>
                    {done && i < stepIndex ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
                  </div>
                  <p className={`text-[9px] mt-1.5 font-medium text-center w-16 leading-tight ${done ? 'text-amber-400' : 'text-gray-600'}`}>
                    {step.label}
                  </p>
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <div className={`flex-1 h-px mx-0.5 mb-5 ${i < stepIndex ? 'bg-amber-500/40' : 'bg-white/[0.06]'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Client Files */}
      {(order.midi_file_url || order.score_file_url) && (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3 font-medium">Client Uploaded Files</p>
          <div className="flex flex-wrap gap-2">
            {order.midi_file_url && (
              <a href={order.midi_file_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm hover:bg-amber-500/20 transition-colors">
                <FileAudio className="w-3.5 h-3.5" /> MIDI / Audio
              </a>
            )}
            {order.score_file_url && (
              <a href={order.score_file_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm hover:bg-blue-500/20 transition-colors">
                <FileAudio className="w-3.5 h-3.5" /> Score / Sheet
              </a>
            )}
          </div>
        </div>
      )}

      {/* Messages Thread */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Messages</p>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-2 mb-3">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-4">No messages yet</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`px-3 py-2 rounded-lg text-sm ${
                  msg.sender_role === 'admin'
                    ? 'bg-amber-500/10 border border-amber-500/20 ml-4'
                    : 'bg-white/[0.04] border border-white/[0.08] mr-4'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    msg.sender_role === 'admin' ? 'text-amber-400' : 'text-gray-400'
                  }`}>
                    {msg.sender_role === 'admin' ? 'Admin' : 'Client'}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {new Date(msg.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">{msg.message}</p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {order.status !== 'completed' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Type a message to the client..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-amber-500/40"
            />
            <Button
              size="sm"
              onClick={handleSendMessage}
              disabled={sendingMessage || !newMessage.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {sendingMessage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        )}
      </div>

      {/* Status Actions */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3 font-medium">Actions</p>

        <div className="space-y-3">
          {order.status === 'paid' && (
            <Button
              size="sm"
              onClick={() => handleStatusChange('awaiting_files')}
              disabled={updating}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2 w-full justify-center"
            >
              {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              Request Files from Client
            </Button>
          )}

          {order.status === 'awaiting_files' && (
            <Button
              size="sm"
              onClick={() => handleStatusChange('under_review')}
              disabled={updating}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 w-full justify-center"
            >
              {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              Move to Under Review
            </Button>
          )}

          {order.status === 'under_review' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Estimated Delivery Date</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={estimatedDate}
                    onChange={(e) => setEstimatedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-amber-500/40"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleStartProduction}
                disabled={updating || !estimatedDate}
                className="bg-orange-600 hover:bg-orange-700 text-white gap-2 w-full justify-center"
              >
                {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Confirm & Start Production
              </Button>
            </div>
          )}

          {order.status === 'in_production' && (
            <div className="space-y-3">
              {order.estimated_delivery_date && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-sm text-amber-300">
                    Est. Delivery: {new Date(order.estimated_delivery_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Upload Delivery Package</label>
                <input
                  ref={deliveryInputRef}
                  type="file"
                  accept=".zip,.rar,.7z,.tar,.gz,.wav,.mp3,.flac,.aif,.aiff"
                  onChange={(e) => setDeliveryFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deliveryInputRef.current?.click()}
                    className="bg-zinc-700 hover:bg-zinc-600 text-white border-0 flex-1"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {deliveryFile ? deliveryFile.name : 'Select File'}
                  </Button>
                  {deliveryFile && (
                    <Button size="sm" onClick={() => setDeliveryFile(null)} variant="ghost" className="text-gray-400">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {uploading && (
                <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-full bg-green-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}

              <Button
                size="sm"
                onClick={handleDeliveryUpload}
                disabled={uploading || !deliveryFile}
                className="bg-green-600 hover:bg-green-700 text-white gap-2 w-full justify-center"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Upload & Deliver to Client
              </Button>
            </div>
          )}

          {order.status === 'delivered' && (
            <div className="space-y-3">
              {deliveryFiles.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-medium">
                    Delivered Files ({deliveryFiles.length})
                  </p>
                  <div className="space-y-1.5">
                    {deliveryFiles.map((f, i) => (
                      <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm hover:bg-green-500/20 transition-colors">
                        <Download className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="flex-1 truncate">{f.name}</span>
                        <span className="text-[10px] text-gray-600 flex-shrink-0">
                          {f.created_at ? new Date(f.created_at).toLocaleDateString() : ''}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {order.auto_complete_at && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <Clock className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-xs text-yellow-300">
                    Auto-close: {new Date(order.auto_complete_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Re-upload Delivery Package</label>
                <input
                  ref={deliveryInputRef}
                  type="file"
                  accept=".zip,.rar,.7z,.tar,.gz,.wav,.mp3,.flac,.aif,.aiff"
                  onChange={(e) => setDeliveryFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deliveryInputRef.current?.click()}
                    className="bg-zinc-700 hover:bg-zinc-600 text-white border-0 flex-1"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {deliveryFile ? deliveryFile.name : 'Select New File'}
                  </Button>
                  {deliveryFile && (
                    <Button size="sm" onClick={() => setDeliveryFile(null)} variant="ghost" className="text-gray-400">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {uploading && (
                <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-full bg-green-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}

              {deliveryFile && (
                <Button
                  size="sm"
                  onClick={handleDeliveryUpload}
                  disabled={uploading}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2 w-full justify-center"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Re-upload & Notify Client
                </Button>
              )}

              <Button
                size="sm"
                onClick={handleForceComplete}
                disabled={updating}
                className="bg-green-600 hover:bg-green-700 text-white gap-2 w-full justify-center"
              >
                {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Force Complete Order
              </Button>
            </div>
          )}

          {order.status === 'completed' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              <span className="text-sm text-green-300 font-medium">Order Completed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
