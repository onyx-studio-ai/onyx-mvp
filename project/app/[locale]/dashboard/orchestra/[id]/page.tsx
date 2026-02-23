'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft, Music2, Upload, Download, Check, Clock, Loader2,
  FileMusic, Info, ExternalLink, MessageSquare, Send, CheckCircle2,
  Calendar, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/dashboard/StatusBadge';

type OrchestraOrder = {
  id: string;
  order_number: string;
  email: string;
  project_name: string;
  tier: string;
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
  created_at: string;
  notes: string | null;
};

type Message = {
  id: string;
  order_id: string;
  sender_role: 'admin' | 'client';
  message: string;
  created_at: string;
};

const STATUS_STEPS = [
  { key: 'paid', labelKey: 'statusPaymentConfirmed' },
  { key: 'awaiting_files', labelKey: 'statusUploadFiles' },
  { key: 'under_review', labelKey: 'statusUnderReview' },
  { key: 'in_production', labelKey: 'statusInProduction' },
  { key: 'delivered', labelKey: 'statusDelivered' },
  { key: 'completed', labelKey: 'statusCompleted' },
];

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

function getDaysRemaining(autoCompleteAt: string | null): number | null {
  if (!autoCompleteAt) return null;
  const diff = new Date(autoCompleteAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function OrchestraOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('dashboard.orchestraDetail');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [order, setOrder] = useState<OrchestraOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [deliveryFiles, setDeliveryFiles] = useState<{ name: string; url: string; created_at: string; size: number }[]>([]);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/orders/orchestra?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        // Auto-complete check
        if (data.status === 'delivered' && data.auto_complete_at) {
          if (new Date(data.auto_complete_at).getTime() <= Date.now()) {
            await fetch('/api/orders/orchestra', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: data.id, status: 'completed' }),
            });
            data.status = 'completed';
          }
        }
        setOrder(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/orders/orchestra/messages?order_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    } finally {
      setLoadingMessages(false);
    }
  }, [id]);

  const fetchDeliveryFiles = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/orders/orchestra/delivery-files?orderId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setDeliveryFiles(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
    fetchMessages();
    fetchDeliveryFiles();
  }, [loadOrder, fetchMessages, fetchDeliveryFiles]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !order) return;

    const allowed = ['.mid', '.midi', '.pdf', '.xml', '.mxl', '.musicxml', '.sib', '.musx', '.mus', '.mscz', '.dorico', '.wav', '.mp3', '.aac', '.flac'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowed.includes(ext)) {
      setUploadError(t('unsupportedFileType'));
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError(t('fileSizeExceeded'));
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orderId', order.id);

      setUploadProgress(30);

      const res = await fetch('/api/orders/orchestra/upload', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(80);

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Upload failed');

      // Move to under_review after upload
      await fetch('/api/orders/orchestra', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status: 'under_review' }),
      });

      setUploadProgress(100);
      setUploadSuccess(true);

      const updateField = result.field === 'midi_file_url'
        ? { midi_file_url: result.url }
        : { score_file_url: result.url };
      setOrder((prev) => prev ? { ...prev, ...updateField, status: 'under_review' } : prev);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !order) return;
    setSendingMessage(true);
    try {
      const res = await fetch('/api/orders/orchestra/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          sender_role: 'client',
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

  async function handleAcceptDelivery() {
    if (!order) return;
    setAccepting(true);
    try {
      await fetch('/api/orders/orchestra', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status: 'completed' }),
      });

      try {
        await fetch('/api/mail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow: 'strings',
            type: 'delivery_accepted',
            email: order.email,
            orderNumber: order.order_number,
            orderId: order.id,
          }),
        });
        console.log('[Orchestra] Delivery accepted notification sent');
      } catch (err) {
        console.error('[Orchestra] Failed to send delivery accepted notification:', err);
      }

      setOrder((prev) => prev ? { ...prev, status: 'completed' } : prev);
    } catch {
      // silent
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050505]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">{t('orderNotFound')}</p>
        <Link href="/dashboard"><Button variant="outline" className="border-white/20 text-gray-200 hover:bg-white/10">{t('backToDashboard')}</Button></Link>
      </div>
    );
  }

  const stepIndex = getStepIndex(order.status);
  const canUpload = order.status === 'awaiting_files' || order.status === 'paid';
  const canMessage = ['under_review', 'in_production', 'delivered'].includes(order.status);
  const daysRemaining = getDaysRemaining(order.auto_complete_at);
  const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> {t('backToDashboard')}
        </Link>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 shadow-lg shadow-amber-600/20 flex-shrink-0">
              <Music2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-amber-400 font-semibold tracking-widest uppercase mb-1">{t('stringsSession')}</p>
              <h1 className="text-2xl font-bold text-white">{order.project_name}</h1>
              <p className="text-gray-500 text-sm mt-1">#{order.order_number} &middot; {date}</p>
            </div>
          </div>
          <StatusBadge status={order.status} />
        </motion.div>

        {/* Progress */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
          className="mb-8 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-6 font-medium">{t('sessionProgress')}</p>
          <div className="flex items-center gap-0">
            {STATUS_STEPS.map((step, i) => {
              const done = i <= stepIndex;
              const current = i === stepIndex;
              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${done ? 'bg-amber-500 text-black' : 'bg-white/[0.05] text-gray-600 border border-white/[0.08]'} ${current ? 'ring-2 ring-amber-400/40 ring-offset-2 ring-offset-[#050505]' : ''}`}>
                      {done && i < stepIndex ? <Check className="w-4 h-4" /> : <span>{i + 1}</span>}
                    </div>
                    <p className={`text-[11px] mt-2.5 font-semibold text-center w-20 leading-tight ${current ? 'text-amber-300' : done ? 'text-amber-400/70' : 'text-gray-600'}`}>
                      {t(step.labelKey)}
                    </p>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-px mx-1 mb-6 ${i < stepIndex ? 'bg-amber-500/40' : 'bg-white/[0.06]'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Estimated delivery date */}
        {order.estimated_delivery_date && ['in_production', 'delivered', 'completed'].includes(order.status) && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.07 }}
            className="mb-6 p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-300">{t('estimatedDelivery')}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(order.estimated_delivery_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </motion.div>
        )}

        {/* Order Details */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-6 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4 font-medium">{t('orderDetails')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: t('stringSetup'), value: order.tier_name },
              { label: t('duration'), value: `${order.duration_minutes} ${t('minUnit')}` },
              { label: t('amount'), value: `US$${order.price?.toLocaleString()}` },
              { label: t('usage'), value: order.usage_type || '—' },
              { label: t('genre'), value: order.genre || '—' },
              { label: t('payment'), value: order.payment_status === 'paid' ? t('paid') : t('pending') },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-white/[0.02] px-3 py-2.5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{item.label}</p>
                <p className="text-white text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>
          {order.description && (
            <div className="mt-4 pt-4 border-t border-white/[0.04]">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{t('projectBrief')}</p>
              <p className="text-gray-300 text-sm leading-relaxed">{order.description}</p>
            </div>
          )}
          {order.reference_url && (
            <div className="mt-4 pt-4 border-t border-white/[0.04] flex items-center gap-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{t('reference')}</p>
              <a href={order.reference_url} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1 truncate transition-colors">
                {order.reference_url}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
          )}
        </motion.div>

        {/* File Upload */}
        {canUpload && !uploadSuccess && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-6 p-6 rounded-2xl bg-amber-950/20 border-2 border-amber-500/30">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-amber-500/20"><Upload className="w-5 h-5 text-amber-400" /></div>
              <div>
                <p className="text-base font-bold text-amber-300">{t('uploadTitle')}</p>
                <p className="text-sm text-gray-400 mt-0.5">{t('uploadSubtitle')}</p>
              </div>
            </div>
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${uploading ? 'border-amber-500/30 cursor-wait' : 'border-amber-500/20 hover:border-amber-500/50 cursor-pointer hover:bg-amber-500/5'}`}
            >
              <input ref={fileInputRef} type="file"
                accept=".mid,.midi,.pdf,.xml,.mxl,.musicxml,.sib,.musx,.mus,.mscz,.dorico,.wav,.mp3,.aac,.flac"
                onChange={handleFileUpload} className="hidden" />
              {uploading ? (
                <div>
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm font-medium text-amber-300 mb-2">{t('uploading')}</p>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden max-w-xs mx-auto">
                    <div className="h-full rounded-full bg-amber-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : (
                <div>
                  <FileMusic className="w-8 h-8 text-amber-500/50 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-300 mb-1">{t('clickToUpload')}</p>
                  <p className="text-xs text-gray-600">{t('uploadFormats')}</p>
                </div>
              )}
            </div>
            {uploadError && (
              <p className="text-red-400 text-xs mt-3 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {uploadError}
              </p>
            )}
          </motion.div>
        )}

        {/* Upload Success */}
        {uploadSuccess && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-5 rounded-2xl bg-green-950/20 border border-green-500/25 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-green-500/20 flex-shrink-0"><Check className="w-4 h-4 text-green-400" /></div>
            <div>
              <p className="text-sm font-bold text-green-300">{t('uploadSuccess')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('uploadSuccessDesc')}</p>
            </div>
          </motion.div>
        )}

        {/* Existing files */}
        {(order.midi_file_url || order.score_file_url) && !canUpload && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-4 font-medium">{t('yourUploadedFiles')}</p>
            <div className="space-y-2">
              {order.midi_file_url && (
                <a href={order.midi_file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors group">
                  <FileMusic className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1">{t('midiAudioFile')}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                </a>
              )}
              {order.score_file_url && (
                <a href={order.score_file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors group">
                  <FileMusic className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1">{t('scoreSheet')}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                </a>
              )}
            </div>
          </motion.div>
        )}

        {/* Delivery Section */}
        {order.status === 'delivered' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6 p-5 rounded-2xl bg-green-950/15 border border-green-500/25">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-500/20"><Download className="w-4 h-4 text-green-400" /></div>
              <p className="text-sm font-bold text-green-300">{t('filesReady')}</p>
            </div>

            {deliveryFiles.length > 0 ? (
              <div className="space-y-2 mb-4">
                {deliveryFiles.map((f, i) => (
                  <a key={i} href={f.url} download
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-green-500/10 hover:border-green-500/30 transition-colors group">
                    <Download className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1 truncate">{f.name}</span>
                    <span className="text-[10px] text-gray-600 flex-shrink-0">
                      {f.created_at ? new Date(f.created_at).toLocaleDateString() : ''}
                    </span>
                  </a>
                ))}
              </div>
            ) : order.delivery_file_url ? (
              <a href={order.delivery_file_url} download
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-green-500/10 hover:border-green-500/30 transition-colors group mb-4">
                <Download className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1">{t('downloadDeliveryPackage')}</span>
                <span className="text-xs text-green-500 font-medium">{t('download')}</span>
              </a>
            ) : null}

            {daysRemaining !== null && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-4">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                <p className="text-xs text-yellow-300">
                  {t('autoCloseWarning', { days: daysRemaining })}
                </p>
              </div>
            )}

            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              {t('reviewDeliveredDesc')}
            </p>

            <Button
              onClick={handleAcceptDelivery}
              disabled={accepting}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12"
            >
              {accepting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('processing')}</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> {t('confirmAcceptDelivery')}</>
              )}
            </Button>
          </motion.div>
        )}

        {/* Completed */}
        {order.status === 'completed' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6 p-5 rounded-2xl bg-green-950/15 border border-green-500/25">
            <div className="p-2 rounded-lg bg-green-500/20 flex-shrink-0 mb-3"><CheckCircle2 className="w-4 h-4 text-green-400" /></div>
            <p className="text-sm font-bold text-green-300">{t('orderComplete')}</p>
            <p className="text-xs text-gray-500 mt-1 mb-3">{t('orderCompleteDesc')}</p>
            {deliveryFiles.length > 0 ? (
              <div className="space-y-2">
                {deliveryFiles.map((f, i) => (
                  <a key={i} href={f.url} download
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-green-500/10 hover:border-green-500/30 transition-colors group">
                    <Download className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1 truncate">{f.name}</span>
                  </a>
                ))}
              </div>
            ) : order.delivery_file_url ? (
              <a href={order.delivery_file_url} download
                className="inline-flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300 transition-colors">
                <Download className="w-3.5 h-3.5" /> {t('downloadDelivery')}
              </a>
            ) : null}
          </motion.div>
        )}

        {/* Messages Thread */}
        {(canMessage || messages.length > 0 || order.status === 'completed') && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
            className="mb-6 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{t('messages')}</p>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 mb-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-gray-600 text-xs text-center py-6">{t('noMessagesYet')}</p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`px-3 py-2.5 rounded-lg text-sm ${
                      msg.sender_role === 'admin'
                        ? 'bg-amber-500/10 border border-amber-500/20 mr-8'
                        : 'bg-blue-500/10 border border-blue-500/20 ml-8'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        msg.sender_role === 'admin' ? 'text-amber-400' : 'text-blue-400'
                      }`}>
                        {msg.sender_role === 'admin' ? t('onyxTeam') : t('you')}
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

            {canMessage && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder={t('typeMessage')}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-amber-500/40"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4"
                >
                  {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* In production notice */}
        {order.status === 'in_production' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-start gap-3">
            <Clock className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-300 mb-1">{t('sessionInProduction')}</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                {t('sessionInProductionDesc')}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}
