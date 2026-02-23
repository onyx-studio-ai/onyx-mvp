'use client';

import { useState, useMemo } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { supabase, Order } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

const TONES = [
  { value: 'Professional', label: 'Professional & Authoritative' },
  { value: 'Energetic', label: 'High Energy / Hype' },
  { value: 'Soothing', label: 'Soothing & Wellness' },
  { value: 'Movie Trailer', label: 'Deep / Movie Trailer' },
  { value: 'Friendly', label: 'Conversational & Authentic' },
];

const USE_CASES = [
  { value: 'Advertisement', label: 'Paid Ad / Commercial' },
  { value: 'Social Media', label: 'Social Media (TikTok/Reels)' },
  { value: 'E-Learning', label: 'E-Learning / Training' },
  { value: 'Audiobook', label: 'Audiobook / Podcast' },
];

const BUFFER_RATE = 0.1;
const BUFFER_MIN_CHARS = 100;
const BUFFER_MAX_CHARS = 1000;

interface EditOrderModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export default function EditOrderModal({ order, isOpen, onClose, onSaved }: EditOrderModalProps) {
  const [scriptText, setScriptText] = useState(order.script_text);
  const [toneStyle, setToneStyle] = useState(order.tone_style);
  const [useCase, setUseCase] = useState(order.use_case);
  const [projectName, setProjectName] = useState(order.project_name);
  const [saving, setSaving] = useState(false);
  const t = useTranslations('dashboard.editOrder');

  const maxScriptLength = useMemo(() => {
    const originalLen = order.script_text?.length || 0;
    const tenPercent = Math.floor(originalLen * BUFFER_RATE);
    const allowedBuffer = Math.max(BUFFER_MIN_CHARS, Math.min(tenPercent, BUFFER_MAX_CHARS));
    return originalLen + allowedBuffer;
  }, [order.script_text]);
  const currentLength = scriptText?.length || 0;
  const isOverLimit = currentLength > maxScriptLength;

  if (!isOpen) return null;

  const handleSave = async () => {
    if (isOverLimit) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('voice_orders')
        .update({
          script_text: scriptText,
          tone_style: toneStyle,
          use_case: useCase,
          project_name: projectName,
        })
        .eq('id', order.id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        console.warn('[EditOrder] Update returned no rows — possible RLS policy issue for order:', order.id);
        throw new Error('Update was blocked. Please try again or contact support.');
      }

      toast.success('Project updated successfully');
      await onSaved();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed.';
      toast.error('Failed to update project', { description: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">{t('editProject')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('projectName')}</label>
            <input
              className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-blue-500/50 outline-none"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('tone')}</label>
            <select
              className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-blue-500/50 outline-none"
              value={toneStyle}
              onChange={(e) => setToneStyle(e.target.value)}
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('useCase')}</label>
            <select
              className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-blue-500/50 outline-none"
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
            >
              {USE_CASES.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm text-gray-400 font-medium">{t('script')}</label>
              <span className={`text-xs font-mono tabular-nums ${isOverLimit ? 'text-red-400' : 'text-gray-500'}`}>
                {currentLength} / {maxScriptLength}
              </span>
            </div>
            <textarea
              className={`w-full h-36 bg-black border rounded-lg p-3 text-white text-sm focus:border-blue-500/50 outline-none font-mono resize-none transition-colors ${
                isOverLimit ? 'border-red-500/60' : 'border-white/10'
              }`}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
            />
            {isOverLimit && (
              <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-400 leading-relaxed">
                  {t('overLimitError')}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-white/10 space-y-3">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            {t('minorEditsNote')}
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || isOverLimit}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {t('saveChanges')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
