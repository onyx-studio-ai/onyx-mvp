"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { type Talent } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Edit, Trash2, Upload, X, Send, CheckCircle, Clock,
  Shield, Loader2, ExternalLink, ImagePlus, Music, User, Search,
  FileText, DollarSign, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";

const ALL_LANGUAGES = [
  "Afrikaans", "Albanian", "Amharic", "Arabic", "Arabic (Egyptian)", "Arabic (Gulf)", "Arabic (Levantine)", "Arabic (Maghreb)",
  "Armenian", "Azerbaijani", "Basque", "Belarusian", "Bengali", "Bosnian", "Bulgarian", "Burmese",
  "Catalan", "Cebuano", "Chinese (Cantonese)", "Chinese (Mandarin)", "Chinese (Taiwanese Mandarin)", "Chinese (Shanghainese)",
  "Croatian", "Czech", "Danish", "Dutch", "English (US)", "English (UK)", "English (Australian)", "English (Irish)",
  "English (Scottish)", "English (South African)", "English (Indian)", "English (Singaporean)",
  "Estonian", "Farsi (Persian)", "Filipino (Tagalog)", "Finnish", "French", "French (Canadian)", "French (Belgian)",
  "Galician", "Georgian", "German", "German (Austrian)", "German (Swiss)", "Greek",
  "Gujarati", "Haitian Creole", "Hausa", "Hebrew", "Hindi", "Hungarian",
  "Icelandic", "Igbo", "Indonesian", "Italian", "Japanese",
  "Javanese", "Kannada", "Kazakh", "Khmer", "Korean", "Kurdish",
  "Lao", "Latvian", "Lithuanian", "Luxembourgish",
  "Macedonian", "Malagasy", "Malay", "Malayalam", "Maltese", "Maori",
  "Marathi", "Mongolian", "Nepali", "Norwegian",
  "Odia", "Pashto", "Polish", "Portuguese (Brazilian)", "Portuguese (European)", "Punjabi",
  "Romanian", "Russian", "Samoan", "Serbian", "Sinhala", "Slovak", "Slovenian",
  "Somali", "Spanish (Castilian)", "Spanish (Latin American)", "Spanish (Mexican)", "Swahili",
  "Swedish", "Tamil", "Telugu", "Thai", "Tibetan", "Turkish",
  "Ukrainian", "Urdu", "Uzbek", "Vietnamese", "Welsh", "Xhosa", "Yoruba", "Zulu",
];

const ALL_ACCENTS = [
  // English
  "American (General)", "American (Southern)", "American (New York)", "American (Midwest)", "American (California)",
  "British (RP)", "British (Cockney)", "British (Northern)", "British (West Country)", "British (Midlands)",
  "Australian", "New Zealand", "Irish", "Scottish", "Welsh", "South African", "Canadian",
  "Singaporean English", "Indian English", "Filipino English", "Nigerian English", "Jamaican English",
  // Chinese
  "Beijing Mandarin", "Taiwanese Mandarin", "Cantonese-accented Mandarin", "Sichuan Mandarin", "Shanghainese Mandarin",
  "Hong Kong Cantonese", "Guangdong Cantonese",
  // Spanish
  "Castilian Spanish", "Latin American Spanish", "Mexican Spanish", "Argentine Spanish", "Colombian Spanish", "Chilean Spanish",
  // French
  "Parisian French", "Canadian French", "Belgian French", "Swiss French", "African French",
  // German
  "Standard German", "Austrian German", "Swiss German", "Bavarian German",
  // Portuguese
  "Brazilian Portuguese", "European Portuguese",
  // Japanese
  "Tokyo Japanese", "Kansai Japanese", "Kyushu Japanese",
  // Korean
  "Seoul Korean", "Busan Korean",
  // Italian
  "Northern Italian", "Southern Italian", "Sicilian Italian",
  // Russian
  "Moscow Russian", "St. Petersburg Russian",
  // Arabic
  "Standard Arabic (MSA)", "Egyptian Arabic", "Gulf Arabic", "Levantine Arabic", "Maghreb Arabic",
  // Hindi & South Asian
  "Standard Hindi", "Mumbai Hindi", "Delhi Hindi",
  "Tamil (Chennai)", "Tamil (Sri Lankan)",
  "Bengali (Kolkata)", "Bengali (Dhaka)",
  // Southeast Asian
  "Thai (Central)", "Thai (Northern)", "Vietnamese (Hanoi)", "Vietnamese (Saigon)",
  "Indonesian (Jakarta)", "Malay (Standard)",
  // Other
  "Turkish (Istanbul)", "Turkish (Anatolian)",
  "Dutch (Netherlands)", "Dutch (Flemish)",
  "Swedish (Standard)", "Norwegian (Bokmål)", "Danish (Standard)", "Finnish (Standard)",
  "Polish (Standard)", "Czech (Standard)", "Hungarian (Standard)", "Romanian (Standard)",
  "Greek (Standard)",
  "Farsi (Tehran)", "Farsi (Afghan Dari)",
  "Urdu (Standard)", "Punjabi (Standard)",
  "Swahili (Standard)",
  "Neutral / No specific accent",
];

