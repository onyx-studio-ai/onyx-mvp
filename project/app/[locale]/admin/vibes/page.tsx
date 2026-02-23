"use client";

import { useState, useEffect, useRef } from "react";
import { supabase, type Vibe } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Edit, Trash2, Upload, X, Loader2, Music, ImagePlus, Play, Pause,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadToStorage(bucket: string, path: string, file: File): Promise<string> {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { error } = await client.storage.from(bucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function AudioPlayer({ url }: { url: string }) {
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
    <>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} />
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center hover:bg-cyan-500/30 transition-colors"
      >
        {playing ? (
          <Pause className="w-3.5 h-3.5 text-cyan-400" />
        ) : (
          <Play className="w-3.5 h-3.5 text-cyan-400 ml-0.5" />
        )}
      </button>
    </>
  );
}

export default function AdminVibesPage() {
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVibe, setEditingVibe] = useState<Vibe | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    genre: "",
    description: "",
    image_url: "",
    audio_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const imageRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchVibes();
  }, []);

  const fetchVibes = async () => {
    try {
      const { data, error } = await supabase
        .from("vibes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setVibes(data || []);
    } catch (err) {
      console.error("Error fetching vibes:", err);
      toast.error("Failed to load vibes");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }

    setUploadingImage(true);
    try {
      const safeName = sanitizeFileName(file.name);
      const path = `vibes/images/${Date.now()}-${safeName}`;
      const url = await uploadToStorage("showcases", path, file);
      setFormData((prev) => ({ ...prev, image_url: url }));
      toast.success("Image uploaded");
    } catch (err) {
      console.error("Image upload error:", err);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Audio file must be under 50 MB");
      return;
    }

    setUploadingAudio(true);
    try {
      const safeName = sanitizeFileName(file.name);
      const path = `vibes/audio/${Date.now()}-${safeName}`;
      const url = await uploadToStorage("showcases", path, file);
      setFormData((prev) => ({ ...prev, audio_url: url }));
      toast.success("Audio uploaded");
    } catch (err) {
      console.error("Audio upload error:", err);
      toast.error("Failed to upload audio");
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.genre) {
      toast.error("Title and genre are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formData.title,
        genre: formData.genre,
        description: formData.description,
        image_url: formData.image_url,
        audio_url: formData.audio_url,
      };

      if (editingVibe) {
        const { error } = await supabase
          .from("vibes")
          .update(payload)
          .eq("id", editingVibe.id);
        if (error) throw error;
        toast.success("Vibe updated");
      } else {
        const { error } = await supabase.from("vibes").insert([payload]);
        if (error) throw error;
        toast.success("Vibe created");
      }

      setDialogOpen(false);
      resetForm();
      fetchVibes();
    } catch (err) {
      console.error("Error saving vibe:", err);
      toast.error("Failed to save vibe");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (vibe: Vibe) => {
    setEditingVibe(vibe);
    setFormData({
      title: vibe.title,
      genre: vibe.genre,
      description: vibe.description || "",
      image_url: vibe.image_url || "",
      audio_url: vibe.audio_url || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this vibe?")) return;
    try {
      const { error } = await supabase.from("vibes").delete().eq("id", id);
      if (error) throw error;
      toast.success("Vibe deleted");
      fetchVibes();
    } catch (err) {
      console.error("Error deleting vibe:", err);
      toast.error("Failed to delete vibe");
    }
  };

  const resetForm = () => {
    setEditingVibe(null);
    setFormData({
      title: "",
      genre: "",
      description: "",
      image_url: "",
      audio_url: "",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 text-white">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Music className="w-6 h-6 text-cyan-400" />
            Vibes Management
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {vibes.length} instrumental vibes in catalog
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={resetForm}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Vibe
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-white text-lg">
                {editingVibe ? "Edit Vibe" : "Add New Vibe"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-gray-300">Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    required
                    placeholder="e.g. Corporate / Uplifting"
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-gray-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300">Genre *</Label>
                  <Input
                    value={formData.genre}
                    onChange={(e) =>
                      setFormData({ ...formData, genre: e.target.value })
                    }
                    required
                    placeholder="e.g. BGM, Cinematic, Folk"
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-gray-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-300">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                  placeholder="Short description of this vibe..."
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-gray-600 resize-none"
                />
              </div>

              {/* Cover Image */}
              <div className="space-y-2">
                <Label className="text-gray-300">Cover Image</Label>
                <div className="flex items-start gap-4">
                  {formData.image_url ? (
                    <div className="relative group">
                      <img
                        src={formData.image_url}
                        alt="Cover"
                        className="w-24 h-24 object-cover rounded-xl border border-zinc-700"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, image_url: "" }))
                        }
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-xl border-2 border-dashed border-zinc-700 flex items-center justify-center bg-zinc-900">
                      <ImagePlus className="w-8 h-8 text-zinc-600" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <input
                      ref={imageRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => imageRef.current?.click()}
                      disabled={uploadingImage}
                      className="bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700 gap-2"
                    >
                      {uploadingImage ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                          Uploading...
                        </>
                      ) : (
                        <>
                          <ImagePlus className="w-3.5 h-3.5" /> Upload Image
                        </>
                      )}
                    </Button>
                    <p className="text-[11px] text-gray-400">
                      JPG, PNG, WebP. Max 10 MB.
                    </p>
                  </div>
                </div>
              </div>

              {/* Audio File */}
              <div className="space-y-2">
                <Label className="text-gray-300">Audio File</Label>
                <div className="flex items-center gap-3">
                  {formData.audio_url && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800">
                      <Music className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-gray-300 truncate max-w-[180px]">
                        {formData.audio_url.split("/").pop()}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, audio_url: "" }))
                        }
                        className="text-zinc-500 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <input
                    ref={audioRef}
                    type="file"
                    accept=".mp3,.wav,.aiff,.flac,audio/*"
                    onChange={handleAudioUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => audioRef.current?.click()}
                    disabled={uploadingAudio}
                    className="bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700 gap-2"
                  >
                    {uploadingAudio ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />{" "}
                        {formData.audio_url ? "Replace Audio" : "Upload Audio"}
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400">
                  MP3, WAV, AIFF, FLAC. Max 50 MB.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-w-[120px]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save Vibe"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <p className="text-2xl font-bold text-white">{vibes.length}</p>
          <p className="text-xs text-gray-400 mt-1">Total Vibes</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <p className="text-2xl font-bold text-emerald-400">
            {vibes.filter((v) => v.audio_url).length}
          </p>
          <p className="text-xs text-gray-400 mt-1">With Audio</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <p className="text-2xl font-bold text-cyan-400">
            {new Set(vibes.map((v) => v.genre)).size}
          </p>
          <p className="text-xs text-gray-400 mt-1">Genres</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <p className="text-2xl font-bold text-amber-400">
            {vibes.filter((v) => v.image_url).length}
          </p>
          <p className="text-xs text-gray-400 mt-1">With Cover</p>
        </div>
      </div>

      {/* Vibes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vibes.map((vibe) => (
          <div
            key={vibe.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden group"
          >
            <div className="relative h-40 bg-zinc-800">
              {vibe.image_url ? (
                <img
                  src={vibe.image_url}
                  alt={vibe.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-12 h-12 text-zinc-600" />
                </div>
              )}
              {vibe.audio_url && (
                <div className="absolute bottom-3 right-3">
                  <AudioPlayer url={vibe.audio_url} />
                </div>
              )}
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{vibe.title}</h3>
                  <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] mt-1">
                    {vibe.genre}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(vibe)}
                    className="text-gray-400 hover:text-white hover:bg-zinc-700 h-8 w-8 p-0"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(vibe.id)}
                    className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {vibe.description && (
                <p className="text-xs text-gray-400 line-clamp-2">
                  {vibe.description}
                </p>
              )}
            </div>
          </div>
        ))}
        {vibes.length === 0 && (
          <div className="col-span-full text-center py-16 text-gray-400">
            No vibes yet. Click &ldquo;Add Vibe&rdquo; to get started.
          </div>
        )}
      </div>
    </div>
  );
}
