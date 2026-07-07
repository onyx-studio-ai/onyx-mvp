"use client";

import { useState, useEffect, useRef } from "react";
import { supabase, type AudioShowcase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2, Upload, Play, Pause, Save, ChevronDown, ChevronRight, Music, Volume2,
  Plus, Edit, Trash2, X, ImagePlus, ArrowUp, ArrowDown, ListMusic,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

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
        className="w-8 h-8 rounded-full bg-cyan-50 border border-cyan-200 flex items-center justify-center hover:bg-cyan-50 transition-colors"
      >
        {playing ? (
          <Pause className="w-3.5 h-3.5 text-cyan-700" />
        ) : (
          <Play className="w-3.5 h-3.5 text-cyan-700 ml-0.5" />
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
  const tr = useTranslations("admin.showcases");
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
      toast.error(tr("toastAudioTooLarge"));
      return;
    }

    setUploading(true);
    try {
      const safeName = sanitizeFileName(file.name);
      const path = `${sectionKey}/${slotConfig.key}/${Date.now()}-${safeName}`;
      const url = await uploadToStorage(path, file);
      setAudioUrl(url);
      toast.success(tr("toastAudioUploaded"));
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(tr("toastAudioUploadFail"));
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

      // 走後端 service_role API(admin cookie 授權),不再用 anon client 直寫。
      // 統一 upsert(依 section+slot_key),新建 / 更新一條路徑即可。
      const res = await fetch("/api/admin/showcases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          id: showcase?.id,
          section: sectionKey,
          slot_key: slotConfig.key,
          audio_url: audioUrl || null,
          label: label || null,
          subtitle: subtitle || null,
          description: description || null,
          tags,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Request failed");
      }

      toast.success(tr("toastSaved"));
      onSaved();
    } catch (err) {
      console.error("Save error:", err);
      toast.error(tr("toastSaveFail"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Music className="w-4 h-4 text-cyan-700" />
          {slotConfig.label}
        </h4>
        {audioUrl && <AudioPreview url={audioUrl} />}
      </div>

      {slotConfig.editable && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-gray-600 text-xs">{tr("slotName")}</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={tr("slotNamePlaceholder")}
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-gray-600 text-xs">{tr("slotSubtitle")}</Label>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder={tr("slotSubtitlePlaceholder")}
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-gray-600 text-xs">{tr("slotTags")}</Label>
            <Input
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder={tr("slotTagsPlaceholder")}
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-gray-600 text-xs">{tr("slotDescription")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr("slotDescriptionPlaceholder")}
              rows={2}
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 text-sm resize-none"
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
          className="border-gray-400 text-gray-200 hover:bg-gray-100 hover:text-gray-900 gap-2 h-8"
        >
          {uploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {tr("uploading")}
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" />{" "}
              {audioUrl ? tr("replaceAudio") : tr("uploadAudio")}
            </>
          )}
        </Button>
        <span className="text-[11px] text-gray-500">
          {tr("audioFormatHint")}
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
              <Save className="w-3.5 h-3.5" /> {tr("save")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 音樂庫(music_library)—— 清單型管理
//
// 有別於上面的固定 slot 區塊,前台 /music/catalog 的音樂庫是「不定數量的一首首
// 曲目」。這裡提供新增 / 編輯 / 刪除 / 排序,每首欄位對齊前台需要的:
//   slot_key    對外唯一鍵(也決定 fallback 封面路徑、導向 create/brief 的 ?track=)
//   label       曲名
//   subtitle    分類(genre),前台當分類標題
//   description 風格描述
//   image_url   封面(後台上傳到 showcases 桶存完整 URL;前台優先用它)
//   tags        必含 instrumental 或 vocal 決定分頁;其餘 tag 自由
//   audio_url   試聽音檔
//   sort_order  排序
// 全部走 /api/admin/showcases(action:upsert / delete,service_role + requireAdmin)。
// ─────────────────────────────────────────────────────────────────────────────

const MUSIC_LIBRARY_SECTION = "music_library";

// slot_key 只允許小寫英數與 -,對齊既有曲目命名(brand-sting-1、pop-ballad-en…)
function sanitizeSlotKey(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

type TrackForm = {
  slot_key: string;
  label: string;
  subtitle: string;
  description: string;
  image_url: string;
  audio_url: string;
  view: "instrumental" | "vocal";
  extraTags: string; // 逗號分隔的額外 tag(instrumental/vocal 之外)
  sort_order: number;
};

const EMPTY_TRACK: TrackForm = {
  slot_key: "",
  label: "",
  subtitle: "",
  description: "",
  image_url: "",
  audio_url: "",
  view: "instrumental",
  extraTags: "",
  sort_order: 0,
};

function trackToForm(t: AudioShowcase): TrackForm {
  const tags = Array.isArray(t.tags) ? t.tags : [];
  const view: "instrumental" | "vocal" = tags.includes("vocal") ? "vocal" : "instrumental";
  const extra = tags.filter((x) => x !== "instrumental" && x !== "vocal");
  return {
    slot_key: t.slot_key,
    label: t.label || "",
    subtitle: t.subtitle || "",
    description: t.description || "",
    image_url: t.image_url || "",
    audio_url: t.audio_url || "",
    view,
    extraTags: extra.join(", "),
    sort_order: typeof t.sort_order === "number" ? t.sort_order : 0,
  };
}

function MusicLibraryManager({
  tracks,
  onChanged,
}: {
  tracks: AudioShowcase[];
  onChanged: () => void;
}) {
  const tr = useTranslations("admin.showcases");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TrackForm>(EMPTY_TRACK);
  const [saving, setSaving] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);

  // 依 sort_order 排,sort_order 相同再依曲名穩定排序。
  const sorted = [...tracks].sort(
    (a, b) => (a.sort_order - b.sort_order) || (a.label || "").localeCompare(b.label || "")
  );

  const openNew = () => {
    setEditingId(null);
    // 新曲 sort_order 預設接在最後
    const nextOrder = sorted.length ? Math.max(...sorted.map((t) => t.sort_order)) + 1 : 0;
    setForm({ ...EMPTY_TRACK, sort_order: nextOrder });
    setDialogOpen(true);
  };

  const openEdit = (t: AudioShowcase) => {
    setEditingId(t.id);
    setForm(trackToForm(t));
    setDialogOpen(true);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 50 * 1024 * 1024) {
      toast.error(tr("mlAudioTooLarge"));
      return;
    }
    setUploadingAudio(true);
    try {
      const key = sanitizeSlotKey(form.slot_key) || "track";
      const path = `${MUSIC_LIBRARY_SECTION}/${key}/${Date.now()}-${sanitizeFileName(file.name)}`;
      const url = await uploadToStorage(path, file);
      setForm((f) => ({ ...f, audio_url: url }));
      toast.success(tr("mlAudioUploaded"));
    } catch (err) {
      console.error("Audio upload error:", err);
      toast.error(tr("mlAudioUploadFail"));
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!file.type.startsWith("image/")) {
      toast.error(tr("mlPickImage"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(tr("mlCoverTooLarge"));
      return;
    }
    setUploadingImage(true);
    try {
      const key = sanitizeSlotKey(form.slot_key) || "track";
      const path = `${MUSIC_LIBRARY_SECTION}/${key}/cover-${Date.now()}-${sanitizeFileName(file.name)}`;
      const url = await uploadToStorage(path, file);
      setForm((f) => ({ ...f, image_url: url }));
      toast.success(tr("mlCoverUploaded"));
    } catch (err) {
      console.error("Image upload error:", err);
      toast.error(tr("mlCoverUploadFail"));
    } finally {
      setUploadingImage(false);
    }
  };

  const saveTrack = async (payload: Record<string, unknown>, id?: string) => {
    const res = await fetch("/api/admin/showcases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert", id, section: MUSIC_LIBRARY_SECTION, ...payload }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Request failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const slot_key = sanitizeSlotKey(form.slot_key);
    if (!slot_key) {
      toast.error(tr("mlSlotKeyRequired"));
      return;
    }
    if (!form.label.trim()) {
      toast.error(tr("mlTitleRequired"));
      return;
    }
    // slot_key 不可撞其他曲目(編輯自己那筆除外)
    const clash = tracks.find((t) => t.slot_key === slot_key && t.id !== editingId);
    if (clash) {
      toast.error(tr("mlSlotKeyClash", { slotKey: slot_key }));
      return;
    }
    const tags = [
      form.view,
      ...form.extraTags.split(",").map((t) => t.trim()).filter(Boolean),
    ];
    setSaving(true);
    try {
      await saveTrack(
        {
          slot_key,
          label: form.label.trim(),
          subtitle: form.subtitle.trim() || null,
          description: form.description.trim() || null,
          image_url: form.image_url.trim() || null,
          audio_url: form.audio_url.trim() || null,
          tags,
          sort_order: Number(form.sort_order) || 0,
        },
        editingId || undefined
      );
      toast.success(editingId ? tr("mlUpdated") : tr("mlAdded"));
      setDialogOpen(false);
      setForm(EMPTY_TRACK);
      setEditingId(null);
      onChanged();
    } catch (err) {
      console.error("Save track error:", err);
      toast.error(err instanceof Error ? err.message : tr("mlSaveFail"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: AudioShowcase) => {
    if (!confirm(tr("mlDeleteConfirm", { name: t.label || t.slot_key }))) return;
    setBusyId(t.id);
    try {
      const res = await fetch("/api/admin/showcases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: t.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Request failed");
      }
      toast.success(tr("mlDeleted"));
      onChanged();
    } catch (err) {
      console.error("Delete track error:", err);
      toast.error(tr("mlDeleteFail"));
    } finally {
      setBusyId(null);
    }
  };

  // 上 / 下移:與相鄰曲目對調 sort_order,兩筆各 upsert 一次。
  const move = async (index: number, dir: -1 | 1) => {
    const target = sorted[index];
    const swap = sorted[index + dir];
    if (!target || !swap) return;
    setBusyId(target.id);
    try {
      const toPayload = (t: AudioShowcase, order: number) => ({
        slot_key: t.slot_key,
        label: t.label,
        subtitle: t.subtitle,
        description: t.description,
        image_url: t.image_url,
        audio_url: t.audio_url,
        tags: Array.isArray(t.tags) ? t.tags : [],
        sort_order: order,
      });
      // 對調兩者的 sort_order
      await saveTrack(toPayload(target, swap.sort_order), target.id);
      await saveTrack(toPayload(swap, target.sort_order), swap.id);
      onChanged();
    } catch (err) {
      console.error("Reorder error:", err);
      toast.error(tr("mlReorderFail"));
    } finally {
      setBusyId(null);
    }
  };

  const filledCount = sorted.filter((t) => t.audio_url).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white/50 overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-3">
          <ListMusic className="w-5 h-5 text-cyan-700" />
          <div>
            <h3 className="text-base font-semibold text-gray-900">{tr("mlSectionTitle")}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {tr("mlSectionDesc")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-600 border border-gray-300">
            {filledCount}/{sorted.length} {tr("mlHasAudioSuffix")}
          </span>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-8">
                <Plus className="w-4 h-4" /> {tr("mlAddTrack")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-gray-200">
              <DialogHeader>
                <DialogTitle className="text-gray-900 text-lg">
                  {editingId ? tr("mlEditTrack") : tr("mlAddTrack")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-gray-700 text-xs">Slot Key *</Label>
                    <Input
                      value={form.slot_key}
                      onChange={(e) => setForm({ ...form, slot_key: e.target.value })}
                      placeholder="brand-sting-1"
                      disabled={!!editingId}
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 h-9 text-sm disabled:opacity-60"
                    />
                    <p className="text-[11px] text-gray-500">
                      {tr("mlSlotKeyHint")}{editingId ? tr("mlSlotKeyHintLocked") : tr("mlSlotKeyHintNew")}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-700 text-xs">{tr("mlView")}</Label>
                    <select
                      value={form.view}
                      onChange={(e) => setForm({ ...form, view: e.target.value as "instrumental" | "vocal" })}
                      className="w-full bg-white border border-gray-300 rounded-md text-gray-900 h-9 text-sm px-2"
                    >
                      <option value="instrumental">{tr("mlViewInstrumental")}</option>
                      <option value="vocal">{tr("mlViewVocal")}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-700 text-xs">{tr("mlTitle")}</Label>
                    <Input
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value })}
                      placeholder="Spark Up"
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-700 text-xs">{tr("mlGenre")}</Label>
                    <Input
                      value={form.subtitle}
                      onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                      placeholder={tr("mlGenrePlaceholder")}
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-700 text-xs">{tr("mlSortOrder")}</Label>
                    <Input
                      type="number"
                      value={form.sort_order}
                      onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                      className="bg-white border-gray-300 text-gray-900 h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-700 text-xs">{tr("mlExtraTags")}</Label>
                    <Input
                      value={form.extraTags}
                      onChange={(e) => setForm({ ...form, extraTags: e.target.value })}
                      placeholder={tr("mlExtraTagsPlaceholder")}
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-gray-700 text-xs">{tr("mlStyleDesc")}</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    placeholder={tr("mlStyleDescPlaceholder")}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 text-sm resize-none"
                  />
                </div>

                {/* 封面 */}
                <div className="space-y-2">
                  <Label className="text-gray-700 text-xs">{tr("mlCover")}</Label>
                  <div className="flex items-start gap-4">
                    {form.image_url ? (
                      <div className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={form.image_url} alt={tr("mlCover")} className="w-20 h-20 object-cover rounded-lg border border-gray-300" />
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
                        <ImagePlus className="w-7 h-7 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <input ref={imageFileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={() => imageFileRef.current?.click()}
                        disabled={uploadingImage}
                        className="bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 gap-2"
                      >
                        {uploadingImage
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {tr("mlUploading")}</>
                          : <><ImagePlus className="w-3.5 h-3.5" /> {tr("mlUploadCover")}</>}
                      </Button>
                      <p className="text-[11px] text-gray-500">
                        {tr("mlCoverHintPrefix")} music-samples/covers/{"{slot_key}"}.jpg{tr("mlCoverHintSuffix")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 音檔 */}
                <div className="space-y-2">
                  <Label className="text-gray-700 text-xs">{tr("mlPreviewAudio")}</Label>
                  <div className="flex items-center gap-3 flex-wrap">
                    {form.audio_url && <AudioPreview url={form.audio_url} />}
                    <input ref={audioFileRef} type="file" accept=".mp3,.wav,.aiff,.flac,audio/*" onChange={handleAudioUpload} className="hidden" />
                    <Button
                      type="button" variant="outline" size="sm"
                      onClick={() => audioFileRef.current?.click()}
                      disabled={uploadingAudio}
                      className="bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 gap-2"
                    >
                      {uploadingAudio
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {tr("mlUploading")}</>
                        : <><Upload className="w-3.5 h-3.5" /> {form.audio_url ? tr("mlReplaceAudio") : tr("mlUploadAudio")}</>}
                    </Button>
                  </div>
                  <p className="text-[11px] text-gray-500">{tr("mlAudioFormatHint")}</p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button" variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
                  >
                    {tr("mlCancel")}
                  </Button>
                  <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-w-[110px]">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {tr("mlSaving")}</> : tr("mlSaveTrack")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="px-6 py-4">
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            {tr("mlEmpty")}
          </p>
        ) : (
          <div className="space-y-2">
            {sorted.map((t, i) => {
              const tags = Array.isArray(t.tags) ? t.tags : [];
              const view = tags.includes("vocal") ? "Vocal" : "Instrumental";
              const rowBusy = busyId === t.id;
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white"
                >
                  {/* 上下移 */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || rowBusy}
                      className="text-gray-400 hover:text-gray-800 disabled:opacity-30"
                      title={tr("mlMoveUp")}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === sorted.length - 1 || rowBusy}
                      className="text-gray-400 hover:text-gray-800 disabled:opacity-30"
                      title={tr("mlMoveDown")}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 封面縮圖(有 image_url 才顯示,避免打 404) */}
                  {t.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.image_url} alt={t.label || t.slot_key} className="w-11 h-11 rounded-md object-cover border border-gray-200 shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                      <Music className="w-5 h-5 text-gray-400" />
                    </div>
                  )}

                  {/* 主資訊 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{t.label || tr("mlUnnamed")}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200 shrink-0">{view}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      <span className="font-mono">{t.slot_key}</span>
                      {t.subtitle ? ` · ${t.subtitle}` : ""}
                      {` · #${t.sort_order}`}
                    </p>
                  </div>

                  {/* 音檔試聽 */}
                  {t.audio_url ? (
                    <AudioPreview url={t.audio_url} />
                  ) : (
                    <span className="text-[11px] text-amber-600">{tr("mlNoAudio")}</span>
                  )}

                  {/* 動作 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {rowBusy && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => openEdit(t)}
                      className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-8 w-8 p-0"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => handleDelete(t)}
                      disabled={rowBusy}
                      className="text-gray-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const FETCH_TIMEOUT_MS = 20_000;

export default function AdminShowcasesPage() {
  const t = useTranslations("admin.showcases");
  const [showcases, setShowcases] = useState<AudioShowcase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["featured_voices"])
  );

  const fetchShowcases = async () => {
    setLoadError(null);
    setLoading(true);

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    ) {
      const msg = t("errMissingEnv");
      console.error(msg);
      setLoadError(msg);
      toast.error(t("toastSupabaseNotConfigured"));
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await Promise.race([
        supabase
          .from("audio_showcases")
          .select("*")
          .order("sort_order", { ascending: true }),
        new Promise<{ data: null; error: { message: string } }>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  t("errTimeout", { seconds: FETCH_TIMEOUT_MS / 1000 })
                )
              ),
            FETCH_TIMEOUT_MS
          );
        }),
      ]);

      if (error) throw error;
      setShowcases(data || []);
    } catch (err) {
      console.error("Error fetching showcases:", err);
      const message =
        err instanceof Error ? err.message : "Failed to load showcases";
      setLoadError(message);
      toast.error(t("toastLoadFail"));
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-4">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        <p className="text-sm text-gray-500 text-center max-w-md">
          {t("loadingHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 text-gray-900">
      {loadError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-950/40 px-4 py-3 text-sm text-red-700">
          <p className="font-medium text-red-100 mb-1">{t("loadFailTitle")}</p>
          <p className="text-red-700/90 mb-3">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchShowcases()}
            className="border-red-300 text-red-100 hover:bg-red-900/50"
          >
            {t("retry")}
          </Button>
        </div>
      )}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Volume2 className="w-6 h-6 text-cyan-700" />
          {t("pageTitle")}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {t("pageSubtitle")}
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
              className="rounded-xl border border-gray-200 bg-white/50 overflow-hidden"
            >
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-100/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  )}
                  <div className="text-left">
                    <h3 className="text-base font-semibold text-gray-900">
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
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : filledCount > 0
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-gray-200 text-gray-600 border border-gray-400"
                    }`}
                  >
                    {filledCount}/{section.slots.length} {t("audioSuffix")}
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

        {/* 音樂庫(不定數量清單型,獨立於上面固定 slot 區塊) */}
        <MusicLibraryManager
          tracks={showcases.filter((s) => s.section === "music_library")}
          onChanged={fetchShowcases}
        />
      </div>
    </div>
  );
}
