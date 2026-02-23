'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, Music, ChevronRight, ChevronLeft, Upload, Check, X,
  AlertTriangle, FileAudio, User, Globe, Settings, DollarSign, Shield, Search
} from 'lucide-react';
import { COUNTRIES } from '@/lib/countries';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const NATIVE_LANGUAGES = [
  'Afrikaans', 'Albanian', 'Amharic', 'Arabic', 'Armenian',
  'Azerbaijani', 'Basque', 'Bengali', 'Bosnian', 'Bulgarian', 'Burmese',
  'Cantonese', 'Catalan', 'Croatian', 'Czech', 'Danish', 'Dutch',
  'English', 'Estonian', 'Finnish', 'French', 'Galician', 'Georgian', 'German',
  'Greek', 'Gujarati', 'Haitian Creole', 'Hausa', 'Hebrew', 'Hindi', 'Hungarian',
  'Icelandic', 'Igbo', 'Indonesian', 'Italian', 'Japanese', 'Javanese', 'Kannada',
  'Kazakh', 'Khmer', 'Korean', 'Kurdish', 'Kyrgyz', 'Lao', 'Latvian', 'Lithuanian',
  'Macedonian', 'Malay', 'Malayalam', 'Maltese', 'Mandarin Chinese', 'Marathi',
  'Mongolian', 'Nepali', 'Norwegian', 'Odia', 'Pashto', 'Persian', 'Polish',
  'Portuguese', 'Punjabi', 'Romanian', 'Russian',
  'Serbian', 'Sinhala', 'Slovak', 'Slovenian', 'Somali', 'Spanish',
  'Swahili', 'Swedish', 'Tagalog', 'Tajik', 'Tamil', 'Telugu',
  'Thai', 'Tibetan', 'Turkish', 'Turkmen', 'Ukrainian', 'Urdu', 'Uzbek',
  'Vietnamese', 'Welsh', 'Xhosa', 'Yoruba', 'Zulu',
];

const ACCENT_MAP: Record<string, string[]> = {
  'Arabic': ['Egyptian', 'Gulf', 'Levantine', 'Modern Standard', 'Moroccan'],
  'English': ['American', 'British', 'Australian', 'Canadian', 'Indian', 'Irish', 'New Zealand', 'South African'],
  'French': ['Metropolitan (France)', 'Canadian', 'Belgian', 'Swiss', 'African'],
  'German': ['Standard (Hochdeutsch)', 'Austrian', 'Swiss'],
  'Italian': ['Standard', 'Northern', 'Southern', 'Sicilian'],
  'Japanese': ['Standard (Tokyo)', 'Kansai', 'Kyushu'],
  'Korean': ['Standard (Seoul)', 'Gyeongsang', 'Jeolla'],
  'Mandarin Chinese': ['Standard (Beijing)', 'Taiwanese', 'Singaporean', 'Malaysian'],
  'Cantonese': ['Hong Kong', 'Guangzhou', 'Malaysian'],
  'Portuguese': ['Brazilian', 'European'],
  'Spanish': ['Castilian (Spain)', 'Mexican', 'Argentine', 'Colombian', 'Other Latin American'],
  'Russian': ['Standard (Moscow)', 'Southern', 'Ural', 'Siberian'],
  'Hindi': ['Standard', 'Northern', 'Southern', 'Western'],
  'Dutch': ['Netherlands', 'Belgian (Flemish)', 'Surinamese'],
  'Norwegian': ['Bokmål', 'Nynorsk'],
  'Swedish': ['Standard', 'Finnish Swedish'],
  'Tamil': ['Indian', 'Sri Lankan', 'Malaysian', 'Singaporean'],
  'Turkish': ['Istanbul', 'Anatolian'],
  'Vietnamese': ['Northern (Hanoi)', 'Central (Huế)', 'Southern (Ho Chi Minh)'],
  'Thai': ['Central', 'Northern', 'Northeastern (Isan)', 'Southern'],
  'Malay': ['Malaysian', 'Indonesian', 'Bruneian'],
  'Bengali': ['Bangladeshi', 'West Bengali (Indian)'],
  'Persian': ['Iranian', 'Afghan (Dari)', 'Tajik'],
  'Urdu': ['Pakistani', 'Indian'],
  'Punjabi': ['Pakistani', 'Indian'],
};