const AVAILABLE_TAGS = [
  "Warm", "Corporate", "Friendly", "Professional", "Energetic",
  "Calm", "Conversational", "Authoritative", "Narrative", "Dramatic",
  "Rock", "Pop", "Jazz", "Classical", "R&B", "Country",
  "High-range", "Deep", "Smooth", "Powerful", "Raspy", "Breathy",
];

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function uploadToStorage(bucket: string, path: string, file: File): Promise<string> {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { error } = await client.storage.from(bucket).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function SearchableMultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = "Search...",
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => options.filter(o => o.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="space-y-2">
      <Label className="text-gray-300">{label}</Label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(item => (
            <Badge key={item} className="bg-zinc-700 text-gray-200 border-zinc-600 hover:bg-zinc-600 text-xs gap-1 pr-1">
              {item}
              <button type="button" onClick={() => onChange(selected.filter(s => s !== item))} className="ml-0.5 hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div ref={ref} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="bg-zinc-900 border-zinc-700 text-white placeholder:text-gray-600 pl-9 h-9 text-sm"
          />
        </div>
        {open && (
          <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-500 p-3">No results</p>
            ) : (
              filtered.map(item => {
                const isSelected = selected.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      onChange(isSelected ? selected.filter(s => s !== item) : [...selected, item]);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-800 flex items-center gap-2 transition-colors ${
                      isSelected ? "text-emerald-400" : "text-gray-300"
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                      isSelected ? "bg-emerald-500 border-emerald-500" : "border-zinc-600"
                    }`}>
                      {isSelected && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                    </div>
                    {item}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Search...",
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => options.filter(o => o.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="space-y-2">
      <Label className="text-gray-300">{label}</Label>
      {value && (
        <div className="flex items-center gap-1.5 mb-1">
          <Badge className="bg-zinc-700 text-gray-200 border-zinc-600 text-xs gap-1 pr-1">
            {value}
            <button type="button" onClick={() => onChange("")} className="ml-0.5 hover:text-red-400">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        </div>
      )}
      <div ref={ref} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="bg-zinc-900 border-zinc-700 text-white placeholder:text-gray-600 pl-9 h-9 text-sm"
          />
        </div>
        {open && (
          <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-500 p-3">No results</p>
            ) : (
              filtered.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => { onChange(item); setOpen(false); setSearch(""); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-800 transition-colors ${
                    value === item ? "text-emerald-400" : "text-gray-300"
                  }`}
                >
                  {item}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminTalentsPage() {
  const [talents, setTalents] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTalent, setEditingTalent] = useState<Talent | null>(null);
  const [formData, setFormData] = useState({
    type: "VO",
    name: "",
    email: "",
    gender: "",
    accent: "",
    languages: [] as string[],
    category: "in_house",
    tags: [] as string[],
    bio: "",
    internal_cost: 0,
    is_active: true,
    sort_order: 0,
    headshot_url: "",
    demo_urls: [] as Array<{ name: string; url: string }>,
    payment_method: "" as string,
    payment_details: {
      paypal_email: "",
      bank_name: "",
      bank_code: "",
      account_name: "",
      account_number: "",
      swift_code: "",
      notes: "",
    },
  });
  const [saving, setSaving] = useState(false);
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [uploadingDemo, setUploadingDemo] = useState(false);
  const [newDemoName, setNewDemoName] = useState("");
  const [sendingVoiceId, setSendingVoiceId] = useState<string | null>(null);
  const [verifyingVoiceId, setVerifyingVoiceId] = useState<string | null>(null);

  const headshotRef = useRef<HTMLInputElement>(null);
  const demoRef = useRef<HTMLInputElement>(null);

  const handleVerifyVoiceId = async (talentId: string) => {
    setVerifyingVoiceId(talentId);
    try {
      const res = await fetch('/api/admin/talents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: talentId, voice_id_status: 'verified' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Voice ID verified successfully');
      fetchTalents();
    } catch {
      toast.error('Failed to verify Voice ID');
    } finally {
      setVerifyingVoiceId(null);
    }
  };

  const handleSendVoiceIdRequest = async (talentId: string) => {
    setSendingVoiceId(talentId);
    try {
      const res = await fetch('/api/admin/voice-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ talentId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Voice ID request sent (${data.vidNumber})`);
        fetchTalents();
      } else {
        toast.error(data.error || 'Failed to send request');
      }
    } catch {
      toast.error('Failed to send Voice ID request');
    } finally {
      setSendingVoiceId(null);
    }
  };

  useEffect(() => {
    fetchTalents();
  }, []);

  const fetchTalents = async () => {
    try {
      const res = await fetch('/api/admin/talents');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTalents(data || []);
    } catch (error) {
      console.error("Error fetching talents:", error);
      toast.error("Failed to load talents");
    } finally {
      setLoading(false);
    }
  };

  const handleHeadshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }

    setUploadingHeadshot(true);
    try {
      const safeName = sanitizeFileName(file.name);
      const path = `headshots/${Date.now()}-${safeName}`;
      const url = await uploadToStorage('talent-assets', path, file);
      setFormData(prev => ({ ...prev, headshot_url: url }));
      toast.success('Headshot uploaded');
    } catch (err) {
      console.error('Headshot upload error:', err);
      toast.error('Failed to upload headshot');
    } finally {
      setUploadingHeadshot(false);
    }
  };

  const handleDemoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/aiff', 'audio/flac', 'audio/mp3', 'audio/x-wav'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|aiff|flac)$/i)) {
      toast.error('Please select an audio file (MP3, WAV, AIFF, FLAC)');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Audio file must be under 20 MB');
      return;
    }

    setUploadingDemo(true);
    try {
      const safeName = sanitizeFileName(file.name);
      const path = `demos/${Date.now()}-${safeName}`;
      const url = await uploadToStorage('talent-assets', path, file);
      const label = newDemoName.trim() || file.name.replace(/\.[^.]+$/, '');
      setFormData(prev => ({
        ...prev,
        demo_urls: [...prev.demo_urls, { name: label, url }],
      }));
      setNewDemoName('');
      toast.success('Demo uploaded');
    } catch (err) {
      console.error('Demo upload error:', err);
      toast.error('Failed to upload demo');
    } finally {
      setUploadingDemo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const talentData = {
        type: formData.type,
        name: formData.name,
        email: formData.email.trim() || null,
        gender: formData.gender || null,
        accent: formData.accent || null,
        languages: formData.languages,
        category: formData.category,
        tags: formData.tags,
        bio: formData.bio,
        internal_cost: formData.internal_cost,
        is_active: formData.is_active,
        sort_order: formData.sort_order,
        headshot_url: formData.headshot_url || null,
        demo_urls: formData.demo_urls,
        payment_method: formData.payment_method || null,
        payment_details: formData.payment_method ? formData.payment_details : null,
      };

      if (editingTalent) {
        const res = await fetch('/api/admin/talents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTalent.id, ...talentData }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update');
        }
        toast.success("Talent updated successfully");
      } else {
        const res = await fetch('/api/admin/talents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(talentData),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create');
        }
        toast.success("Talent created successfully");
      }

      setDialogOpen(false);
      resetForm();
      fetchTalents();
    } catch (error) {
      console.error("Error saving talent:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save talent");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (talent: Talent) => {
    setEditingTalent(talent);
    const pd = talent.payment_details as Record<string, string> | null;
    setFormData({
      type: talent.type,
      name: talent.name,
      email: talent.email || "",
      gender: talent.gender || "",
      accent: talent.accent || "",
      languages: talent.languages || [],
      category: talent.category,
      tags: talent.tags || [],
      bio: talent.bio || "",
      internal_cost: talent.internal_cost,
      is_active: talent.is_active,
      sort_order: talent.sort_order,
      headshot_url: talent.headshot_url || "",
      demo_urls: talent.demo_urls || [],
      payment_method: talent.payment_method || "",
      payment_details: {
        paypal_email: pd?.paypal_email || "",
        bank_name: pd?.bank_name || "",
        bank_code: pd?.bank_code || "",
        account_name: pd?.account_name || "",
        account_number: pd?.account_number || "",
        swift_code: pd?.swift_code || "",
        notes: pd?.notes || "",
      },
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this talent?")) return;
    try {
      const res = await fetch(`/api/admin/talents?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success("Talent deleted successfully");
      fetchTalents();
    } catch (error) {
      console.error("Error deleting talent:", error);
      toast.error("Failed to delete talent");
    }
  };

  const resetForm = () => {
    setEditingTalent(null);
    setFormData({
      type: "VO",
      name: "",
      email: "",
      gender: "",
      accent: "",
      languages: [],
      category: "in_house",
      tags: [],
      bio: "",
      internal_cost: 0,
      is_active: true,
      sort_order: 0,
      headshot_url: "",
      demo_urls: [],
      payment_method: "",
      payment_details: {
        paypal_email: "",
        bank_name: "",
        bank_code: "",
        account_name: "",
        account_number: "",
        swift_code: "",
        notes: "",
      },
    });
    setNewDemoName("");
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const removeDemo = (index: number) => {
    setFormData(prev => ({
      ...prev,
      demo_urls: prev.demo_urls.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 text-white">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Talent Management</h1>
          <p className="text-gray-500 text-sm mt-1">{talents.length} talents registered</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Plus className="w-4 h-4" />
              Add Talent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800 text-white">
            <DialogHeader>
              <DialogTitle className="text-white text-lg">
                {editingTalent ? "Edit Talent" : "Add New Talent"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Row 1: Type, Name, Email */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={v => setFormData({ ...formData, type: v })}
                  >
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                      <SelectItem value="VO" className="text-white hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white">Voice Actor (VO)</SelectItem>
                      <SelectItem value="Singer" className="text-white hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white">Singer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g. Alex Chen"
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-gray-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Email *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="talent@email.com"
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-gray-600"
                  />
                  <p className="text-[11px] text-gray-500">Required for Voice ID & contract</p>
                </div>
              </div>

              {/* Row 2: Gender, Category */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Gender *</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={v => setFormData({ ...formData, gender: v })}
                  >
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                      <SelectItem value="Male" className="text-white hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white">Male</SelectItem>
                      <SelectItem value="Female" className="text-white hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white">Female</SelectItem>
                      <SelectItem value="Non-binary" className="text-white hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white">Non-binary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={v => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                      <SelectItem value="in_house" className="text-white hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white">In-house</SelectItem>
                      <SelectItem value="featured" className="text-white hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white">Featured</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Internal Cost (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.internal_cost}
                    onChange={e => setFormData({ ...formData, internal_cost: parseFloat(e.target.value) || 0 })}
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                  <p className="text-[11px] text-gray-500">Client sees: flat $499</p>
                </div>
              </div>

              {/* Sort Order */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Sort Order</Label>
                  <Input
                    type="number"
                    value={formData.sort_order}
                    onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                </div>
              </div>

              {/* Headshot Upload */}
              <div className="space-y-2">
                <Label className="text-gray-300">Headshot Photo</Label>
                <div className="flex items-start gap-4">
                  {formData.headshot_url ? (
                    <div className="relative group">
                      <img
                        src={formData.headshot_url}
                        alt="Headshot"
                        className="w-24 h-24 object-cover rounded-xl border border-zinc-700"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, headshot_url: '' }))}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-xl border-2 border-dashed border-zinc-700 flex items-center justify-center bg-zinc-900">
                      <User className="w-8 h-8 text-zinc-600" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <input
                      ref={headshotRef}
                      type="file"
                      accept="image/*"
                      onChange={handleHeadshotUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => headshotRef.current?.click()}
                      disabled={uploadingHeadshot}
                      className="border-zinc-700 text-gray-300 hover:bg-zinc-800 gap-2"
                    >
                      {uploadingHeadshot ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                      ) : (
                        <><ImagePlus className="w-3.5 h-3.5" /> Upload Photo</>
                      )}
                    </Button>
                    <p className="text-[11px] text-gray-500">JPG, PNG, WebP. Max 5 MB.</p>
                  </div>
                </div>
              </div>

              {/* Languages (searchable multi-select) */}
              <SearchableMultiSelect
                label="Languages"
                options={ALL_LANGUAGES}
                selected={formData.languages}
                onChange={langs => setFormData(prev => ({ ...prev, languages: langs }))}
                placeholder="Search languages..."
              />

              {/* Accent (searchable single-select) */}
              <SearchableSelect
                label="Accent / Dialect"
                options={ALL_ACCENTS}
                value={formData.accent}
                onChange={val => setFormData(prev => ({ ...prev, accent: val }))}
                placeholder="Search accents..."
              />

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-gray-300">Tags & Characteristics</Label>
                <div className="grid grid-cols-4 gap-x-4 gap-y-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  {AVAILABLE_TAGS.map(tag => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.tags.includes(tag)}
                        onCheckedChange={() => toggleTag(tag)}
                        className="border-zinc-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                      <label className="text-sm text-gray-300 cursor-pointer" onClick={() => toggleTag(tag)}>{tag}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Biography */}
              <div className="space-y-2">
                <Label className="text-gray-300">Biography</Label>
                <Textarea
                  value={formData.bio}
                  onChange={e => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  placeholder="Short bio or description of the talent..."
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-gray-600 resize-y"
                />
              </div>

              {/* Audio Demos */}
              <div className="space-y-3">
                <Label className="text-gray-300">Audio Demos</Label>

                {formData.demo_urls.length > 0 && (
                  <div className="space-y-2">
                    {formData.demo_urls.map((demo, index) => (
                      <div key={index} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                        <Music className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{demo.name}</p>
                          <p className="text-[11px] text-gray-500 truncate">{demo.url}</p>
                        </div>
                        <a href={demo.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0">
                          Preview
                        </a>
                        <button type="button" onClick={() => removeDemo(index)} className="text-zinc-500 hover:text-red-400 p-1 flex-shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] text-gray-500">Demo Label (optional)</label>
                    <Input
                      type="text"
                      value={newDemoName}
                      onChange={e => setNewDemoName(e.target.value)}
                      placeholder="e.g. Pop Demo, Corporate Reel"
                      className="bg-zinc-900 border-zinc-700 text-white placeholder:text-gray-600 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <input
                      ref={demoRef}
                      type="file"
                      accept=".mp3,.wav,.aiff,.flac,audio/*"
                      onChange={handleDemoUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => demoRef.current?.click()}
                      disabled={uploadingDemo}
                      className="border-zinc-700 text-gray-300 hover:bg-zinc-800 gap-2 h-9"
                    >
                      {uploadingDemo ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="w-3.5 h-3.5" /> Upload Audio</>
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500">MP3, WAV, AIFF, FLAC. Max 20 MB per file.</p>
              </div>

              {/* Payment Info */}
              <div className="space-y-3 pt-3 border-t border-zinc-800">
                <Label className="text-gray-300 font-semibold text-sm">Payment Information</Label>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-xs">Payment Method</Label>
                  <Select
                    value={formData.payment_method || "none"}
                    onValueChange={v => setFormData({ ...formData, payment_method: v === "none" ? "" : v })}
                  >
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="none" className="text-white hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white">Not Set</SelectItem>
                      <SelectItem value="paypal" className="text-white hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white">PayPal</SelectItem>
                      <SelectItem value="bank_transfer" className="text-white hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.payment_method === "paypal" && (
                  <div className="space-y-2">
                    <Label className="text-gray-400 text-xs">PayPal Email</Label>
                    <Input
                      type="email"
                      placeholder="talent@example.com"
                      value={formData.payment_details.paypal_email}
                      onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, paypal_email: e.target.value } })}
                      className="bg-zinc-900 border-zinc-700 text-white"
                    />
                  </div>
                )}

                {formData.payment_method === "bank_transfer" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-gray-400 text-xs">Bank Name</Label>
                        <Input
                          placeholder="e.g. 中國信託、HSBC"
                          value={formData.payment_details.bank_name}
                          onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, bank_name: e.target.value } })}
                          className="bg-zinc-900 border-zinc-700 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-400 text-xs">Bank Code / Branch</Label>
                        <Input
                          placeholder="e.g. 822 / SWIFT"
                          value={formData.payment_details.bank_code}
                          onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, bank_code: e.target.value } })}
                          className="bg-zinc-900 border-zinc-700 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-gray-400 text-xs">Account Name</Label>
                        <Input
                          placeholder="Account holder name"
                          value={formData.payment_details.account_name}
                          onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, account_name: e.target.value } })}
                          className="bg-zinc-900 border-zinc-700 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-400 text-xs">Account Number</Label>
                        <Input
                          placeholder="Account number"
                          value={formData.payment_details.account_number}
                          onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, account_number: e.target.value } })}
                          className="bg-zinc-900 border-zinc-700 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-gray-400 text-xs">SWIFT Code (international)</Label>
                        <Input
                          placeholder="e.g. CTCBTWTP"
                          value={formData.payment_details.swift_code}
                          onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, swift_code: e.target.value } })}
                          className="bg-zinc-900 border-zinc-700 text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.payment_method && (
                  <div className="space-y-1">
                    <Label className="text-gray-400 text-xs">Notes</Label>
                    <Input
                      placeholder="Any special instructions..."
                      value={formData.payment_details.notes}
                      onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, notes: e.target.value } })}
                      className="bg-zinc-900 border-zinc-700 text-white"
                    />
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center space-x-3 pt-2 border-t border-zinc-800">
                <Checkbox
                  checked={formData.is_active}
                  onCheckedChange={checked => setFormData({ ...formData, is_active: checked as boolean })}
                  className="border-zinc-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
                <Label className="text-gray-300">Active — visible in talent catalog</Label>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-zinc-700 text-gray-300 hover:bg-zinc-800">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-w-[120px]">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Talent'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-gray-400 font-semibold">Name</TableHead>
              <TableHead className="text-gray-400 font-semibold">Type</TableHead>
              <TableHead className="text-gray-400 font-semibold">Source</TableHead>
              <TableHead className="text-gray-400 font-semibold">Languages</TableHead>
              <TableHead className="text-gray-400 font-semibold">Price</TableHead>
              <TableHead className="text-gray-400 font-semibold">Earnings</TableHead>
              <TableHead className="text-gray-400 font-semibold">Voice ID</TableHead>
              <TableHead className="text-gray-400 font-semibold">Status</TableHead>
              <TableHead className="text-gray-400 font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {talents.map((talent) => (
              <TableRow key={talent.id} className="border-zinc-800 hover:bg-zinc-800/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    {talent.headshot_url ? (
                      <img src={talent.headshot_url} alt="" className="w-8 h-8 rounded-full object-cover border border-zinc-700" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                        <User className="w-4 h-4 text-zinc-500" />
                      </div>
                    )}
                    <span className="font-medium text-white">{talent.name || 'N/A'}</span>
                  </div>
                </TableCell>
                <TableCell className="capitalize text-gray-300">
                  {talent.type === 'Singer' || talent.type === 'singer' ? 'Singer' : talent.type === 'VO' || talent.type === 'voice_actor' ? 'Voice Actor' : talent.type?.replace("_", " ") || 'N/A'}
                </TableCell>
                <TableCell>
                  {(talent as any).application_id ? (
                    <a
                      href="/admin/applications"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                      Application
                      <ArrowUpRight className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-700/50 text-gray-400 border border-zinc-600/50">
                      Manual
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {talent.languages && talent.languages.length > 0 ? (
                      <>
                        {talent.languages.slice(0, 2).map(lang => (
                          <Badge key={lang} className="bg-zinc-700 text-gray-200 border-zinc-600 hover:bg-zinc-600 text-[11px]">{lang}</Badge>
                        ))}
                        {talent.languages.length > 2 && (
                          <Badge className="bg-zinc-700 text-gray-200 border-zinc-600 text-[11px]">+{talent.languages.length - 2}</Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-600 text-sm">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-white font-semibold">$499</span>
                  <span className="text-xs text-gray-500 block">(Cost: ${(talent.internal_cost || 0).toFixed(0)})</span>
                </TableCell>
                <TableCell>
                  {(() => {
                    const es = (talent as any).earnings_summary;
                    if (!es) return <span className="text-gray-600 text-sm">—</span>;
                    return (
                      <a href={`/admin/payouts?talent=${talent.id}`} className="group space-y-0.5">
                        <div className="text-xs">
                          <span className="text-green-400 font-medium">US${es.paid.toFixed(0)}</span>
                          <span className="text-gray-500"> paid</span>
                        </div>
                        {es.pending > 0 && (
                          <div className="text-xs">
                            <span className="text-amber-400 font-medium">US${es.pending.toFixed(0)}</span>
                            <span className="text-gray-500"> pending</span>
                          </div>
                        )}
                        <span className="text-[10px] text-gray-600 group-hover:text-gray-400">{es.count} orders</span>
                      </a>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  {(() => {
                    const vid = talent as Talent & { voice_id_status?: string; voice_id_number?: string; voice_id_file_url?: string; voice_id_signature_url?: string };
                    const status = vid.voice_id_status || 'none';
                    if (status === 'verified') return (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                          <span className="text-green-400 text-xs font-medium">{vid.voice_id_number}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {vid.voice_id_file_url && (
                            <a href={vid.voice_id_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded px-2 py-0.5">
                              <Music className="w-3 h-3" /> Play
                            </a>
                          )}
                          {vid.voice_id_signature_url && (
                            <a href={vid.voice_id_signature_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded px-2 py-0.5">
                              <ExternalLink className="w-3 h-3" /> Signature
                            </a>
                          )}
                        </div>
                      </div>
                    );
                    if (status === 'submitted') return (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-blue-400 text-xs font-medium">Submitted — Review</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {vid.voice_id_file_url && (
                            <a href={vid.voice_id_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded px-2 py-0.5">
                              <Music className="w-3 h-3" /> Play
                            </a>
                          )}
                          {vid.voice_id_signature_url && (
                            <a href={vid.voice_id_signature_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded px-2 py-0.5">
                              <ExternalLink className="w-3 h-3" /> Signature
                            </a>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVerifyVoiceId(talent.id)}
                            disabled={verifyingVoiceId === talent.id}
                            className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-6 px-2 text-[11px]"
                          >
                            {verifyingVoiceId === talent.id ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            )}
                            Verify
                          </Button>
                        </div>
                      </div>
                    );
                    if (status === 'requested') return (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-amber-400 text-xs font-medium">Requested</span>
                      </div>
                    );
                    return (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSendVoiceIdRequest(talent.id)}
                        disabled={sendingVoiceId === talent.id}
                        className="text-gray-500 hover:text-green-400 hover:bg-green-500/10 h-7 px-2 text-xs"
                      >
                        {sendingVoiceId === talent.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Send className="w-3 h-3 mr-1" />
                        )}
                        Send Request
                      </Button>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  <Badge className={talent.is_active ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-zinc-700 text-gray-400 border border-zinc-600"}>
                    {talent.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(talent)} className="h-8 px-3 border-zinc-600 text-gray-200 hover:bg-zinc-700 hover:text-white">
                      <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(talent.id)} className="h-8 px-3 bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400">
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {talents.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-gray-500">
                  No talents registered yet. Click &ldquo;Add Talent&rdquo; to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
