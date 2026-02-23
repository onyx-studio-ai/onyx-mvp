'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Play, Pause, Plus, Trash2, Loader2, ChevronDown, ChevronUp,
  MessageSquare, ThumbsUp, ThumbsDown, HelpCircle, Sparkles, Lock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';

interface Annotation {
  id: string;
  demo_id: string;
  music_order_id: string;
  time_start: number;
  time_end: number | null;
  annotation_type: 'keep' | 'change' | 'question';
  category: string;
  label: string;
  notes: string;
  created_at: string;
}

interface DemoFeedbackPanelProps {
  demoId: string;
  musicOrderId: string;
  audioUrl: string;
  demoIndex: number;
  overallRating: number | null;
  overallNotes: string;
  onFeedbackSaved: () => void;
  onNotesChange?: (notes: string) => void;
  tier?: string;
}

const ANNOTATION_TYPES = [
  { value: 'keep', labelKey: 'loveThis', icon: ThumbsUp, color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30' },
  { value: 'change', labelKey: 'changeThis', icon: ThumbsDown, color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' },
  { value: 'question', labelKey: 'question', icon: HelpCircle, color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
] as const;

type TierCapability = 'ai-curator' | 'pro-arrangement' | 'masterpiece';

interface CategoryDef {
  value: string;
  label: string;
  tiers: TierCapability[];
  lockedNote?: string;
}

const CATEGORIES: CategoryDef[] = [
  {
    value: 'mix',
    label: 'Mix / Volume',
    tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'],
  },
  {
    value: 'intensity',
    label: 'Intensity / Energy',
    tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'],
  },
  {
    value: 'mood',
    label: 'Mood / Emotion',
    tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'],
  },
  {
    value: 'instrument',
    label: 'Instrument / Sound',
    tiers: ['pro-arrangement', 'masterpiece'],
    lockedNote: 'Instrument changes require Pro Arrangement or above',
  },
  {
    value: 'arrangement',
    label: 'Arrangement / Layer',
    tiers: ['pro-arrangement', 'masterpiece'],
    lockedNote: 'Re-arrangement requires Pro Arrangement or above',
  },
  {
    value: 'tempo',
    label: 'Tempo / Rhythm',
    tiers: ['pro-arrangement', 'masterpiece'],
    lockedNote: 'Tempo changes require Pro Arrangement or above',
  },
  {
    value: 'melody',
    label: 'Melody / Vocals',
    tiers: ['masterpiece'],
    lockedNote: 'Melody & vocal editing is only available in Masterpiece',
  },
  {
    value: 'structure',
    label: 'Song Structure',
    tiers: ['masterpiece'],
    lockedNote: 'Structural editing is only available in Masterpiece',
  },
  {
    value: 'other',
    label: 'Other',
    tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'],
  },
];

const QUICK_LABELS: Record<string, Record<string, { label: string; tiers: TierCapability[] }[]>> = {
  keep: {
    mix: [
      { label: 'Perfect Volume Balance', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Clean Sound', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Great Overall Mix', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
    ],
    intensity: [
      { label: 'Perfect Energy', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Love the Build', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Great Dynamics', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
    ],
    mood: [
      { label: 'Right Vibe', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Emotional', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Exactly the Feeling', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
    ],
    instrument: [
      { label: 'Love This Sound', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'Keep This Instrument', tiers: ['pro-arrangement', 'masterpiece'] },
    ],
    arrangement: [
      { label: 'Great Layer', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'Keep This Section', tiers: ['pro-arrangement', 'masterpiece'] },
    ],
    tempo: [
      { label: 'Perfect Pace', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'Good Rhythm', tiers: ['pro-arrangement', 'masterpiece'] },
    ],
    melody: [
      { label: 'Love This Melody Line', tiers: ['masterpiece'] },
      { label: 'Keep This Hook', tiers: ['masterpiece'] },
    ],
    structure: [
      { label: 'Strong Intro', tiers: ['masterpiece'] },
      { label: 'Great Chorus', tiers: ['masterpiece'] },
      { label: 'Good Bridge', tiers: ['masterpiece'] },
    ],
    other: [
      { label: 'Love This Part', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
    ],
  },
  change: {
    mix: [
      { label: 'Too Loud', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Too Quiet', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Needs Cleaning', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Too Much Bass', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Too Much Treble', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
    ],
    intensity: [
      { label: 'Too Intense', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'More Subtle', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Need More Build', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
    ],
    mood: [
      { label: 'Too Dark', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Too Upbeat', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'More Emotional', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Less Dramatic', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
    ],
    instrument: [
      { label: 'Remove This Instrument', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'Swap Instrument', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'Add Guitar', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'Add Piano', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'Add Strings', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'Less Drums', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'More Bass', tiers: ['pro-arrangement', 'masterpiece'] },
    ],
    arrangement: [
      { label: 'Too Busy', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'Too Empty', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'Strip Down', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'Add More Layers', tiers: ['pro-arrangement', 'masterpiece'] },
    ],
    tempo: [
      { label: 'Speed Up', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'Slow Down', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'More Groove', tiers: ['pro-arrangement', 'masterpiece'] },
    ],
    melody: [
      { label: 'Adjust Melody', tiers: ['masterpiece'] },
      { label: 'Rewrite Hook', tiers: ['masterpiece'] },
      { label: 'Fix Pitch / Tuning', tiers: ['masterpiece'] },
      { label: 'Change Vocal Style', tiers: ['masterpiece'] },
    ],
    structure: [
      { label: 'Shorten Section', tiers: ['masterpiece'] },
      { label: 'Extend Section', tiers: ['masterpiece'] },
      { label: 'Cut to Chorus Faster', tiers: ['masterpiece'] },
      { label: 'Remove Bridge', tiers: ['masterpiece'] },
      { label: 'Add Outro', tiers: ['masterpiece'] },
    ],
    other: [
      { label: 'Adjust This', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Rework This Section', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
    ],
  },
  question: {
    mix: [
      { label: 'Can This Be Louder?', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'What Is This Sound?', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
    ],
    intensity: [
      { label: 'Can You Make It Bigger?', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
      { label: 'Is This the Peak?', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
    ],
    mood: [
      { label: 'Can This Feel Warmer?', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
    ],
    instrument: [
      { label: 'What Instrument Is This?', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'Can You Try Different Instrument?', tiers: ['pro-arrangement', 'masterpiece'] },
    ],
    arrangement: [
      { label: 'Can We Try Without This?', tiers: ['pro-arrangement', 'masterpiece'] },
    ],
    tempo: [
      { label: 'Can We Go Faster?', tiers: ['pro-arrangement', 'masterpiece'] },
      { label: 'Is This the Right Feel?', tiers: ['pro-arrangement', 'masterpiece'] },
    ],
    melody: [
      { label: 'Can We Try a Different Hook?', tiers: ['masterpiece'] },
      { label: 'Is the Vocal Pitch Correct?', tiers: ['masterpiece'] },
    ],
    structure: [
      { label: 'Does It Need a Break?', tiers: ['masterpiece'] },
      { label: 'Can We Try Different Ending?', tiers: ['masterpiece'] },
    ],
    other: [
      { label: 'Question About This Part', tiers: ['ai-curator', 'pro-arrangement', 'masterpiece'] },
    ],
  },
};

const TIER_LABELS: Record<TierCapability, string> = {
  'ai-curator': 'AI Curator',
  'pro-arrangement': 'Pro Arrangement',
  'masterpiece': 'Masterpiece',
};

function normalizeTier(tier?: string): TierCapability {
  if (tier === 'masterpiece') return 'masterpiece';
  if (tier === 'pro-arrangement') return 'pro-arrangement';
  return 'ai-curator';
}

function isCategoryAvailable(cat: CategoryDef, tier: TierCapability): boolean {
  return cat.tiers.includes(tier);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function WaveformVisualizer({
  audioUrl,
  duration,
  currentTime,
  annotations,
  onSeek,
  onRangeSelect,
  pendingStart,
  pendingEnd,
}: {
  audioUrl: string;
  duration: number;
  currentTime: number;
  annotations: Annotation[];
  onSeek: (t: number) => void;
  onRangeSelect: (start: number, end: number | null) => void;
  pendingStart: number | null;
  pendingEnd: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveData, setWaveData] = useState<number[]>([]);
  const [dragging, setDragging] = useState(false);
  const [liveEnd, setLiveEnd] = useState<number | null>(null);
  const dragStartRef = useRef<number | null>(null);

  useEffect(() => {
    const bars = 120;
    const data = Array.from({ length: bars }, (_, i) => {
      const x = i / bars;
      const base = 0.3 + 0.5 * Math.sin(x * Math.PI * 3 + 1) * Math.cos(x * Math.PI * 1.5);
      return Math.max(0.08, Math.abs(base + (Math.random() - 0.5) * 0.25));
    });
    setWaveData(data);
  }, [audioUrl]);

  const getTimeFromX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || duration === 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }, [duration]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const t = getTimeFromX(e.clientX);
    dragStartRef.current = t;
    setDragging(true);
    setLiveEnd(null);
    onRangeSelect(t, null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || dragStartRef.current === null) return;
    const t = getTimeFromX(e.clientX);
    if (Math.abs(t - dragStartRef.current) > 0.3) {
      const start = Math.min(dragStartRef.current, t);
      const end = Math.max(dragStartRef.current, t);
      setLiveEnd(end);
      onRangeSelect(start, end);
    } else {
      setLiveEnd(null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragging) return;
    setDragging(false);
    setLiveEnd(null);
    const t = getTimeFromX(e.clientX);
    if (dragStartRef.current !== null && Math.abs(t - dragStartRef.current) <= 0.3) {
      onSeek(t);
      onRangeSelect(t, null);
    }
    dragStartRef.current = null;
  };

  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const selStart = pendingStart !== null ? Math.min(pendingStart, pendingEnd ?? pendingStart) : null;
  const selEnd = pendingEnd !== null ? Math.max(pendingStart ?? pendingEnd, pendingEnd) : null;
  const selLeftPct = selStart !== null && duration > 0 ? (selStart / duration) * 100 : null;
  const selWidthPct = selStart !== null && selEnd !== null && duration > 0
    ? ((selEnd - selStart) / duration) * 100
    : null;
  const isRange = selWidthPct !== null && selWidthPct > 0.5;

  return (
    <div
      ref={containerRef}
      className="relative h-20 bg-zinc-900 rounded-xl overflow-hidden cursor-crosshair select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="absolute inset-0 flex items-center gap-[1px] px-2">
        {waveData.map((amp, i) => {
          const pct = (i / waveData.length) * 100;
          const isPlayed = pct < playheadPct;
          const inSelection = selLeftPct !== null && isRange
            ? pct >= selLeftPct && selWidthPct !== null && pct <= selLeftPct + selWidthPct
            : false;
          return (
            <div
              key={i}
              className={`flex-1 rounded-full transition-colors ${
                inSelection ? 'bg-white/70' : isPlayed ? 'bg-blue-400' : 'bg-zinc-600'
              }`}
              style={{ height: `${amp * 100}%` }}
            />
          );
        })}
      </div>

      {selLeftPct !== null && isRange && selWidthPct !== null && (
        <div
          className="absolute top-0 bottom-0 bg-white/10 border-x border-white/30 z-10 pointer-events-none"
          style={{ left: `${selLeftPct}%`, width: `${selWidthPct}%` }}
        />
      )}

      {annotations.map((ann) => {
        const typeInfo = ANNOTATION_TYPES.find(t => t.value === ann.annotation_type);
        const leftPct = duration > 0 ? (ann.time_start / duration) * 100 : 0;
        const widthPct = ann.time_end && duration > 0 ? ((ann.time_end - ann.time_start) / duration) * 100 : 0;
        const color = ann.annotation_type === 'keep' ? '#22c55e' : ann.annotation_type === 'change' ? '#ef4444' : '#f59e0b';
        return (
          <div key={ann.id}>
            {widthPct > 0.5 && (
              <div
                className="absolute top-0 bottom-0 opacity-25"
                style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: color }}
              />
            )}
            <div
              className="absolute top-0 bottom-0 w-0.5 opacity-80"
              style={{ left: `${leftPct}%`, backgroundColor: color }}
            />
            <div
              className="absolute top-1 w-4 h-4 rounded-full flex items-center justify-center text-white z-20"
              style={{ left: `calc(${leftPct}% - 8px)`, backgroundColor: color }}
            >
              {typeInfo && <typeInfo.icon className="w-2 h-2" />}
            </div>
          </div>
        );
      })}

      {pendingStart !== null && !isRange && duration > 0 && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-20 pointer-events-none"
          style={{ left: `${(pendingStart / duration) * 100}%` }}
        />
      )}

      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white z-10 pointer-events-none"
        style={{ left: `${playheadPct}%` }}
      />

      <div className="absolute bottom-1 left-2 right-2 flex justify-between pointer-events-none">
        {isRange && selStart !== null && selEnd !== null ? (
          <span className="text-[9px] text-white/60 bg-zinc-900/80 px-1 rounded">
            {formatTime(selStart)} — {formatTime(selEnd)}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[9px] text-zinc-500">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

export default function DemoFeedbackPanel({
  demoId,
  musicOrderId,
  audioUrl,
  demoIndex,
  overallRating,
  overallNotes,
  onFeedbackSaved,
  onNotesChange,
  tier,
}: DemoFeedbackPanelProps) {
  const { toast } = useToast();
  const t = useTranslations('dashboard.demoFeedback');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);

  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [pendingEnd, setPendingEnd] = useState<number | null>(null);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [newType, setNewType] = useState<'keep' | 'change' | 'question'>('change');
  const [newCategory, setNewCategory] = useState('mix');
  const [newLabel, setNewLabel] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [rating, setRating] = useState<number | null>(overallRating);
  const [generalNotes, setGeneralNotes] = useState(overallNotes || '');
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const normalizedTier = normalizeTier(tier);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onended = () => setPlaying(false);
    return () => { audio.pause(); };
  }, [audioUrl]);

  const fetchAnnotations = useCallback(async () => {
    const { data } = await supabase
      .from('demo_annotations')
      .select('*')
      .eq('demo_id', demoId)
      .order('time_start', { ascending: true });
    setAnnotations((data || []) as Annotation[]);
    setLoading(false);
  }, [demoId]);

  useEffect(() => { fetchAnnotations(); }, [fetchAnnotations]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  const handleSeek = (t: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const handleRangeSelect = (start: number, end: number | null) => {
    setPendingStart(start);
    setPendingEnd(end);
  };

  const handleAddAnnotation = async () => {
    if (pendingStart === null || !newLabel.trim()) return;
    setSaving(true);
    try {
      await supabase.from('demo_annotations').insert({
        demo_id: demoId,
        music_order_id: musicOrderId,
        time_start: Math.round(pendingStart * 10) / 10,
        time_end: pendingEnd ? Math.round(pendingEnd * 10) / 10 : null,
        annotation_type: newType,
        category: newCategory,
        label: newLabel.trim(),
        notes: newNotes.trim(),
      });
      setShowAnnotationForm(false);
      setNewLabel('');
      setNewNotes('');
      setPendingStart(null);
      setPendingEnd(null);
      fetchAnnotations();
      toast({ title: 'Annotation saved' });
    } catch {
      toast({ title: 'Error saving annotation', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAnnotation = async (id: string) => {
    await supabase.from('demo_annotations').delete().eq('id', id);
    fetchAnnotations();
  };

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await supabase.from('music_order_versions').update({
        overall_rating: rating,
        overall_notes: generalNotes.trim(),
      }).eq('id', demoId);
      toast({ title: 'Notes saved' });
    } catch {
      toast({ title: 'Error saving', variant: 'destructive' });
    } finally {
      setSavingGeneral(false);
    }
  };

  const selectedCategoryDef = CATEGORIES.find(c => c.value === newCategory);
  const isCategoryLocked = selectedCategoryDef ? !isCategoryAvailable(selectedCategoryDef, normalizedTier) : false;
  const quickLabelsForCurrent = (!isCategoryLocked && newCategory && newType)
    ? (QUICK_LABELS[newType]?.[newCategory] || []).filter(ql => ql.tiers.includes(normalizedTier))
    : [];

  if (loading) return (
    <div className="py-4 flex items-center gap-2 text-gray-500 text-xs">
      <Loader2 className="w-3 h-3 animate-spin" />
      {t('loadingFeedback')}
    </div>
  );

  return (
    <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-white transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          {t('feedbackAnnotations')}
          {annotations.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-medium">
              {annotations.length}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white flex-shrink-0 transition-colors"
              >
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <WaveformVisualizer
                  audioUrl={audioUrl}
                  duration={duration}
                  currentTime={currentTime}
                  annotations={annotations}
                  onSeek={handleSeek}
                  onRangeSelect={handleRangeSelect}
                  pendingStart={pendingStart}
                  pendingEnd={pendingEnd}
                />
              </div>
            </div>
            <div className="pl-11 flex items-center gap-3 text-[10px] text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-500" />
                {t('clickMark')}
              </span>
              <span className="text-zinc-700">|</span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-1.5 rounded-sm bg-zinc-500" />
                {t('dragMark')}
              </span>
            </div>
          </div>

          {pendingStart !== null && !showAnnotationForm && (
            <button
              onClick={() => setShowAnnotationForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-blue-500/40 text-blue-400 hover:border-blue-500/70 hover:bg-blue-500/5 text-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              {pendingEnd
                ? <>{t('addFeedbackSection', { start: formatTime(pendingStart), end: formatTime(pendingEnd) })}</>
                : <>{t('addFeedbackAt', { time: formatTime(pendingStart) })}</>
              }
            </button>
          )}

          {showAnnotationForm && pendingStart !== null && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-300">
                  {pendingEnd
                    ? <>{t('section')} <span className="text-blue-300">{formatTime(pendingStart)} — {formatTime(pendingEnd)}</span></>
                    : <>{t('moment')} <span className="text-blue-300">{formatTime(pendingStart)}</span></>
                  }
                </span>
                <button
                  onClick={() => { setShowAnnotationForm(false); setPendingStart(null); setPendingEnd(null); }}
                  className="text-zinc-600 hover:text-gray-400 text-xs"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {ANNOTATION_TYPES.map((aType) => (
                  <button
                    key={aType.value}
                    onClick={() => { setNewType(aType.value); setNewLabel(''); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      newType === aType.value ? `${aType.bg} ${aType.color}` : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'
                    }`}
                  >
                    <aType.icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {t(aType.labelKey)}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('category')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => {
                    const available = isCategoryAvailable(c, normalizedTier);
                    return (
                      <button
                        key={c.value}
                        onClick={() => {
                          if (!available) return;
                          setNewCategory(c.value);
                          setNewLabel('');
                        }}
                        title={!available ? (c.lockedNote || '') : undefined}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition-all ${
                          !available
                            ? 'border-zinc-800 text-zinc-700 cursor-not-allowed'
                            : newCategory === c.value
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
                        }`}
                      >
                        {!available && <Lock className="w-2.5 h-2.5" />}
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                {selectedCategoryDef && isCategoryLocked && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-600">
                    <Lock className="w-3 h-3 flex-shrink-0" />
                    <span>{selectedCategoryDef.lockedNote || t('notAvailableInPlan')}</span>
                  </div>
                )}

                {selectedCategoryDef && !isCategoryLocked && selectedCategoryDef.tiers.length < 3 && (
                  <p className="text-[10px] text-zinc-600">
                    Available in: {selectedCategoryDef.tiers.map(t => TIER_LABELS[t]).join(', ')}
                  </p>
                )}
              </div>

              {quickLabelsForCurrent.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('quickSelect')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {quickLabelsForCurrent.map((ql) => (
                      <button
                        key={ql.label}
                        onClick={() => setNewLabel(ql.label)}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                          newLabel === ql.label
                            ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                            : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
                        }`}
                      >
                        {ql.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder={t('customLabel')}
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
                />
                <textarea
                  rows={2}
                  placeholder={t('moreDetail')}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white resize-none focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
                />
              </div>

              <Button
                size="sm"
                onClick={handleAddAnnotation}
                disabled={saving || !newLabel.trim() || isCategoryLocked}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 text-xs"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {t('saveAnnotation')}
              </Button>
            </div>
          )}

          {annotations.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('yourAnnotations', { count: annotations.length })}</p>
              {annotations.map((ann) => {
                const typeInfo = ANNOTATION_TYPES.find(t => t.value === ann.annotation_type);
                const catLabel = CATEGORIES.find(c => c.value === ann.category)?.label || ann.category;
                return (
                  <div key={ann.id} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border text-xs ${typeInfo?.bg || ''}`}>
                    <div className={`mt-0.5 flex-shrink-0 ${typeInfo?.color || ''}`}>
                      {typeInfo && <typeInfo.icon className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${typeInfo?.color || 'text-gray-300'}`}>{ann.label}</span>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-500">{formatTime(ann.time_start)}{ann.time_end ? ` — ${formatTime(ann.time_end)}` : ''}</span>
                        <span className="text-zinc-600">{catLabel}</span>
                      </div>
                      {ann.notes && <p className="text-zinc-400 mt-0.5 leading-relaxed">{ann.notes}</p>}
                    </div>
                    <button
                      onClick={() => handleDeleteAnnotation(ann.id)}
                      className="text-zinc-700 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-white/[0.05]">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('overallImpression', { index: demoIndex + 1 })}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(rating === n ? null : n)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    rating !== null && rating >= n
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      : 'border-zinc-700 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {'★'.repeat(n)}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              placeholder={t('overallNotes')}
              value={generalNotes}
              onChange={(e) => { setGeneralNotes(e.target.value); onNotesChange?.(e.target.value); }}
              className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white resize-none focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
            />
            <Button
              size="sm"
              onClick={handleSaveGeneral}
              disabled={savingGeneral}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
            >
              {savingGeneral ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {t('saveNotes')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