const VOICE_TYPES = ['Warm', 'Cool', 'Energetic', 'Calm', 'Corporate', 'Friendly', 'Authoritative', 'Conversational', 'Smooth', 'Powerful', 'Deep', 'Bright'];
const VO_SPECIALTIES = ['Commercial', 'Documentary', 'Narration', 'E-Learning', 'Animation / Character', 'Audiobook', 'IVR / Phone System', 'Video Game', 'Corporate Training'];
const SINGER_SPECIALTIES = ['Pop', 'Rock', 'Jazz', 'Classical / Opera', 'R&B / Soul', 'Folk / Acoustic', 'Electronic / EDM', 'Hip-Hop', 'Country', 'Musical Theatre'];

const VOCAL_RANGES = ['Soprano', 'Mezzo-Soprano', 'Alto', 'Tenor', 'Baritone', 'Bass'];
const VOCAL_TONES = ['Airy & Breathy', 'Powerful & Belting', 'Raspy & Gritty', 'Smooth & Silky', 'Bright & Crisp', 'Mellow & Dark', 'Theatrical', 'Falsetto-Heavy'];
const SINGER_GENRES = ['Pop', 'EDM & House', 'R&B & Soul', 'Rock & Metal', 'Jazz & Blues', 'Classical & Opera', 'Musical Theatre', 'Country & Folk', 'Hip-Hop Vocals'];
const AGE_RANGES = ['18-24', '25-30', '31-35', '36-40', '41-50', '51+'];
const EXPERIENCE_YEARS = ['Less than 1 year', '1-2 years', '3-5 years', '6-10 years', '10+ years'];

const STEPS = [
  { id: 1, label: 'Role', icon: User },
  { id: 2, label: 'Basic Info', icon: User },
  { id: 3, label: 'Voice Profile', icon: Mic },
  { id: 4, label: 'Technical', icon: Settings },
  { id: 5, label: 'Rates', icon: DollarSign },
  { id: 6, label: 'Portfolio', icon: FileAudio },
  { id: 7, label: 'Legal', icon: Shield },
];

interface FormData {
  role_type: 'VO' | 'Singer' | '';
  full_name: string;
  email: string;
  phone: string;
  country: string;
  native_language: string;
  accent: string;
  gender: string;
  age_range: string;
  voice_types: string[];
  specialties: string[];
  vocal_range: string[];
  vocal_tone: string[];
  singer_genres: string[];
  experience_years: string;
  notable_clients: string;
  bio: string;
  has_home_studio: boolean;
  microphone_model: string;
  daw_software: string;
  recording_environment: string;
  can_deliver_dry_audio: boolean;
  consent_ai_twin: boolean;
  min_live_gig_budget: string;
  rate_lead_vocal: string;
  rate_hook_chorus: string;
  rate_notes: string;
  consent_data_processing: boolean;
  consent_terms: boolean;
  consent_moral_rights: boolean;
  consent_voice_id: boolean;
  consent_age_verified: boolean;
}

const defaultForm: FormData = {
  role_type: '',
  full_name: '',
  email: '',
  phone: '',
  country: '',
  native_language: '',
  accent: '',
  gender: '',
  age_range: '',
  voice_types: [],
  specialties: [],
  vocal_range: [],
  vocal_tone: [],
  singer_genres: [],
  experience_years: '',
  notable_clients: '',
  bio: '',
  has_home_studio: false,
  microphone_model: '',
  daw_software: '',
  recording_environment: 'Home Studio',
  can_deliver_dry_audio: true,
  consent_ai_twin: false,
  min_live_gig_budget: '',
  rate_lead_vocal: '',
  rate_hook_chorus: '',
  rate_notes: '',
  consent_data_processing: false,
  consent_terms: false,
  consent_moral_rights: false,
  consent_voice_id: false,
  consent_age_verified: false,
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-amber-500' : 'bg-zinc-700'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function NativeLanguageSelect({ value, onChange, onLanguageChange }: {
  value: string;
  onChange: (v: string) => void;
  onLanguageChange?: (lang: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(!value);
  const filtered = NATIVE_LANGUAGES.filter(l => l.toLowerCase().includes(search.toLowerCase()));

  const select = (lang: string) => {
    if (value === lang) {
      onChange('');
      onLanguageChange?.('');
      setOpen(true);
    } else {
      onChange(lang);
      onLanguageChange?.(lang);
      setOpen(false);
      setSearch('');
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-3">
        Native Language <span className="text-red-400">*</span>
      </label>

      {value && (
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 border border-amber-500/50 text-amber-300">
            {value}
            <button type="button" onClick={() => select(value)} className="hover:text-white transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Change
            </button>
          )}
        </div>
      )}

      {open && (
        <>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search languages..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-amber-500/60 focus:outline-none transition-colors"
            />
          </div>

          <div className="h-52 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg p-2 space-y-0.5 scrollbar-thin">
            {filtered.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-6">No languages match your search</p>
            ) : (
              filtered.map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => select(lang)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center justify-between group ${
                    value === lang
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'text-gray-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <span>{lang}</span>
                  {value === lang && <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                </button>
              ))
        )}
      </div>
        </>
      )}
    </div>
  );
}

