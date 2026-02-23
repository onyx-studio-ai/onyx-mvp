'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ThumbsUp, ThumbsDown, HelpCircle, ChevronDown, ChevronUp, Loader2, RotateCcw } from 'lucide-react';

interface Annotation {
  id: string;
  time_start: number;
  time_end: number | null;
  annotation_type: 'keep' | 'change' | 'question';
  category: string;
  label: string;
  notes: string;
}

const TYPE_ICONS = {
  keep: { icon: ThumbsUp, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  change: { icon: ThumbsDown, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  question: { icon: HelpCircle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function DemoAnnotationView({
  demoId,
}: {
  demoId: string;
}) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [overallNotes, setOverallNotes] = useState('');
  const [revisionRequest, setRevisionRequest] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetch = useCallback(async () => {
    const [annotationsRes, versionRes] = await Promise.all([
      supabase
        .from('demo_annotations')
        .select('*')
        .eq('demo_id', demoId)
        .order('time_start', { ascending: true }),
      supabase
        .from('music_order_versions')
        .select('overall_rating, overall_notes, revision_request')
        .eq('id', demoId)
        .maybeSingle(),
    ]);
    const loaded = (annotationsRes.data || []) as Annotation[];
    setAnnotations(loaded);
    if (versionRes.data) {
      setOverallRating(versionRes.data.overall_rating ?? null);
      setOverallNotes(versionRes.data.overall_notes || '');
      setRevisionRequest(versionRes.data.revision_request || '');
    }
    if (loaded.length > 0 || versionRes.data?.overall_notes || versionRes.data?.revision_request || versionRes.data?.overall_rating) {
      setExpanded(true);
    }
    setLoading(false);
  }, [demoId]);

  useEffect(() => { fetch(); }, [fetch]);

  const hasContent = annotations.length > 0 || overallRating || overallNotes || revisionRequest;
  if (!hasContent && !loading) return null;

  return (
    <div className="mt-2 border-t border-zinc-700/50 pt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        Client Feedback
        {annotations.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[9px]">
            {annotations.length} annotations
          </span>
        )}
        {revisionRequest && (
          <span className="px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[9px]">
            revision request
          </span>
        )}
        {overallRating && (
          <span className="text-amber-400 text-[9px]">{'★'.repeat(overallRating)}</span>
        )}
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {revisionRequest && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <RotateCcw className="w-3 h-3 text-orange-400" />
                <p className="text-[10px] text-orange-400 font-medium">Revision Request</p>
              </div>
              <p className="text-xs text-zinc-300">{revisionRequest}</p>
            </div>
          )}
          {overallNotes && (
            <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-zinc-500 mb-0.5">Overall Impression</p>
              <p className="text-xs text-zinc-300">{overallNotes}</p>
            </div>
          )}
          {annotations.map((ann) => {
            const t = TYPE_ICONS[ann.annotation_type] || TYPE_ICONS.change;
            return (
              <div key={ann.id} className={`flex items-start gap-2 rounded-lg px-3 py-2 border text-xs ${t.bg}`}>
                <t.icon className={`w-3 h-3 flex-shrink-0 mt-0.5 ${t.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`font-medium ${t.color}`}>{ann.label}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-500">{formatTime(ann.time_start)}{ann.time_end ? ` — ${formatTime(ann.time_end)}` : ''}</span>
                    <span className="text-zinc-600 capitalize">{ann.category}</span>
                  </div>
                  {ann.notes && <p className="text-zinc-400 mt-0.5 leading-relaxed">{ann.notes}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
