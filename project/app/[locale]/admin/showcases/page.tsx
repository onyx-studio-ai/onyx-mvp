"use client";

import { useState, useEffect, useRef } from "react";
import { supabase, type AudioShowcase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Upload, Play, Pause, Save, ChevronDown, ChevronRight, Music, Volume2,
} from "lucide-react";
import { toast } from "sonner";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadToStorage(path: string, file: File): Promise<string> {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { error } = await client.storage.from("showcases").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = client.storage.from("showcases").getPublicUrl(path);
  return data.publicUrl;
}

type SectionConfig = {
  key: string;
  title: string;
  description: string;
  slots: { key: string; label: string; editable?: boolean }[];
};

const SECTIONS: SectionConfig[] = [
  {
    key: "featured_voices",
    title: "Featured Voices",
    description: "Three featured voice cards at the top of the Voice Studio page",
    slots: [
      { key: "slot_1", label: "Card 1", editable: true },
      { key: "slot_2", label: "Card 2", editable: true },
      { key: "slot_3", label: "Card 3", editable: true },
    ],
  },
  {
    key: "voice_tier",
    title: "Voice Tier Comparison",
    description: "Three-tier comparison demos on the Voice Studio page (AI Instant / Director's Cut / Live Studio)",
    slots: [
      { key: "standard", label: "AI Instant Voice" },
      { key: "onyx", label: "Director's Cut" },
      { key: "human", label: "100% Live Studio" },
    ],
  },
  {
    key: "music_comparison",
    title: "Music Comparison",
    description: "Raw AI Output vs Onyx Studio Finish comparison on the Music Studio page",
    slots: [
      { key: "raw", label: "Raw AI Output" },
      { key: "onyx", label: "Onyx Studio Finish" },
    ],
  },
  {
    key: "orchestra_comparison",
    title: "Orchestra Comparison",
    description: "AI vs Human waveform comparison on the Live Strings page",
    slots: [
      { key: "raw", label: "Raw AI / MIDI" },
      { key: "live", label: "Live Strings" },
    ],
  },
];

function AudioPreview({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play();
      setPlaying(true);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={url}
        onEnded={() => setPlaying(false)}
        onError={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={toggle}
        className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center hover:bg-cyan-500/30 transition-colors"
      >
        {playing ? (
          <Pause className="w-3.5 h-3.5 text-cyan-400" />
        ) : (
          <Play className="w-3.5 h-3.5 text-cyan-400 ml-0.5" />
        )}
      </button>
      <span className="text-xs text-gray-500 truncate max-w-[200px]">
        {url.split("/").pop()}
      </span>
    </div>
  );
}

function SlotEditor({
  showcase,
  sectionKey,
  slotConfig,
  onSaved,
}: {
  showcase: AudioShowcase | null;
  sectionKey: string;
  slotConfig: { key: string; label: string; editable?: boolean };
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(showcase?.label || "");
  const [subtitle, setSubtitle] = useState(showcase?.subtitle || "");
  const [description, setDescription] = useState(showcase?.description || "");
  const [tagsStr, setTagsStr] = useState(
    (showcase?.tags || []).join(", ")
  );
  const [audioUrl, setAudioUrl] = useState(showcase?.audio_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(showcase?.label || "");
    setSubtitle(showcase?.subtitle || "");
    setDescription(showcase?.description || "");
    setTagsStr((showcase?.tags || []).join(", "));
    setAudioUrl(showcase?.audio_url || "");
  }, [showcase]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Audio file must be under 50 MB");
      return;
    }

    setUploading(true);
    try {
      const safeName = sanitizeFileName(file.name);
      const path = `${sectionKey}/${slotConfig.key}/${Date.now()}-${safeName}`;
      const url = await uploadToStorage(path, file);
      setAudioUrl(url);
      toast.success("Audio uploaded");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload audio");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const tags = tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        section: sectionKey,
        slot_key: slotConfig.key,
        audio_url: audioUrl || null,
        label: label || null,
        subtitle: subtitle || null,
        description: description || null,
        tags,
        updated_at: new Date().toISOString(),
      };

      if (showcase?.id) {
        const { error } = await supabase
          .from("audio_showcases")
          .update(payload)
          .eq("id", showcase.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("audio_showcases")
          .upsert(payload, { onConflict: "section,slot_key" });
        if (error) throw error;
      }

      toast.success("Saved");
      onSaved();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Music className="w-4 h-4 text-cyan-400" />
          {slotConfig.label}
        </h4>
        {audioUrl && <AudioPreview url={audioUrl} />}
      </div>

      {slotConfig.editable && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs">Name</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Onyx Alpha"
              className="bg-zinc-950 border-zinc-700 text-white placeholder:text-gray-600 h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs">Subtitle</Label>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. The Authority"
              className="bg-zinc-950 border-zinc-700 text-white placeholder:text-gray-600 h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-gray-400 text-xs">Tags (comma-separated)</Label>
            <Input
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="e.g. News, Corporate, Deep"
              className="bg-zinc-950 border-zinc-700 text-white placeholder:text-gray-600 h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-gray-400 text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description..."
              rows={2}
              className="bg-zinc-950 border-zinc-700 text-white placeholder:text-gray-600 text-sm resize-none"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".mp3,.wav,.aiff,.flac,audio/*"
          onChange={handleUpload}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="border-zinc-600 text-gray-200 hover:bg-zinc-800 hover:text-white gap-2 h-8"
        >
          {uploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" />{" "}
              {audioUrl ? "Replace Audio" : "Upload Audio"}
            </>
          )}
        </Button>
        <span className="text-[11px] text-gray-500">
          MP3, WAV, AIFF, FLAC. Max 50 MB.
        </span>
        <div className="flex-1" />
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-8 min-w-[80px]"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <Save className="w-3.5 h-3.5" /> Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function AdminShowcasesPage() {
  const [showcases, setShowcases] = useState<AudioShowcase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["featured_voices"])
  );

  const fetchShowcases = async () => {
    try {
      const { data, error } = await supabase
        .from("audio_showcases")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setShowcases(data || []);
    } catch (err) {
      console.error("Error fetching showcases:", err);
      toast.error("Failed to load showcases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShowcases();
  }, []);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getShowcase = (section: string, slotKey: string) =>
    showcases.find((s) => s.section === section && s.slot_key === slotKey) ||
    null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 text-white">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Volume2 className="w-6 h-6 text-cyan-400" />
          Audio Showcases
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage all showcase audio and text content across the site
        </p>
      </div>

      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const isExpanded = expandedSections.has(section.key);
          const filledCount = section.slots.filter(
            (slot) => getShowcase(section.key, slot.key)?.audio_url
          ).length;

          return (
            <div
              key={section.key}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden"
            >
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <div className="text-left">
                    <h3 className="text-base font-semibold text-white">
                      {section.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {section.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      filledCount === section.slots.length
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : filledCount > 0
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-zinc-700 text-gray-400 border border-zinc-600"
                    }`}
                  >
                    {filledCount}/{section.slots.length} audio
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-6 space-y-3">
                  {section.slots.map((slot) => (
                    <SlotEditor
                      key={slot.key}
                      showcase={getShowcase(section.key, slot.key)}
                      sectionKey={section.key}
                      slotConfig={slot}
                      onSaved={fetchShowcases}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