function MultiSelect({ options, selected, onChange, label, maxSelect, hint }: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  label: string;
  maxSelect?: number;
  hint?: string;
}) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt));
    } else {
      if (maxSelect && selected.length >= maxSelect) return;
      onChange([...selected, opt]);
    }
  };
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-3">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const isSelected = selected.includes(opt);
          const isDisabled = !isSelected && !!maxSelect && selected.length >= maxSelect;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              disabled={isDisabled}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                isSelected
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : isDisabled
                  ? 'bg-zinc-900/50 border-zinc-800 text-gray-600 cursor-not-allowed'
                  : 'bg-zinc-900 border-zinc-700 text-gray-400 hover:border-zinc-500 hover:text-white'
              }`}
            >
              {isSelected && <Check className="inline w-3 h-3 mr-1" />}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, type = 'text', placeholder, required, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative">
        {type === 'number' && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">$</span>
        )}
        <input
          type={type}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:border-amber-500/60 focus:outline-none transition-colors ${type === 'number' ? 'pl-7' : ''}`}
        />
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-amber-500/60 focus:outline-none transition-colors"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function ApplyPage() {
  const t = useTranslations('apply');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (key: keyof FormData, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const validateStep = () => {
    switch (step) {
      case 1: return form.role_type !== '';
      case 2: return !!(form.full_name && form.email && form.country && form.gender && form.age_range && form.native_language);
      case 3: return form.role_type === 'Singer'
        ? form.vocal_range.length > 0 && form.vocal_tone.length > 0 && form.singer_genres.length > 0 && !!form.experience_years
        : form.voice_types.length > 0 && form.specialties.length > 0 && !!form.experience_years;
      case 4: return form.recording_environment !== '';
      case 5: return form.role_type === 'VO' ? form.consent_ai_twin : !!(form.rate_lead_vocal && form.rate_hook_chorus);
      case 6: return file !== null && !fileError;
      case 7: return form.consent_data_processing && form.consent_terms && form.consent_moral_rights && form.consent_voice_id && form.consent_age_verified;
      default: return true;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFileError('');
    if (!f) { setFile(null); return; }
    const isWav = f.name.toLowerCase().endsWith('.wav') || f.type === 'audio/wav' || f.type === 'audio/x-wav' || f.type === 'audio/wave';
    if (!isWav) { setFileError('Only .WAV files are accepted. Please convert your audio and re-upload.'); setFile(null); return; }
    if (f.size > 50 * 1024 * 1024) { setFileError('File exceeds the 50MB limit. Please trim your recording.'); setFile(null); return; }
    setFile(f);
  };

  const buildFileName = () => {
    const name = form.full_name.replace(/\s+/g, '');
    const lang = form.native_language.replace(/\s+/g, '').replace(/[()\/]/g, '') || 'Unknown';
    const role = form.role_type;
    const gender = form.gender.replace(/\s+/g, '').replace(/-/g, '');
    return `${name}_${lang}_${role}_${gender}.wav`;
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fileName = buildFileName();
      const folder = form.role_type === 'Singer' ? 'singers' : 'voice-actors';
      const path = `${folder}/${Date.now()}_${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('talent-submissions')
        .upload(path, file, { upsert: false });

      if (uploadError) throw new Error(`上傳失敗 (${uploadError.statusCode ?? ''}): ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('talent-submissions').getPublicUrl(uploadData.path);
      const fileUrl = urlData.publicUrl;

      const rateNotesParts = [
        form.consent_ai_twin ? '[AI Twin Agreement: Accepted]' : '',
        form.min_live_gig_budget ? `[Min Live Gig Budget: US$${form.min_live_gig_budget}]` : '',
        form.rate_notes || '',
      ].filter(Boolean).join('\n');

      const submitPayload = {
        role_type: form.role_type,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        country: form.country,
        languages: [form.native_language],
        accent: form.accent,
        gender: form.gender,
        age_range: form.age_range,
        voice_types: form.role_type === 'Singer' ? form.vocal_range : form.voice_types,
        specialties: form.role_type === 'Singer' ? form.singer_genres : form.specialties,
        experience_years: form.experience_years,
        notable_clients: form.notable_clients,
        vocal_tone: form.role_type === 'Singer' ? form.vocal_tone : [],
        bio: form.bio,
        has_home_studio: form.has_home_studio,
        microphone_model: form.microphone_model,
        daw_software: form.daw_software,
        recording_environment: form.recording_environment,
        can_deliver_dry_audio: form.can_deliver_dry_audio,
        rate_lead_vocal: form.rate_lead_vocal ? parseFloat(form.rate_lead_vocal) : null,
        rate_hook_chorus: form.rate_hook_chorus ? parseFloat(form.rate_hook_chorus) : null,
        rate_notes: rateNotesParts,
        consent_data_processing: form.consent_data_processing,
        consent_terms: form.consent_terms,
        consent_moral_rights: form.consent_moral_rights,
        consent_voice_id: form.consent_voice_id,
        consent_age_verified: form.consent_age_verified,
        fileUrl,
        fileName,
        fileSize: file.size,
      };

      const res = await fetch('/api/apply/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitPayload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Submission failed');

      setApplicationNumber(result.application_number);
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full text-center"
        >
          <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">{t('successTitle')}</h1>
          <p className="text-gray-400 mb-4">
            {t('successMessage')}
          </p>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-6 py-4 mb-8">
            <p className="text-xs text-gray-500 mb-1">Application Reference</p>
            <p className="text-lg font-mono font-bold text-amber-400">{applicationNumber}</p>
          </div>
          <a href="/" className="inline-block text-sm text-gray-400 hover:text-white transition-colors">
            {t('backToOnyxStudios')}
          </a>
        </motion.div>
      </div>
    );
  }

  const canProceed = validateStep();

  return (
    <div className="min-h-screen bg-black text-white">

      {/* Hero */}
      <div className="relative overflow-hidden">
        <img
          src="https://images.pexels.com/photos/164938/pexels-photo-164938.jpeg?auto=compress&cs=tinysrgb&w=1600"
          alt="Recording studio"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black" />
        <div className="relative flex flex-col items-center justify-center text-center px-4 pt-32 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 rounded-full px-4 py-1.5 text-amber-400 text-xs font-medium mb-5 backdrop-blur-sm">
              <Mic className="w-3 h-3" />
              {t('badgeText')}
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 tracking-tight leading-tight">
              {t('heroTitleLine1')}<br />
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                {t('heroTitleLine2')}
              </span>
            </h1>
            <p className="text-gray-300 text-base max-w-2xl mx-auto leading-relaxed mb-12">
              {t('heroDescription')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto w-full"
          >
            <div className="flex flex-col items-center text-center px-5 py-6 rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Shield className="h-6 w-6 text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">100% Artist-Authorized AI</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Your voice, your rules. We create a secure, legal digital twin.</p>
            </div>
            <div className="flex flex-col items-center text-center px-5 py-6 rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                <DollarSign className="h-6 w-6 text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Earn While You Sleep</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Get a fair revenue share every time a client uses your AI voice.</p>
            </div>
            <div className="flex flex-col items-center text-center px-5 py-6 rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Mic className="h-6 w-6 text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Premium Live Gigs</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Stay in the loop for high-ticket, 100% live recording contracts.</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-14">

        {/* Step Indicators */}
        <div className="flex items-center justify-between mb-10">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className={`flex flex-col items-center gap-1 ${step === s.id ? 'opacity-100' : step > s.id ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step > s.id ? 'bg-green-500 text-white' : step === s.id ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-gray-400'
                }`}>
                  {step > s.id ? <Check className="w-4 h-4" /> : s.id}
                </div>
                <span className="text-[10px] text-gray-500 hidden sm:block">{t(`step${s.label.replace(/\s/g, '')}` as any)}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 mx-1 transition-all ${step > s.id ? 'bg-green-500/40' : 'bg-zinc-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-8"
            >

              {/* Step 1: Role Selection */}
              {step === 1 && (
                <div>
                  <h2 className="text-xl font-bold mb-2">What is your role?</h2>
                  <p className="text-gray-400 text-sm mb-8">Select your primary talent type.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => update('role_type', 'VO')}
                      className={`p-6 rounded-xl border-2 text-left transition-all ${
                        form.role_type === 'VO' ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      <Mic className={`w-8 h-8 mb-3 ${form.role_type === 'VO' ? 'text-amber-400' : 'text-gray-400'}`} />
                      <h3 className="font-bold text-white mb-1">{t('roleVoiceActor')}</h3>
                      <p className="text-xs text-gray-400">Narration, commercial, character, IVR, e-learning</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => update('role_type', 'Singer')}
                      className={`p-6 rounded-xl border-2 text-left transition-all ${
                        form.role_type === 'Singer' ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      <Music className={`w-8 h-8 mb-3 ${form.role_type === 'Singer' ? 'text-amber-400' : 'text-gray-400'}`} />
                      <h3 className="font-bold text-white mb-1">{t('roleSinger')}</h3>
                      <p className="text-xs text-gray-400">Pop, jazz, classical, R&B, rock, and beyond</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Basic Info */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold mb-1">Basic Information</h2>
                    <p className="text-gray-400 text-sm">Tell us who you are.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Full Name" value={form.full_name} onChange={v => update('full_name', v)} placeholder="Your full legal name" required />
                    <InputField label="Email Address" value={form.email} onChange={v => update('email', v)} type="email" placeholder="you@example.com" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Phone (Optional)" value={form.phone} onChange={v => update('phone', v)} placeholder="+1 555 000 0000" />
                    <SelectField
                      label="Country" value={form.country} onChange={v => update('country', v)}
                      options={COUNTRIES.map(c => ({ value: c.name, label: c.name }))}
                      placeholder="Select country" required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <SelectField
                      label="Gender" value={form.gender} onChange={v => update('gender', v)}
                      options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]}
                      placeholder="Select gender" required
                    />
                    <SelectField
                      label="Age Range" value={form.age_range} onChange={v => update('age_range', v)}
                      options={AGE_RANGES.map(a => ({ value: a, label: a }))}
                      placeholder="Select age range" required
                    />
                  </div>

                  <NativeLanguageSelect
                    value={form.native_language}
                    onChange={v => update('native_language', v)}
                    onLanguageChange={() => update('accent', '')}
                  />

                  {form.native_language && (
                    ACCENT_MAP[form.native_language] ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Native Accent <span className="text-red-400">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {ACCENT_MAP[form.native_language].map(acc => (
                            <button
                              key={acc}
                              type="button"
                              onClick={() => update('accent', form.accent === acc ? '' : acc)}
                              className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-all ${
                                form.accent === acc
                                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                                  : 'bg-zinc-900 border-zinc-700 text-gray-400 hover:border-zinc-500 hover:text-white'
                              }`}
                            >
                              {form.accent === acc && <Check className="inline w-3 h-3 mr-1.5" />}
                              {acc}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-600 mt-2">Select the accent that best describes your native pronunciation.</p>
                      </div>
                    ) : (
                      <InputField
                        label="Native Accent"
                        value={form.accent}
                        onChange={v => update('accent', v)}
                        placeholder={`e.g. Standard ${form.native_language}, Regional dialect`}
                        hint="Describe your native accent or dialect in your own words."
                      />
                    )
                  )}
                </div>
              )}

              {/* Step 3: Voice / Vocal Profile */}
              {step === 3 && form.role_type === 'Singer' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-1">Vocal Profile</h2>
                    <p className="text-gray-400 text-sm">Help us understand your singing voice and style.</p>
                  </div>

                  <MultiSelect
                    label="Voice Type (Vocal Range) *"
                    options={VOCAL_RANGES}
                    selected={form.vocal_range}
                    onChange={v => update('vocal_range', v)}
                    hint="What is your primary voice type / vocal range?"
                  />

                  <MultiSelect
                    label="Vocal Tone & Timbre *"
                    options={VOCAL_TONES}
                    selected={form.vocal_tone}
                    onChange={v => update('vocal_tone', v)}
                    maxSelect={3}
                    hint="How would you describe the unique texture of your singing voice? (Select up to 3)"
                  />

                  <MultiSelect
                    label="Primary Genres *"
                    options={SINGER_GENRES}
                    selected={form.singer_genres}
                    onChange={v => update('singer_genres', v)}
                    hint="What musical genres do you excel in?"
                  />

                  <SelectField
                    label="Years of Professional Experience *"
                    value={form.experience_years}
                    onChange={v => update('experience_years', v)}
                    options={EXPERIENCE_YEARS.map(e => ({ value: e, label: e }))}
                    placeholder="Select experience"
                  />

                  <InputField
                    label="Notable Credits or Labels (Optional)"
                    value={form.notable_clients}
                    onChange={v => update('notable_clients', v)}
                    placeholder="e.g. Universal Music, Warner, Spotify Original"
                    hint="Any notable releases, labels, or projects you've sung for?"
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Short Bio (Optional)</label>
                    <textarea
                      value={form.bio}
                      onChange={e => update('bio', e.target.value)}
                      rows={3}
                      placeholder="A brief professional background..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:border-amber-500/60 focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>
              )}

              {step === 3 && form.role_type !== 'Singer' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-1">Voice Profile</h2>
                    <p className="text-gray-400 text-sm">Help us understand your vocal range and style.</p>
                  </div>
                  <MultiSelect label="Voice Quality / Tone *" options={VOICE_TYPES} selected={form.voice_types} onChange={v => update('voice_types', v)} />
                  <MultiSelect label="VO Specialties *" options={VO_SPECIALTIES} selected={form.specialties} onChange={v => update('specialties', v)} />
                  <SelectField
                    label="Years of Professional Experience *" value={form.experience_years} onChange={v => update('experience_years', v)}
                    options={EXPERIENCE_YEARS.map(e => ({ value: e, label: e }))}
                    placeholder="Select experience"
                  />
                  <InputField label="Notable Clients or Credits (Optional)" value={form.notable_clients} onChange={v => update('notable_clients', v)} placeholder="e.g. Toyota, NHK, NetEase" />
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Short Bio (Optional)</label>
                    <textarea
                      value={form.bio}
                      onChange={e => update('bio', e.target.value)}
                      rows={3}
                      placeholder="A brief professional background..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:border-amber-500/60 focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Technical Setup */}
              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-1">Recording Setup</h2>
                    <p className="text-gray-400 text-sm">We require dry, unprocessed audio. Tell us about your current setup.</p>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-zinc-700">
                    <div>
                      <p className="font-medium text-white">Home Recording Studio</p>
                      <p className="text-xs text-gray-400 mt-0.5">Do you have a dedicated recording space?</p>
                    </div>
                    <Toggle checked={form.has_home_studio} onChange={v => update('has_home_studio', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Microphone Model" value={form.microphone_model} onChange={v => update('microphone_model', v)} placeholder="e.g. Neumann TLM 103" />
                    <InputField label="DAW / Recording Software" value={form.daw_software} onChange={v => update('daw_software', v)} placeholder="e.g. Pro Tools, Logic Pro" />
                  </div>
                  <SelectField
                    label="Recording Environment *" value={form.recording_environment} onChange={v => update('recording_environment', v)}
                    options={[
                      { value: 'Home Studio', label: 'Home Studio' },
                      { value: 'Professional Studio', label: 'Professional Studio' },
                      { value: 'Both', label: 'Both Home & Pro Studio' },
                    ]}
                    placeholder="Select environment"
                  />
                  <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-zinc-700">
                    <div>
                      <p className="font-medium text-white">Can deliver 100% Dry / RAW audio</p>
                      <p className="text-xs text-gray-400 mt-0.5">No reverb, no compression, no BGM — pure dry signal</p>
                    </div>
                    <Toggle checked={form.can_deliver_dry_audio} onChange={v => update('can_deliver_dry_audio', v)} />
                  </div>
                  {!form.can_deliver_dry_audio && (
                    <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-300">Onyx requires 100% dry audio for all talent submissions. Applications without dry audio capability will not be reviewed.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Rates */}
              {step === 5 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-1">
                      {form.role_type === 'VO' ? 'Expected Rates & AI Revenue Share' : 'Expected Rates & Licensing Preferences'}
                    </h2>
                    <p className="text-gray-400 text-sm">
                      {form.role_type === 'VO'
                        ? 'Review the terms below to proceed. All monetary values are in USD.'
                        : 'We recruit singers for both AI vocal training and traditional live recording. Select your preferences below. All rates in USD.'}
                    </p>
                  </div>

                  {form.role_type === 'VO' && (
                    <>
                      <div
                        onClick={() => update('consent_ai_twin', !form.consent_ai_twin)}
                        className={`p-5 rounded-xl border cursor-pointer transition-all ${
                          form.consent_ai_twin
                            ? 'bg-amber-500/10 border-amber-500/40'
                            : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
                            form.consent_ai_twin
                              ? 'bg-amber-500 border-amber-500'
                              : 'border-zinc-600 bg-zinc-800'
                          }`}>
                            {form.consent_ai_twin && <Check className="w-3.5 h-3.5 text-black" />}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white mb-2">
                              Official AI Digital Twin &amp; Service Agreement <span className="text-red-400">*</span>
                            </p>
                            <p className="text-xs text-gray-400 leading-relaxed">
                              I agree to provide 1 hour of clean, home-studio audio based on Onyx&apos;s provided script.
                              In return, Onyx will train and host my secure AI voice model at no cost.
                              I grant Onyx the right to license my AI voice for all commercial uses.
                              I will receive a flat <span className="text-amber-300 font-semibold">10% royalty</span> on
                              the final sale price of every pure-AI generation that uses my voice.
                            </p>
                            <p className="text-xs text-gray-500 leading-relaxed mt-2 border-t border-zinc-700/50 pt-2">
                              <span className="text-gray-400 font-medium">Micro-Patch Protocol:</span> If
                              a client needs a 100% human re-record of a specific AI-generated line to
                              perfect a track, I agree to provide this quick patch at a platform-standard
                              flat fee of <span className="text-white font-medium">US$10</span> per request.
                            </p>
                          </div>
                        </div>
                      </div>

                      <InputField
                        label="Minimum Budget for Custom Live Gig (USD)"
                        value={form.min_live_gig_budget}
                        onChange={v => update('min_live_gig_budget', v)}
                        type="number"
                        placeholder="e.g. 200"
                        hint="What's the absolute minimum budget you'd consider for a 100% custom live recording session? We'll only pitch you 100% Live Studio projects at or above this rate."
                      />
                    </>
                  )}

                  {form.role_type === 'Singer' && (
                    <>
                      {/* Path A: AI Vocal Twin Program */}
                      <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/5">
                        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Path A</p>
                        <p className="text-sm font-bold text-white mb-3">AI Vocal Twin Program <span className="text-xs font-normal text-gray-400">(Optional but Recommended)</span></p>

                        <div
                          onClick={() => update('consent_ai_twin', !form.consent_ai_twin)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            form.consent_ai_twin
                              ? 'bg-amber-500/10 border-amber-500/40'
                              : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
                              form.consent_ai_twin
                                ? 'bg-amber-500 border-amber-500'
                                : 'border-zinc-600 bg-zinc-800'
                            }`}>
                              {form.consent_ai_twin && <Check className="w-3.5 h-3.5 text-black" />}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white mb-2">Official AI Vocal Twin Agreement</p>
                              <p className="text-xs text-gray-400 leading-relaxed">
                                Yes, I want to earn passive income! I agree to provide dry vocal stems for Onyx to train and host my secure AI Vocal model.
                                I grant Onyx commercial licensing rights and will receive a flat <span className="text-amber-300 font-semibold">10% royalty</span> on all pure-AI vocal generations.
                              </p>
                              <p className="text-xs text-gray-500 leading-relaxed mt-2 border-t border-zinc-700/50 pt-2">
                                <span className="text-gray-400 font-medium">Micro-Patch Protocol:</span> I agree to provide quick human punch-ins (up to 4 bars) for AI tracks at a flat fee of <span className="text-white font-medium">US$15</span> per request.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Path B: Traditional Studio Recording */}
                      <div className="p-5 rounded-xl border border-zinc-700 bg-zinc-900">
                        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Path B</p>
                        <p className="text-sm font-bold text-white mb-2">Traditional Studio Recording <span className="text-xs font-normal text-gray-400">(Work-for-Hire)</span></p>
                        <p className="text-xs text-gray-400 leading-relaxed mb-4">
                          If you opt-out of AI training, or for client projects requiring 100% live human vocals, please set your traditional buyout rates below. Onyx guarantees no AI training on traditional work-for-hire stems.
                        </p>

                        <div className="space-y-4">
                          <InputField
                            label="Flat Fee — Full Lead Vocal Buyout (USD)"
                            value={form.rate_lead_vocal}
                            onChange={v => update('rate_lead_vocal', v)}
                            type="number"
                            placeholder="e.g. 350"
                            hint="Minimum budget for a full custom lead vocal track (approx. 3-4 mins) with full commercial buyout."
                            required
                          />
                          <InputField
                            label="Flat Fee — Short Hook / Chorus Buyout (USD)"
                            value={form.rate_hook_chorus}
                            onChange={v => update('rate_hook_chorus', v)}
                            type="number"
                            placeholder="e.g. 120"
                            hint="Minimum budget for a short hook/chorus section with full commercial buyout."
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Additional Notes (Optional)</label>
                    <textarea
                      value={form.rate_notes}
                      onChange={e => update('rate_notes', e.target.value)}
                      rows={3}
                      placeholder="Any specific studio gear, revision limits, or project preferences?"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:border-amber-500/60 focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Step 6: Portfolio Upload */}
              {step === 6 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-1">Demo Submission</h2>
                    <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mt-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-200 space-y-1">
                        <p className="font-semibold">Read before uploading:</p>
                        <ul className="space-y-1 text-amber-300/80 list-disc list-inside">
                          <li>ONE single .WAV file only (max 2 minutes)</li>
                          <li>Include 3-4 different emotional deliveries or styles</li>
                          <li>100% DRY audio — NO reverb, NO BGM, NO compression</li>
                          <li>Maximum file size: 50MB</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-300 mb-2">Auto-generated filename:</p>
                    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 font-mono text-sm text-amber-400">
                      {form.full_name && form.native_language && form.gender
                        ? buildFileName()
                        : <span className="text-gray-500">Complete previous steps to generate filename</span>
                      }
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">Format: [Name]_[Language]_[VO|Singer]_[Gender].wav</p>
                  </div>

                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".wav,audio/wav,audio/x-wav"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-full border-2 border-dashed rounded-xl p-8 text-center transition-all hover:border-amber-500/40 ${
                        file ? 'border-green-500/40 bg-green-500/5' : 'border-zinc-700 hover:bg-zinc-900/50'
                      }`}
                    >
                      {file ? (
                        <div>
                          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                            <Check className="w-6 h-6 text-green-400" />
                          </div>
                          <p className="font-medium text-green-400">{file.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB — Click to replace</p>
                        </div>
                      ) : (
                        <div>
                          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                            <Upload className="w-6 h-6 text-gray-400" />
                          </div>
                          <p className="font-medium text-white">Upload Your .WAV</p>
                          <p className="text-xs text-gray-500 mt-1">.WAV format only · Max 50MB</p>
                        </div>
                      )}
                    </button>
                    {fileError && (
                      <div className="flex items-start gap-2 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-300">{fileError}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 7: Legal */}
              {step === 7 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-1">Consent & Declaration</h2>
                    <p className="text-gray-400 text-sm">Please read and confirm the following before submitting.</p>
                  </div>
                  {[
                    {
                      key: 'consent_data_processing' as const,
                      title: 'Evaluation & Data Processing Consent',
                      desc: 'I consent to Onyx Studios using my uploaded audio for talent evaluation and AI model compatibility testing. I understand and agree that, for the purposes of platform security and copyright tracking, Onyx retains internal archival rights over all data generated during this evaluation phase.',
                    },
                    {
                      key: 'consent_terms' as const,
                      title: 'Originality & IP Declaration',
                      desc: form.role_type === 'Singer'
                        ? 'I legally confirm that the submitted audio features my own natural voice and original vocal performance. It does not contain synthetic generation, voice cloning, or infringe upon any third-party rights. I warrant that all recordings are 100% original and do not contain pitch-corrected samples or melodies from other copyrighted artists. I understand that formal commercial terms, including Work Made for Hire and rights transfer, will be presented in a separate agreement upon acceptance into the Onyx Talent Network.'
                        : 'I legally confirm that the submitted audio features my own natural voice and original performance. It does not contain synthetic generation, voice cloning, or infringe upon any third-party rights. I understand that formal commercial terms, including Work Made for Hire and rights transfer, will be presented in a separate agreement upon acceptance into the Onyx Talent Network.',
                    },
                    {
                      key: 'consent_moral_rights' as const,
                      title: 'Evaluation Use Authorization',
                      desc: 'I authorize Onyx Studios to use my submitted audio for internal evaluation, demo playback to the review panel, and technical compatibility testing. I understand this authorization is limited to the evaluation process and does not constitute a commercial license.',
                    },
                    {
                      key: 'consent_voice_id' as const,
                      title: 'Voice ID Affidavit',
                      desc: 'I agree to provide a 10-second "Voice ID" recording as part of my final delivery for any project. This recording serves as a biological digital signature confirming my identity and the lawful transfer of rights, which will be linked to the License Certificate issued to the client.',
                    },
                    {
                      key: 'consent_age_verified' as const,
                      title: 'Age Verification & Capacity',
                      desc: 'I confirm that I am 18 years of age or older and possess the legal capacity to enter into binding licensing agreements.',
                    },
                  ].map(item => (
                    <div
                      key={item.key}
                      className={`p-5 rounded-xl border-2 transition-all cursor-pointer ${
                        form[item.key] ? 'border-green-500/40 bg-green-500/5' : 'border-zinc-700 hover:border-zinc-500'
                      }`}
                      onClick={() => update(item.key, !form[item.key])}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          form[item.key] ? 'bg-green-500 border-green-500' : 'border-zinc-600'
                        }`}>
                          {form[item.key] && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">{item.title}</p>
                          <p className="text-gray-400 text-sm mt-1">{item.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="px-8 py-5 border-t border-zinc-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 1}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {step < 7 ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed}
                className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canProceed || uploading}
                className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Submit Application
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Applications are reviewed manually by our A&R team. We do not guarantee placement.
        </p>
      </div>
    </div>
  );
}
