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
  FileText, DollarSign, ArrowUpRight, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { formatLangEntry, traitLabel, useCaseLabel, availabilityLabel, countryLabel, voiceAgeLabel, USE_CASES } from "@/lib/talent-taxonomy";
import { cjkSpace } from "@/lib/cjk-space";
import { AdminStats } from "@/components/admin/list-ui";

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

// Common "changes requested" reasons — click to drop a polite line into the
// reject message (composed in the talent's language). Admin can still edit freely.
const REJECT_REASONS: { key: string; label: string; tw: string; en: string }[] = [
  { key: 'no_demo', label: '沒有 demo', tw: '請至少上傳一段 demo 試聽,我們才能評估您的聲音。', en: 'Please upload at least one demo so we can assess your voice.' },
  { key: 'demo_noise', label: 'demo 有雜音', tw: 'demo 有背景雜音,請在安靜環境重新錄製一段乾淨的。', en: 'Your demo has background noise — please re-record a clean take in a quiet space.' },
  { key: 'demo_lang', label: '缺某語言 demo', tw: '您列的語言缺少對應的 demo,請每個語言補一段該語言的 demo。', en: 'Some of your listed languages have no matching demo — please add one demo per language.' },
  { key: 'bio_short', label: '簡介太短', tw: '請補充個人簡介(經歷、擅長的風格與類型)。', en: 'Please expand your bio — your experience and the styles you do best.' },
  { key: 'headshot', label: '大頭照不清/缺', tw: '大頭照缺少或不清楚,請上傳一張清晰的正方形照片。', en: 'Your headshot is missing or unclear — please upload a clear, square photo.' },
  { key: 'works', label: '補代表作', tw: '請補上代表作,或合作過的品牌/作品。', en: 'Please add some notable works, or brands/projects you have worked with.' },
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
  const t = useTranslations('admin.talents');
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
      <Label className="text-gray-700">{label}</Label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(item => (
            <Badge key={item} className="bg-gray-200 text-gray-200 border-gray-400 hover:bg-gray-300 text-xs gap-1 pr-1">
              {item}
              <button type="button" onClick={() => onChange(selected.filter(s => s !== item))} className="ml-0.5 hover:text-red-700">
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
            className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 pl-9 h-9 text-sm"
          />
        </div>
        {open && (
          <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-white border border-gray-300 shadow-xl">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-500 p-3">{t('multiSelectNoResults')}</p>
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
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2 transition-colors ${
                      isSelected ? "text-emerald-700" : "text-gray-700"
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                      isSelected ? "bg-emerald-500 border-emerald-500" : "border-gray-400"
                    }`}>
                      {isSelected && <CheckCircle className="w-2.5 h-2.5 text-gray-900" />}
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
  const t = useTranslations('admin.talents');
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
      <Label className="text-gray-700">{label}</Label>
      {value && (
        <div className="flex items-center gap-1.5 mb-1">
          <Badge className="bg-gray-200 text-gray-200 border-gray-400 text-xs gap-1 pr-1">
            {value}
            <button type="button" onClick={() => onChange("")} className="ml-0.5 hover:text-red-700">
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
            className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 pl-9 h-9 text-sm"
          />
        </div>
        {open && (
          <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-white border border-gray-300 shadow-xl">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-500 p-3">{t('multiSelectNoResults')}</p>
            ) : (
              filtered.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => { onChange(item); setOpen(false); setSearch(""); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors ${
                    value === item ? "text-emerald-700" : "text-gray-700"
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

// Shape of the profile fields a talent fills on /talent ("我的檔案"). These are
// the row's MAIN columns — i.e. the talent's live draft, including edits still
// awaiting review — so the admin sees exactly what was submitted, even before
// approval (no blind reviewing). Sensitive/payout fields are intentionally
// absent here;收款 lives in /admin/payout-details (on-demand decrypt).
type TalentProfile = Talent & {
  invite_names?: string[];   // 邀請時填的真名(≠藝名),搜尋+顯示用
  english_name?: string; location?: string; gender?: string;
  voice_traits?: string[]; specialties?: string[]; voice_ages?: string[];
  native_languages?: string[]; years_experience?: number | null;
  special_skills?: string; turnaround?: string;
  demos?: Array<{ category: string; name: string; url: string; language?: string; seconds?: number }>;
  clients?: string; awards?: string; notable_works?: string;
  availability_note?: string; equipment?: string; studio_partner?: string;
  liveness_status?: string; pending_review?: boolean; onboarded_at?: string;
  coop_open_buyout?: boolean; coop_ai_clone?: boolean; coop_ai_training?: boolean;
  coop_proofread?: boolean; coop_voice_director?: boolean; low_price_data_optin?: boolean;
  coop_accept_jobs?: boolean;
};

// Read-only full-profile view — everything the talent filled in on /talent,
// shown to the admin in the backend (no need to open the public site or the
// front portal). Works for draft / pending / active alike: it reads the row's
// main columns, so drafts and unpublished edits are visible pre-approval.
function TalentProfileCard({ t, locale }: { t: TalentProfile; locale: string }) {
  const tr = useTranslations('admin.talents');
  const demos = Array.isArray(t.demos) ? t.demos : [];
  const byCat = USE_CASES.map((c) => ({ c, items: demos.filter((d) => d.category === c.key) })).filter((g) => g.items.length > 0);
  const avail = (t.availability_note || '').split(',').map((s) => s.trim()).filter(Boolean);
  const coop = [
    t.coop_open_buyout && tr('coopWantBuyout'),
    t.coop_ai_clone && tr('coopWantAiClone'),
    t.coop_ai_training && tr('coopWantAiTraining'),
    t.coop_proofread && tr('coopWantProofread'),
    t.coop_voice_director && tr('coopWantVoiceDirector'),
    t.low_price_data_optin && tr('coopWantLowPriceData'),
  ].filter(Boolean) as string[];
  const Chip = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-block text-[11px] bg-gray-100 border border-gray-300 text-gray-700 rounded-full px-2 py-0.5">{children}</span>
  );
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div><p className="text-[11px] text-gray-500 mb-1">{title}</p>{children}</div>
  );
  const hasCredits = !!(t.clients || t.notable_works || t.awards);
  const hasWorkInfo = avail.length > 0 || t.equipment || t.studio_partner || t.turnaround || t.portfolio_url;

  return (
    <div className="space-y-4">
      {/* Header — identity + completeness at a glance */}
      <div className="flex items-center gap-3">
        {t.headshot_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.headshot_url} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 font-semibold text-xl">{(t.name || '?').charAt(0)}</div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{t.name}{(t as TalentProfile & { talent_no?: number }).talent_no ? <span className="text-gray-400 font-normal text-xs"> T-{(t as TalentProfile & { talent_no?: number }).talent_no}</span> : null}{t.english_name ? <span className="text-gray-400 font-normal"> · {t.english_name}</span> : null}{((t as TalentProfile).invite_names || []).length ? <span className="text-gray-400 font-normal text-xs"> (真名:{((t as TalentProfile).invite_names || []).join('、')})</span> : null}</p>
          <p className="text-xs text-gray-500">{[t.gender, t.location ? countryLabel(t.location, locale) : '', typeof t.years_experience === 'number' ? tr('cardYearsExperience', { years: t.years_experience }) : ''].filter(Boolean).join(' · ') || '—'}</p>
          {t.email && <p className="text-xs text-gray-500 truncate">{tr('cardContact')}<a href={`mailto:${t.email}`} className="text-blue-600 hover:underline">{t.email}</a></p>}
        </div>
        <div className="ml-auto flex flex-col items-end gap-1 shrink-0">
          {t.pending_review && <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">{tr('cardPendingDraft')}</span>}
          {!t.pending_review && !t.is_active && t.onboarded_at && <span className="text-[11px] text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">{tr('cardDraftNotSubmitted')}</span>}
          {t.liveness_status === 'verified' && <span className="text-[11px] text-emerald-700 font-medium">{tr('cardVerifiedPerson')}</span>}
        </div>
      </div>

      {/* Completeness checklist — spot gaps before approving */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { id: 'headshot', k: tr('checkHeadshot'), ok: !!t.headshot_url },
          { id: 'language', k: tr('checkLanguage'), ok: (t.languages || []).length > 0 },
          { id: 'voiceTraits', k: tr('checkVoiceTraits'), ok: (t.voice_traits || []).length > 0 },
          { id: 'specialties', k: tr('checkSpecialties'), ok: (t.specialties || []).length > 0 },
          { id: 'demo', k: tr('checkDemo'), ok: demos.length > 0 },
          { id: 'bio', k: tr('checkBio'), ok: !!t.bio },
          { id: 'liveness', k: tr('checkLiveness'), ok: t.liveness_status === 'verified' },
        ].map((c) => (
          <span key={c.id} className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 border ${c.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {c.ok ? '✓' : '✗'} {c.k}
          </span>
        ))}
      </div>

      {t.bio && <Section title={tr('secBio')}><p className="text-sm text-gray-700 whitespace-pre-line">{cjkSpace(t.bio)}</p></Section>}

      {(t.languages || []).length > 0 && (
        <Section title={tr('secLanguages')}>
          <div className="flex flex-wrap gap-1">{t.languages!.map((l) => (
            <Chip key={l}>{formatLangEntry(l, locale)}{(t.native_languages || []).includes(l) ? ` · ${tr('secNative')}` : ''}</Chip>
          ))}</div>
        </Section>
      )}
      {(t.voice_traits || []).length > 0 && <Section title={tr('secVoiceTraits')}><div className="flex flex-wrap gap-1">{t.voice_traits!.map((k) => <Chip key={k}>{traitLabel(k, locale)}</Chip>)}</div></Section>}
      {(t.specialties || []).length > 0 && <Section title={tr('secSpecialties')}><div className="flex flex-wrap gap-1">{t.specialties!.map((k) => <Chip key={k}>{useCaseLabel(k, locale)}</Chip>)}</div></Section>}
      {(t.voice_ages || []).length > 0 && <Section title={tr('secVoiceAge')}><div className="flex flex-wrap gap-1">{t.voice_ages!.map((k) => <Chip key={k}>{voiceAgeLabel(k, locale)}</Chip>)}</div></Section>}
      {t.special_skills && <Section title={tr('secSpecialSkills')}><p className="text-sm text-gray-700 whitespace-pre-line">{cjkSpace(t.special_skills)}</p></Section>}

      {byCat.length > 0 && (
        <Section title={tr('secDemos')}>
          <div className="space-y-2">{byCat.map(({ c, items }) => (
            <div key={c.key}>
              <p className="text-xs text-gray-600 mb-1">{useCaseLabel(c.key, locale)}</p>
              {items.map((d) => (
                <div key={d.url} className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-700 w-32 truncate shrink-0">{cjkSpace(d.name)}{d.language ? ` · ${formatLangEntry(d.language, locale)}` : ''}</span>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={d.url} className="h-7 flex-1" />
                </div>
              ))}
            </div>
          ))}</div>
        </Section>
      )}

      {hasCredits && (
        <Section title={tr('secCredits')}>
          <div className="grid gap-1 text-sm text-gray-700">
            {t.clients && <p><span className="text-gray-500 text-xs">{tr('creditBrands')}</span> {cjkSpace(t.clients)}</p>}
            {t.notable_works && <p className="whitespace-pre-line"><span className="text-gray-500 text-xs">{tr('creditNotableWorks')}</span> {cjkSpace(t.notable_works)}</p>}
            {t.awards && <p><span className="text-gray-500 text-xs">{tr('creditAwards')}</span> {cjkSpace(t.awards)}</p>}
          </div>
        </Section>
      )}

      {hasWorkInfo && (
        <Section title={tr('secWorkInfo')}>
          <div className="text-xs text-gray-600 space-y-0.5">
            {t.turnaround && <p>{tr('workTurnaround')}{cjkSpace(t.turnaround)}</p>}
            {avail.length > 0 && <p>{tr('workAvailability')}{avail.map((k) => availabilityLabel(k, locale)).join('、')}</p>}
            {t.equipment && <p>{tr('workEquipment')}{cjkSpace(t.equipment)}</p>}
            {t.studio_partner && <p>{tr('workStudio')}{cjkSpace(t.studio_partner)}</p>}
            {t.portfolio_url && <p>{tr('workPortfolio')}<a href={t.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{t.portfolio_url}</a></p>}
          </div>
        </Section>
      )}

      {coop.length > 0 && (
        <Section title={tr('secCoop')}>
          <div className="flex flex-wrap gap-1">{coop.map((c) => <Chip key={c}>{c}</Chip>)}</div>
        </Section>
      )}
    </div>
  );
}

export default function AdminTalentsPage() {
  const locale = useLocale();
  const t = useTranslations('admin.talents');
  const [talents, setTalents] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<'all' | 'VO' | 'Singer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'draft' | 'inactive'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'application' | 'casting' | 'manual'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTalent, setEditingTalent] = useState<Talent | null>(null);
  // Read-only "完整檔案" viewer — what the talent filled on /talent, incl. drafts.
  const [profileTarget, setProfileTarget] = useState<Talent | null>(null);
  // Publish (draft → public snapshot). Bio is a single source the admin can
  // tweak; 简体/English are auto-translated at publish time (DeepL).
  const [publishTarget, setPublishTarget] = useState<Talent | null>(null);
  const [pubBio, setPubBio] = useState<string>('');
  const [publishing, setPublishing] = useState(false);
  // Changes-requested (reject) flow
  const [rejectTarget, setRejectTarget] = useState<Talent | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [formData, setFormData] = useState({
    type: "VO",
    name: "",
    english_name: "",
    email: "",
    gender: "",
    accent: "",
    languages: [] as string[],
    category: "in_house",
    tags: [] as string[],
    bio: "",
    portfolio_url: "",
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
      bank_country: "",
      notes: "",
    },
    compensation_model: "commission" as "commission" | "buyout",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [uploadingDemo, setUploadingDemo] = useState(false);
  const [newDemoName, setNewDemoName] = useState("");
  const [sendingVoiceId, setSendingVoiceId] = useState<string | null>(null);
  const [verifyingVoiceId, setVerifyingVoiceId] = useState<string | null>(null);
  const [sendingLiveness, setSendingLiveness] = useState<string | null>(null);
  const [reviewingLiveness, setReviewingLiveness] = useState<string | null>(null);
  const [nudging, setNudging] = useState<string | null>(null);
  const [sendingOnboarding, setSendingOnboarding] = useState<string | null>(null);

  const headshotRef = useRef<HTMLInputElement>(null);
  const demoRef = useRef<HTMLInputElement>(null);

  // Open a voice-affidavit file via a short-lived admin signed URL, so the
  // bucket can be private (no public URLs). Accepts a stored path or legacy URL.
  const openSigned = async (u?: string) => {
    if (!u) return;
    try {
      const res = await fetch(`/api/admin/voice-id/signed-url?u=${encodeURIComponent(u)}`);
      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error(data.error || t('toastCannotOpenFile'));
      }
    } catch {
      toast.error(t('toastCannotOpenFile'));
    }
  };

  const handleVerifyVoiceId = async (talentId: string) => {
    setVerifyingVoiceId(talentId);
    try {
      const res = await fetch('/api/admin/talents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: talentId, voice_id_status: 'verified' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(t('toastVidVerifiedOk'));
      fetchTalents();
    } catch {
      toast.error(t('toastVidVerifyFail'));
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
        toast.success(t('toastVidSent', { num: data.vidNumber }));
        fetchTalents();
      } else {
        toast.error(data.error || t('toastVidRequestFail'));
      }
    } catch {
      toast.error(t('toastVidSendFail'));
    } finally {
      setSendingVoiceId(null);
    }
  };

  // --- Human liveness verification (admin-selective; backend-only) ---
  // Open a private liveness recording via a short-lived admin signed URL.
  const playLiveness = async (path?: string) => {
    if (!path) return;
    try {
      const res = await fetch(`/api/admin/liveness/signed-url?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (res.ok && data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
      else toast.error(data.error || t('toastCannotOpenRecording'));
    } catch { toast.error(t('toastCannotOpenRecording')); }
  };

  const handleSendLiveness = async (talentId: string) => {
    setSendingLiveness(talentId);
    try {
      const res = await fetch('/api/admin/liveness', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ talentId }),
      });
      const data = await res.json();
      if (res.ok && data.success) { toast.success(t('toastLiveSent')); fetchTalents(); }
      else toast.error(data.error || t('toastLiveSendFail'));
    } catch { toast.error(t('toastLiveSendFail')); }
    finally { setSendingLiveness(null); }
  };

  const handleReviewLiveness = async (talentId: string, status: 'verified' | 'rejected') => {
    setReviewingLiveness(talentId);
    try {
      const res = await fetch('/api/admin/talents', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: talentId, liveness_status: status, liveness_reviewed_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(status === 'verified' ? t('toastLiveVerified') : t('toastLiveReturned'));
      fetchTalents();
    } catch { toast.error(t('toastLiveUpdateFail')); }
    finally { setReviewingLiveness(null); }
  };

  // Nudge a草稿中 talent to log in and finish their profile (so we can publish).
  const handleNudgeComplete = async (talentId: string) => {
    setNudging(talentId);
    try {
      const res = await fetch('/api/admin/talents/nudge-complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: talentId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) toast.success(t('toastNudgeSent', { to: data.to }));
      else toast.error(data.error || t('toastSendFail'));
    } catch { toast.error(t('toastSendFail')); }
    finally { setNudging(null); }
  };

  // Send an onboarding (activation) link to an Inactive talent — approved but who
  // never clicked the link to build their account. One-click 補寄; they land on
  // /onboard, 同意合作, and their account is created (→ Draft). Admin-triggered only.
  const handleSendOnboarding = async (talentId: string) => {
    setSendingOnboarding(talentId);
    try {
      const res = await fetch('/api/admin/talents/send-onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: talentId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) toast.success(t('toastOnboardingSent', { to: data.to }));
      else toast.error(data.error || t('toastSendFail'));
    } catch { toast.error(t('toastSendFail')); }
    finally { setSendingOnboarding(null); }
  };

  // --- Publish: promote the talent's draft into the public snapshot ---
  const openPublish = (talent: Talent) => {
    setPublishTarget(talent);
    // Prefill the talent's own bio (the source). The admin can tweak it here;
    // 简体 + English are auto-translated from it at publish time.
    const tt = talent as Talent & { bio?: string };
    setPubBio(tt.bio || '');
  };
  const handlePublish = async () => {
    if (!publishTarget) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/admin/talents/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ talentId: publishTarget.id, bio: pubBio }),
      });
      const data = await res.json();
      if (res.ok && data.success) { toast.success(t('toastPublished')); setPublishTarget(null); fetchTalents(); }
      else toast.error(data.error || t('toastPublishFail'));
    } catch { toast.error(t('toastPublishFail')); }
    finally { setPublishing(false); }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      const res = await fetch('/api/admin/talents/reject', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ talentId: rejectTarget.id, reason: rejectReason }),
      });
      const data = await res.json();
      if (res.ok && data.success) { toast.success(t('toastRejected')); setRejectTarget(null); setRejectReason(''); fetchTalents(); }
      else toast.error(data.error || t('toastRejectFail'));
    } catch { toast.error(t('toastRejectFail')); }
    finally { setRejecting(false); }
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
      toast.error(t('toastTalentLoadFail'));
    } finally {
      setLoading(false);
    }
  };

  const handleHeadshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error(t('toastHeadshotSelectImage'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('toastHeadshotTooLarge'));
      return;
    }

    setUploadingHeadshot(true);
    try {
      const safeName = sanitizeFileName(file.name);
      const path = `headshots/${Date.now()}-${safeName}`;
      const url = await uploadToStorage('talent-assets', path, file);
      setFormData(prev => ({ ...prev, headshot_url: url }));
      toast.success(t('toastHeadshotUploaded'));
    } catch (err) {
      console.error('Headshot upload error:', err);
      toast.error(t('toastHeadshotUploadFail'));
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
      toast.error(t('toastDemoSelectAudio'));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(t('toastDemoTooLarge'));
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
      toast.success(t('toastDemoUploaded'));
    } catch (err) {
      console.error('Demo upload error:', err);
      toast.error(t('toastDemoUploadFail'));
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
        english_name: formData.english_name.trim() || null,
        email: formData.email.trim() || null,
        gender: formData.gender || null,
        accent: formData.accent || null,
        languages: formData.languages,
        category: formData.category,
        tags: formData.tags,
        bio: formData.bio,
        portfolio_url: formData.portfolio_url || null,
        internal_cost: formData.internal_cost,
        is_active: formData.is_active,
        sort_order: formData.sort_order,
        headshot_url: formData.headshot_url || null,
        demo_urls: formData.demo_urls,
        payment_method: formData.payment_method || null,
        payment_details: formData.payment_method ? formData.payment_details : null,
        compensation_model: formData.compensation_model,
      };

      if (editingTalent) {
        const res = await fetch('/api/admin/talents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTalent.id, ...talentData }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || t('toastTalentSaveFail'));
        }
        toast.success(t('toastTalentUpdated'));
      } else {
        const res = await fetch('/api/admin/talents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(talentData),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || t('toastTalentSaveFail'));
        }
        toast.success(t('toastTalentCreated'));
      }

      setDialogOpen(false);
      resetForm();
      fetchTalents();
    } catch (error) {
      console.error("Error saving talent:", error);
      toast.error(error instanceof Error ? error.message : t('toastTalentSaveFail'));
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
      english_name: (talent as Talent & { english_name?: string }).english_name || "",
      email: talent.email || "",
      gender: talent.gender || "",
      accent: talent.accent || "",
      languages: talent.languages || [],
      category: talent.category,
      tags: talent.tags || [],
      bio: talent.bio || "",
      portfolio_url: talent.portfolio_url || "",
      internal_cost: talent.internal_cost,
      is_active: talent.is_active,
      sort_order: talent.sort_order,
      headshot_url: talent.headshot_url || "",
      demo_urls: (talent.demo_urls || []).filter(
        (d): d is { name: string; url: string } => Boolean(d?.name && d?.url),
      ),
      payment_method: talent.payment_method || "",
      payment_details: {
        paypal_email: pd?.paypal_email || "",
        bank_name: pd?.bank_name || "",
        bank_code: pd?.bank_code || "",
        account_name: pd?.account_name || "",
        account_number: pd?.account_number || "",
        swift_code: pd?.swift_code || "",
        bank_country: pd?.bank_country || "",
        notes: pd?.notes || "",
      },
      compensation_model: (talent.compensation_model || "commission") as "commission" | "buyout",
    });
    setDialogOpen(true);
  };

  // Send an already-published talent back to review (e.g. wrong language tags):
  // marks pending_review + takes them off the public site until re-published.
  const handleRevertToReview = async (talent: Talent) => {
    if (!confirm(t('confirmRevertReview', { name: talent.name }))) return;
    try {
      const res = await fetch('/api/admin/talents', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: talent.id, pending_review: true, is_active: false }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(t('toastRevertReview'));
      fetchTalents();
    } catch {
      toast.error(t('toastRevertFail'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      const res = await fetch(`/api/admin/talents?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success(t('toastTalentDeleted'));
      fetchTalents();
    } catch (error) {
      console.error("Error deleting talent:", error);
      toast.error(t('toastTalentDeleteFail'));
    }
  };

  const resetForm = () => {
    setEditingTalent(null);
    setFormData({
      type: "VO",
      name: "",
      english_name: "",
      email: "",
      gender: "",
      accent: "",
      languages: [],
      category: "in_house",
      tags: [],
      bio: "",
      portfolio_url: "",
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
        bank_country: "",
        notes: "",
      },
      compensation_model: "commission",
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

  // Derived status bucket — mirrors the Status column logic (pending_review wins,
  // then active, then onboarded-but-inactive = draft, else inactive).
  const tStatus = (t: Talent): 'active' | 'pending' | 'draft' | 'inactive' => {
    const tt = t as Talent & { onboarded_at?: string; pending_review?: boolean };
    if (tt.pending_review) return 'pending';
    if (t.is_active) return 'active';
    if (tt.onboarded_at) return 'draft';
    return 'inactive';
  };
  const isSinger = (t: Talent) => t.type === 'Singer' || t.type === 'singer';
  const hasApp = (t: Talent) => !!(t as Talent & { application_id?: string }).application_id;
  // Casting-invite account: auto-created from an audition invite (magic-link, no
  // signup). Flagged by the API. These have no application_id — they came in via
  // the試音 flow, not the apply form, so onboarding links don't apply to them.
  const isCastingInvite = (t: Talent) => !hasApp(t) && !!(t as Talent & { is_casting_invite?: boolean }).is_casting_invite;
  // Three-way source: 有 application → Application;無 application 但有試音邀請 → 試音邀請;其餘 → 手動加入。
  const sourceOf = (t: Talent): 'application' | 'casting' | 'manual' =>
    hasApp(t) ? 'application' : isCastingInvite(t) ? 'casting' : 'manual';

  const filtered = talents.filter((t) => {
    if (typeFilter === 'VO' && isSinger(t)) return false;
    if (typeFilter === 'Singer' && !isSinger(t)) return false;
    if (statusFilter !== 'all' && tStatus(t) !== statusFilter) return false;
    if (sourceFilter !== 'all' && sourceOf(t) !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      // Search the whole profile the talent filled — name/email plus bio,
      // languages, accent, voice traits, specialties, equipment, credits, etc.
      // Both raw keys (e.g. "commercial") and their localized labels (e.g. 廣告)
      // are matched, so Wing can type in Chinese or English. Tokens are joined
      // into one lowercased haystack per row.
      const p = t as TalentProfile;
      const parts: (string | undefined | null)[] = [
        p.name, p.english_name, ...(p.invite_names || []), p.email, p.bio, p.accent,
        p.special_skills, p.equipment, p.studio_partner, p.turnaround,
        p.clients, p.awards, p.notable_works, p.location,
      ];
      const arr = (v?: string[]) => (Array.isArray(v) ? v : []);
      for (const l of arr(p.languages)) { parts.push(l, formatLangEntry(l, locale)); }
      for (const k of arr(p.voice_traits)) { parts.push(k, traitLabel(k, locale)); }
      for (const k of arr(p.specialties)) { parts.push(k, useCaseLabel(k, locale)); }
      for (const k of arr(p.voice_ages)) { parts.push(k, voiceAgeLabel(k, locale)); }
      if (p.location) parts.push(countryLabel(p.location, locale));
      const hay = parts.filter(Boolean).join('  ').toLowerCase();
      return hay.includes(q);
    }
    return true;
  });

  const counts = {
    total: talents.length,
    active: talents.filter((t) => tStatus(t) === 'active').length,
    pending: talents.filter((t) => tStatus(t) === 'pending').length,
    draft: talents.filter((t) => tStatus(t) === 'draft').length,
    inactive: talents.filter((t) => tStatus(t) === 'inactive').length,
    // 拆出 Inactive 裡「試音邀請帳號」的數量,讓 Inactive 統計卡標明別誤當成待催激活。
    inactiveCasting: talents.filter((t) => tStatus(t) === 'inactive' && isCastingInvite(t)).length,
    liveness: talents.filter((t) => (t as Talent & { liveness_status?: string }).liveness_status === 'verified').length,
    voiceId: talents.filter((t) => (t as Talent & { voice_id_status?: string }).voice_id_status === 'verified').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 text-gray-900">
      <div className="flex justify-between items-start gap-3 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{t('title')}</h1>
          <p className="text-gray-600 text-sm">{t('subtitleCount', { count: talents.length })}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Plus className="w-4 h-4" />
              {t('addTalent')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white border-gray-200 text-gray-900">
            <DialogHeader>
              <DialogTitle className="text-gray-900 text-lg">
                {editingTalent ? t('formEditTitle') : t('formAddTitle')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Row 1: Type, Name, Email */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-700">{t('formType')}</Label>
                  <Select
                    value={formData.type}
                    onValueChange={v => setFormData({ ...formData, type: v })}
                  >
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300 text-gray-900">
                      <SelectItem value="VO" className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900">{t('formTypeVO')}</SelectItem>
                      <SelectItem value="Singer" className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900">{t('formTypeSinger')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700">{t('formName')}</Label>
                  <Input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder={t('formNamePlaceholder')}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                  />
                  <Input
                    value={formData.english_name}
                    onChange={e => setFormData({ ...formData, english_name: e.target.value })}
                    placeholder={t('formEnglishNamePlaceholder')}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700">{t('formEmail')}</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="talent@email.com"
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                  />
                  <p className="text-[11px] text-gray-500">{t('formEmailHint')}</p>
                </div>
              </div>

              {/* Row 2: Gender, Category */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-700">{t('formGender')}</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={v => setFormData({ ...formData, gender: v })}
                  >
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                      <SelectValue placeholder={t('formGenderPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300 text-gray-900">
                      <SelectItem value="Male" className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900">{t('formGenderMale')}</SelectItem>
                      <SelectItem value="Female" className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900">{t('formGenderFemale')}</SelectItem>
                      <SelectItem value="Non-binary" className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900">{t('formGenderNonBinary')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700">{t('formCategory')}</Label>
                  <Select
                    value={formData.category}
                    onValueChange={v => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300 text-gray-900">
                      <SelectItem value="in_house" className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900">{t('formCategoryInHouse')}</SelectItem>
                      <SelectItem value="featured" className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900">{t('formCategoryFeatured')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700">{t('formInternalCost')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.internal_cost}
                    onChange={e => setFormData({ ...formData, internal_cost: parseFloat(e.target.value) || 0 })}
                    className="bg-white border-gray-300 text-gray-900"
                  />
                  <p className="text-[11px] text-gray-500">{t('formInternalCostHint')}</p>
                </div>
              </div>

              {/* Sort Order */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-700">{t('formSortOrder')}</Label>
                  <Input
                    type="number"
                    value={formData.sort_order}
                    onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
              </div>

              {/* Headshot Upload */}
              <div className="space-y-2">
                <Label className="text-gray-700">{t('formHeadshot')}</Label>
                <div className="flex items-start gap-4">
                  {formData.headshot_url ? (
                    <div className="relative group">
                      <img
                        src={formData.headshot_url}
                        alt="Headshot"
                        className="w-24 h-24 object-cover rounded-xl border border-gray-300"
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
                    <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
                      <User className="w-8 h-8 text-gray-400" />
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
                      className="border-gray-300 text-gray-700 hover:bg-gray-100 gap-2"
                    >
                      {uploadingHeadshot ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('formUploading')}</>
                      ) : (
                        <><ImagePlus className="w-3.5 h-3.5" /> {t('formUploadPhoto')}</>
                      )}
                    </Button>
                    <p className="text-[11px] text-gray-500">{t('formHeadshotHint')}</p>
                  </div>
                </div>
              </div>

              {/* Languages (searchable multi-select) */}
              <SearchableMultiSelect
                label={t('formLanguages')}
                options={ALL_LANGUAGES}
                selected={formData.languages}
                onChange={langs => setFormData(prev => ({ ...prev, languages: langs }))}
                placeholder={t('formLanguagesSearch')}
              />

              {/* Accent (searchable single-select) */}
              <SearchableSelect
                label={t('formAccent')}
                options={ALL_ACCENTS}
                value={formData.accent}
                onChange={val => setFormData(prev => ({ ...prev, accent: val }))}
                placeholder={t('formAccentSearch')}
              />

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-gray-700">{t('formTags')}</Label>
                <div className="grid grid-cols-4 gap-x-4 gap-y-2 p-3 rounded-lg bg-white border border-gray-200">
                  {AVAILABLE_TAGS.map(tag => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.tags.includes(tag)}
                        onCheckedChange={() => toggleTag(tag)}
                        className="border-gray-400 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                      <label className="text-sm text-gray-700 cursor-pointer" onClick={() => toggleTag(tag)}>{tag}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Biography */}
              <div className="space-y-2">
                <Label className="text-gray-700">{t('formBio')}</Label>
                <Textarea
                  value={formData.bio}
                  onChange={e => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  placeholder={t('formBioPlaceholder')}
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 resize-y"
                />
              </div>

              {/* 網站 / 作品集連結 — 內部參考,不公開給客戶 */}
              <div className="space-y-2">
                <Label className="text-gray-700">{t('formPortfolio')} <span className="text-gray-400 font-normal">{t('formPortfolioNote')}</span></Label>
                <input
                  type="url"
                  value={formData.portfolio_url}
                  onChange={e => setFormData({ ...formData, portfolio_url: e.target.value })}
                  placeholder="https://…"
                  className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder:text-gray-400"
                />
              </div>

              {/* Audio Demos */}
              <div className="space-y-3">
                <Label className="text-gray-700">{t('formDemos')}</Label>

                {formData.demo_urls.length > 0 && (
                  <div className="space-y-2">
                    {formData.demo_urls.map((demo, index) => (
                      <div key={index} className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-gray-200">
                        <Music className="w-4 h-4 text-cyan-700 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{demo.name}</p>
                          <p className="text-[11px] text-gray-500 truncate">{demo.url}</p>
                        </div>
                        <a href={demo.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 hover:text-blue-700 flex-shrink-0">
                          {t('formDemoPreview')}
                        </a>
                        <button type="button" onClick={() => removeDemo(index)} className="text-gray-500 hover:text-red-700 p-1 flex-shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] text-gray-500">{t('formDemoLabel')}</label>
                    <Input
                      type="text"
                      value={newDemoName}
                      onChange={e => setNewDemoName(e.target.value)}
                      placeholder={t('formDemoLabelPlaceholder')}
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 h-9 text-sm"
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
                      className="border-gray-300 text-gray-700 hover:bg-gray-100 gap-2 h-9"
                    >
                      {uploadingDemo ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('formUploading')}</>
                      ) : (
                        <><Upload className="w-3.5 h-3.5" /> {t('formUploadAudio')}</>
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500">{t('formDemoHint')}</p>
              </div>

              {/* Compensation Model */}
              <div className="space-y-3 pt-3 border-t border-gray-200">
                <Label className="text-gray-700 font-semibold text-sm">{t('formCompensation')}</Label>
                <div className="space-y-2">
                  <Select
                    value={formData.compensation_model}
                    onValueChange={v => setFormData({ ...formData, compensation_model: v as "commission" | "buyout" })}
                  >
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300">
                      <SelectItem value="commission" className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900">
                        {t('formCompCommission')}
                      </SelectItem>
                      <SelectItem value="buyout" className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900">
                        {t('formCompBuyout')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-gray-500">
                    {formData.compensation_model === "commission"
                      ? t('formCompCommissionHint')
                      : t('formCompBuyoutHint')}
                  </p>
                </div>
              </div>

              {/* Payment Info */}
              <div className="space-y-3 pt-3 border-t border-gray-200">
                <Label className="text-gray-700 font-semibold text-sm">{t('formPayment')}</Label>
                <div className="space-y-2">
                  <Label className="text-gray-600 text-xs">{t('formPaymentMethod')}</Label>
                  <Select
                    value={formData.payment_method || "none"}
                    onValueChange={v => setFormData({ ...formData, payment_method: v === "none" ? "" : v })}
                  >
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300">
                      <SelectItem value="none" className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900">{t('formPaymentNotSet')}</SelectItem>
                      <SelectItem value="paypal" className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900">{t('formPaymentPaypal')}</SelectItem>
                      <SelectItem value="bank_transfer" className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900">{t('formPaymentBank')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.payment_method === "paypal" && (
                  <div className="space-y-2">
                    <Label className="text-gray-600 text-xs">{t('formPaypalEmail')}</Label>
                    <Input
                      type="email"
                      placeholder="talent@example.com"
                      value={formData.payment_details.paypal_email}
                      onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, paypal_email: e.target.value } })}
                      className="bg-white border-gray-300 text-gray-900"
                    />
                  </div>
                )}

                {formData.payment_method === "bank_transfer" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">{t('formBankName')}</Label>
                        <Input
                          placeholder={t('formBankNamePlaceholder')}
                          value={formData.payment_details.bank_name}
                          onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, bank_name: e.target.value } })}
                          className="bg-white border-gray-300 text-gray-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">{t('formBankCode')}</Label>
                        <Input
                          placeholder={t('formBankCodePlaceholder')}
                          value={formData.payment_details.bank_code}
                          onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, bank_code: e.target.value } })}
                          className="bg-white border-gray-300 text-gray-900"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">{t('formAccountName')}</Label>
                        <Input
                          placeholder={t('formAccountNamePlaceholder')}
                          value={formData.payment_details.account_name}
                          onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, account_name: e.target.value } })}
                          className="bg-white border-gray-300 text-gray-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">{t('formAccountNumber')}</Label>
                        <Input
                          placeholder={t('formAccountNumberPlaceholder')}
                          value={formData.payment_details.account_number}
                          onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, account_number: e.target.value } })}
                          className="bg-white border-gray-300 text-gray-900"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">{t('formSwift')}</Label>
                        <Input
                          placeholder={t('formSwiftPlaceholder')}
                          value={formData.payment_details.swift_code}
                          onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, swift_code: e.target.value } })}
                          className="bg-white border-gray-300 text-gray-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-600 text-xs">{t('formBankCountry')}</Label>
                        <Input
                          placeholder={t('formBankCountryPlaceholder')}
                          value={formData.payment_details.bank_country}
                          onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, bank_country: e.target.value } })}
                          className="bg-white border-gray-300 text-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.payment_method && (
                  <div className="space-y-1">
                    <Label className="text-gray-600 text-xs">{t('formNotes')}</Label>
                    <Input
                      placeholder={t('formNotesPlaceholder')}
                      value={formData.payment_details.notes}
                      onChange={e => setFormData({ ...formData, payment_details: { ...formData.payment_details, notes: e.target.value } })}
                      className="bg-white border-gray-300 text-gray-900"
                    />
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center space-x-3 pt-2 border-t border-gray-200">
                <Checkbox
                  checked={formData.is_active}
                  onCheckedChange={checked => setFormData({ ...formData, is_active: checked as boolean })}
                  className="border-gray-400 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
                <Label className="text-gray-700">{t('formActive')}</Label>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-300 text-gray-700 hover:bg-gray-100">
                  {t('formCancel')}
                </Button>
                <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-w-[120px]">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('formSaving')}</> : t('formSaveTalent')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats — shared admin module (matches Orders / Applications) */}
      <AdminStats items={[
        { label: t('statTotal'), value: counts.total },
        { label: t('statActive'), value: counts.active, color: 'text-emerald-700' },
        { label: t('statPending'), value: counts.pending, color: 'text-amber-700' },
        { label: t('statDraft'), value: counts.draft, color: 'text-sky-700' },
        {
          // Inactive 混了三種來源;標明其中有幾個是「試音邀請帳號」(不該催激活),
          // 老闆一眼就分得清,數字本身仍是完整 Inactive 總數不變。
          label: (
            <span className="inline-flex flex-col">
              <span>{t('statInactive')}</span>
              {counts.inactiveCasting > 0 && (
                <span className="text-[11px] text-gray-400 font-normal">{t('statInactiveCasting', { count: counts.inactiveCasting })}</span>
              )}
            </span>
          ),
          value: counts.inactive,
          color: 'text-gray-500',
        },
        { label: t('statLiveness'), value: counts.liveness, color: 'text-emerald-700' },
        { label: t('statVoiceId'), value: counts.voiceId, color: 'text-cyan-700' },
      ]} />

      {/* Filters — search + type / status / source */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none">
            <option value="all">{t('filterAllTypes')}</option>
            <option value="VO">{t('filterVoiceActors')}</option>
            <option value="Singer">{t('filterSingers')}</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none">
            <option value="all">{t('filterAllStatus')}</option>
            <option value="active">{t('filterActive')}</option>
            <option value="pending">{t('filterPending')}</option>
            <option value="draft">{t('filterDraft')}</option>
            <option value="inactive">{t('filterInactive')}</option>
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)} className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none">
            <option value="all">{t('filterAllSources')}</option>
            <option value="application">{t('filterSourceApplication')}</option>
            <option value="casting">{t('filterSourceCasting')}</option>
            <option value="manual">{t('filterSourceManual')}</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-200 hover:bg-transparent">
              <TableHead className="text-gray-600 font-semibold">{t('colName')}</TableHead>
              <TableHead className="text-gray-600 font-semibold">{t('colType')}</TableHead>
              <TableHead className="text-gray-600 font-semibold">{t('colSource')}</TableHead>
              <TableHead className="text-gray-600 font-semibold">{t('colLanguages')}</TableHead>
              <TableHead className="text-gray-600 font-semibold">{t('colPrice')}</TableHead>
              <TableHead className="text-gray-600 font-semibold">{t('colEarnings')}</TableHead>
              <TableHead className="text-gray-600 font-semibold">{t('colVoiceId')}</TableHead>
              <TableHead className="text-gray-600 font-semibold">{t('colLiveness')}</TableHead>
              <TableHead className="text-gray-600 font-semibold">{t('colStatus')}</TableHead>
              <TableHead className="text-gray-600 font-semibold">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((talent) => (
              <TableRow key={talent.id} className="border-gray-200 hover:bg-gray-100/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    {talent.headshot_url ? (
                      <img src={talent.headshot_url} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-300" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                    )}
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-gray-900">{talent.name || 'N/A'}</span>
                      {talent.compensation_model === 'buyout' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 w-fit">
                          {t('badgeBuyout')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit" title={t('badgeCommissionTip')}>
                          {t('badgeCommission')}
                        </span>
                      )}
                      {(() => {
                        // Cooperation opt-ins the talent themselves ticked — show only the
                        // DIFFERENTIATING ones (everyone accepts regular jobs; these aren't
                        // universal). Lets Wing see at a glance who's open to buyout / AI /
                        // low-price data before assigning that kind of work.
                        const c = talent as unknown as Record<string, boolean>;
                        const flags = [
                          c.coop_open_buyout && { t: t('coopBuyout'), cls: 'bg-purple-50 text-purple-700 border-purple-200' },
                          c.coop_ai_clone && { t: t('coopAiClone'), cls: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
                          c.coop_ai_training && { t: t('coopAiTraining'), cls: 'bg-sky-50 text-sky-700 border-sky-200' },
                          c.low_price_data_optin && { t: t('coopLowPriceData'), cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                          c.coop_proofread && { t: t('coopProofread'), cls: 'bg-teal-50 text-teal-700 border-teal-200' },
                          c.coop_voice_director && { t: t('coopVoiceDirector'), cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                        ].filter(Boolean) as { t: string; cls: string }[];
                        if (!flags.length) return null;
                        return (
                          <div className="flex flex-wrap gap-1 mt-0.5" title={t('coopTip')}>
                            {flags.map((f) => (
                              <span key={f.t} className={`inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium border w-fit ${f.cls}`}>{f.t}</span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="capitalize text-gray-700">
                  {talent.type === 'Singer' || talent.type === 'singer' ? t('typeSinger') : talent.type === 'VO' || talent.type === 'voice_actor' ? t('typeVoiceActor') : talent.type?.replace("_", " ") || 'N/A'}
                </TableCell>
                <TableCell>
                  {/* 三態來源:申請表 / 試音邀請 / 手動加入 —— 老闆一眼分清 Inactive 是誰。 */}
                  {sourceOf(talent) === 'application' ? (
                    <a
                      href="/admin/applications"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-500/25 hover:bg-amber-500/25 transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                      {t('sourceApplication')}
                      <ArrowUpRight className="w-2.5 h-2.5" />
                    </a>
                  ) : sourceOf(talent) === 'casting' ? (
                    <span
                      title={t('sourceCastingTip')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200"
                    >
                      {t('sourceCasting')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-200/50 text-gray-600 border border-gray-400/50">
                      {t('sourceManual')}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {talent.languages && talent.languages.length > 0 ? (
                      <>
                        {talent.languages.slice(0, 2).map(lang => (
                          <Badge key={lang} className="bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 text-[11px]">{formatLangEntry(lang, locale)}</Badge>
                        ))}
                        {talent.languages.length > 2 && (
                          <Badge className="bg-gray-100 text-gray-700 border border-gray-300 text-[11px]">+{talent.languages.length - 2}</Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-600 text-sm">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {/* 人才管理 = real-person roster → always quote-based (Wing 2026-06-28).
                      The flat $499 is the AI-voice product price and lives elsewhere. */}
                  <span className="text-gray-600 text-sm">{t('priceQuoteBased')}</span>
                </TableCell>
                <TableCell>
                  {(() => {
                    const es = (talent as any).earnings_summary;
                    if (!es) return <span className="text-gray-600 text-sm">—</span>;
                    return (
                      <a href={`/admin/payouts?talent=${talent.id}`} className="group space-y-0.5">
                        <div className="text-xs">
                          <span className="text-green-700 font-medium">US${es.paid.toFixed(0)}</span>
                          <span className="text-gray-500"> {t('earningsPaid')}</span>
                        </div>
                        {es.pending > 0 && (
                          <div className="text-xs">
                            <span className="text-amber-700 font-medium">US${es.pending.toFixed(0)}</span>
                            <span className="text-gray-500"> {t('earningsPending')}</span>
                          </div>
                        )}
                        <span className="text-[10px] text-gray-600 group-hover:text-gray-600">{t('earningsOrders', { count: es.count })}</span>
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
                          <CheckCircle className="w-3.5 h-3.5 text-green-700" />
                          <span className="text-green-700 text-xs font-medium">{vid.voice_id_number}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {vid.voice_id_file_url && (
                            <button type="button" onClick={() => openSigned(vid.voice_id_file_url)} className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-700 bg-blue-50 hover:bg-blue-50 rounded px-2 py-0.5">
                              <Music className="w-3 h-3" /> {t('vidPlay')}
                            </button>
                          )}
                          {vid.voice_id_signature_url && (
                            <button type="button" onClick={() => openSigned(vid.voice_id_signature_url)} className="inline-flex items-center gap-1 text-[11px] text-purple-700 hover:text-purple-700 bg-purple-50 hover:bg-purple-50 rounded px-2 py-0.5">
                              <ExternalLink className="w-3 h-3" /> {t('vidSignature')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                    if (status === 'submitted') return (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-blue-700" />
                          <span className="text-blue-700 text-xs font-medium">{t('vidSubmittedReview')}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {vid.voice_id_file_url && (
                            <button type="button" onClick={() => openSigned(vid.voice_id_file_url)} className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-700 bg-blue-50 hover:bg-blue-50 rounded px-2 py-0.5">
                              <Music className="w-3 h-3" /> {t('vidPlay')}
                            </button>
                          )}
                          {vid.voice_id_signature_url && (
                            <button type="button" onClick={() => openSigned(vid.voice_id_signature_url)} className="inline-flex items-center gap-1 text-[11px] text-purple-700 hover:text-purple-700 bg-purple-50 hover:bg-purple-50 rounded px-2 py-0.5">
                              <ExternalLink className="w-3 h-3" /> {t('vidSignature')}
                            </button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVerifyVoiceId(talent.id)}
                            disabled={verifyingVoiceId === talent.id}
                            className="text-green-700 hover:text-green-700 hover:bg-green-50 h-6 px-2 text-[11px]"
                          >
                            {verifyingVoiceId === talent.id ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            )}
                            {t('vidVerify')}
                          </Button>
                        </div>
                      </div>
                    );
                    if (status === 'requested') return (
                      <Button variant="ghost" size="sm" onClick={() => handleSendVoiceIdRequest(talent.id)} disabled={sendingVoiceId === talent.id} className="text-amber-700 hover:text-green-700 hover:bg-green-50 h-7 px-2 text-xs">
                        {sendingVoiceId === talent.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />} {t('vidRequestedResend')}
                      </Button>
                    );
                    return (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSendVoiceIdRequest(talent.id)}
                        disabled={sendingVoiceId === talent.id}
                        className="text-gray-500 hover:text-green-700 hover:bg-green-50 h-7 px-2 text-xs"
                      >
                        {sendingVoiceId === talent.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Send className="w-3 h-3 mr-1" />
                        )}
                        {t('vidSendRequest')}
                      </Button>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  {(() => {
                    const lv = talent as Talent & { liveness_status?: string; liveness_recording_path?: string };
                    const s = lv.liveness_status || 'none';
                    if (s === 'verified') return (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-green-700" />
                        <span className="text-green-700 text-xs font-medium">{t('livePerson')}</span>
                      </div>
                    );
                    if (s === 'submitted') return (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-blue-700" />
                          <span className="text-blue-700 text-xs font-medium">{t('livePendingReview')}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {lv.liveness_recording_path && (
                            <button type="button" onClick={() => playLiveness(lv.liveness_recording_path)} className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 rounded px-2 py-0.5">
                              <Music className="w-3 h-3" /> {t('liveListen')}
                            </button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleReviewLiveness(talent.id, 'verified')} disabled={reviewingLiveness === talent.id} className="text-green-700 hover:text-green-700 hover:bg-green-50 h-6 px-2 text-[11px]">
                            {reviewingLiveness === talent.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />} {t('liveMarkPerson')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleReviewLiveness(talent.id, 'rejected')} disabled={reviewingLiveness === talent.id} className="text-red-700 hover:text-red-700 hover:bg-red-50 h-6 px-2 text-[11px]">
                            <X className="w-3 h-3 mr-1" /> {t('liveReject')}
                          </Button>
                        </div>
                      </div>
                    );
                    if (s === 'sent') return (
                      <Button variant="ghost" size="sm" onClick={() => handleSendLiveness(talent.id)} disabled={sendingLiveness === talent.id} className="text-amber-700 hover:text-green-700 hover:bg-green-50 h-7 px-2 text-xs">
                        {sendingLiveness === talent.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />} {t('liveSentResend')}
                      </Button>
                    );
                    return (
                      <Button variant="ghost" size="sm" onClick={() => handleSendLiveness(talent.id)} disabled={sendingLiveness === talent.id} className={`hover:text-green-700 hover:bg-green-50 h-7 px-2 text-xs ${s === 'rejected' ? 'text-red-600' : 'text-gray-500'}`}>
                        {sendingLiveness === talent.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />} {s === 'rejected' ? t('liveRejectedResend') : t('liveSendVerify')}
                      </Button>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  {(() => {
                    const tt = talent as Talent & { onboarded_at?: string; pending_review?: boolean };
                    const onboarded = !!tt.onboarded_at;
                    if (talent.is_active) {
                      return tt.pending_review
                        ? <Badge className="bg-amber-50 text-amber-700 border border-amber-300">{t('statusEditPending')}</Badge>
                        : <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">{t('statusActive')}</Badge>;
                    }
                    if (tt.pending_review) return <Badge className="bg-amber-50 text-amber-700 border border-amber-300">{t('statusPending')}</Badge>;
                    if (onboarded) return (
                      <div className="flex flex-col items-start gap-1">
                        <Badge className="bg-sky-50 text-sky-700 border border-sky-200">{t('statusDraft')}</Badge>
                        <button type="button" onClick={() => handleNudgeComplete(talent.id)} disabled={nudging === talent.id} title={t('statusNudgeTip')} className="text-[11px] text-amber-700 hover:text-amber-800 hover:underline disabled:opacity-50 inline-flex items-center gap-1">
                          {nudging === talent.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} {t('statusNudge')}
                        </button>
                      </div>
                    );
                    // Inactive 混三種來源。只有「真申請者(有 application_id)」才是
                    // 核准了但沒點連結建帳號 → 顯示「寄激活連結」。試音邀請 / 手動加入
                    // 沒有 application_id,產不出開通連結(後端會擋),不顯示按鈕免白點,
                    // 改標一行說明來源,老闆知道這不是待催的申請者。
                    return (
                      <div className="flex flex-col items-start gap-1">
                        <Badge className="bg-gray-200 text-gray-600 border border-gray-400">{t('statusInactive')}</Badge>
                        {hasApp(talent) ? (
                          <button type="button" onClick={() => handleSendOnboarding(talent.id)} disabled={sendingOnboarding === talent.id} title={t('statusSendActivationTip')} className="text-[11px] text-emerald-700 hover:text-emerald-800 hover:underline disabled:opacity-50 inline-flex items-center gap-1">
                            {sendingOnboarding === talent.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} {t('statusSendActivation')}
                          </button>
                        ) : (
                          <span className="text-[11px] text-gray-400" title={isCastingInvite(talent) ? t('statusCastingAccountTip') : t('statusManualAccountTip')}>
                            {isCastingInvite(talent) ? t('statusCastingAccount') : t('statusManualAccount')}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2 flex-wrap">
                    {/* Always available — see the full profile the talent filled
                        (incl. unpublished draft), no need to open the front portal. */}
                    <Button variant="outline" size="sm" onClick={() => setProfileTarget(talent)} className="h-8 px-3 border-gray-300 text-gray-700 hover:bg-gray-100">
                      <Eye className="w-3.5 h-3.5 mr-1" /> {t('actionFullProfile')}
                    </Button>
                    {(() => {
                      const tt = talent as Talent & { onboarded_at?: string; pending_review?: boolean };
                      // Pending submission → review (approve / send back).
                      if (tt.pending_review) {
                        return (
                          <>
                            <Button variant="outline" size="sm" onClick={() => openPublish(talent)} className="h-8 px-3 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-700">
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> {t('actionReview')}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { setRejectTarget(talent); setRejectReason(''); }} className="h-8 px-3 bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-700">
                              <Send className="w-3.5 h-3.5 mr-1" /> {t('actionSendBack')}
                            </Button>
                          </>
                        );
                      }
                      // Already live → allow re-publishing to regenerate the public
                      // snapshot (e.g. after a translation-logic change or field-visibility change).
                      if (talent.is_active) {
                        return (
                          <>
                            <Button variant="outline" size="sm" onClick={() => openPublish(talent)} className="h-8 px-3 border-gray-300 text-gray-600 hover:bg-gray-100">
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> {t('actionRepublish')}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleRevertToReview(talent)} className="h-8 px-3 bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-700">
                              <Clock className="w-3.5 h-3.5 mr-1" /> {t('actionRevertReview')}
                            </Button>
                          </>
                        );
                      }
                      return null;
                    })()}
                    <Button variant="outline" size="sm" onClick={() => handleEdit(talent)} title={t('actionBackendEditTip')} className="h-8 px-3 border-gray-400 text-gray-700 hover:bg-gray-200 hover:text-gray-900">
                      <Edit className="w-3.5 h-3.5 mr-1" /> {t('actionBackendEdit')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(talent.id)} className="h-8 px-3 bg-red-50 hover:bg-red-50 border-red-200 text-red-700">
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> {t('actionDelete')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-gray-500">
                  {talents.length === 0
                    ? 'No talents registered yet. Click “Add Talent” to get started.'
                    : 'No talents match your filters.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > 0 && (
        <p className="text-center text-xs text-gray-500 mt-6">Showing {filtered.length} of {talents.length} talents</p>
      )}

      {/* Publish dialog — promote draft to public snapshot with bio translations */}
      <Dialog open={!!publishTarget} onOpenChange={(o) => !o && setPublishTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-gray-200 text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-gray-900 text-lg">{t('publishTitle', { name: publishTarget?.name ?? '' })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Read-only review of exactly what the talent submitted — same
                component as the standalone 完整檔案 viewer (single source). */}
            {publishTarget && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <TalentProfileCard t={publishTarget as TalentProfile} locale={locale} />
              </div>
            )}
            <p className="text-sm text-gray-600">
              {t('publishHint')}
              <span className="text-gray-400">{t('publishHintTranslate')}</span>
            </p>
            <div>
              <Label className="text-gray-700">{t('publishBioLabel')}</Label>
              <Textarea value={pubBio} onChange={(e) => setPubBio(e.target.value)} className="min-h-[100px] mt-1" placeholder={t('publishBioPlaceholder')} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPublishTarget(null)} className="border-gray-300 text-gray-700">{t('publishCancel')}</Button>
              <Button onClick={handlePublish} disabled={publishing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {publishing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />} {t('publishConfirm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 完整檔案 — read-only view of everything the talent filled on /talent,
          including unpublished drafts, so Wing never has to open the front portal.
          Payout/bank details are NOT shown here (they live encrypted in
          /admin/payout-details); this is profile content only. */}
      <Dialog open={!!profileTarget} onOpenChange={(o) => !o && setProfileTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-gray-200 text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-gray-900 text-lg">{t('profileTitle', { name: profileTarget?.name ?? '' })}</DialogTitle>
          </DialogHeader>
          {profileTarget && (
            <>
              <TalentProfileCard t={profileTarget as TalentProfile} locale={locale} />
              <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-gray-200">
                <Button variant="outline" onClick={() => { const pt = profileTarget; setProfileTarget(null); if (pt) handleEdit(pt); }} className="border-gray-300 text-gray-700 hover:bg-gray-100">
                  <Edit className="w-4 h-4 mr-1" /> {t('profileBackendEdit')}
                </Button>
                <Button variant="outline" onClick={() => setProfileTarget(null)} className="border-gray-300 text-gray-700">{t('profileClose')}</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject / changes-requested dialog — emails the talent what to fix */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-lg bg-white border-gray-200 text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-gray-900 text-lg">{t('rejectTitle', { name: rejectTarget?.name ?? '' })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t('rejectHint')}</p>
            {(() => {
              const langs = (rejectTarget as (Talent & { languages?: string[] }) | null)?.languages || [];
              const rejLang: 'tw' | 'en' = langs.length === 0 || langs.some((l) => /chinese|中文|mandarin|cantonese|taiwan|粵|普通/i.test(l)) ? 'tw' : 'en';
              const lineFor = (rr: typeof REJECT_REASONS[number]) => '・' + (rejLang === 'tw' ? rr.tw : rr.en);
              const toggle = (rr: typeof REJECT_REASONS[number]) => {
                const line = lineFor(rr);
                setRejectReason((prev) => {
                  const lines = prev ? prev.split('\n') : [];
                  const i = lines.indexOf(line);
                  if (i >= 0) lines.splice(i, 1); else lines.push(line);
                  return lines.filter(Boolean).join('\n');
                });
              };
              return (
                <div className="flex flex-wrap gap-1.5">
                  {REJECT_REASONS.map((rr) => {
                    const on = rejectReason.includes(lineFor(rr));
                    return (
                      <button key={rr.key} type="button" onClick={() => toggle(rr)}
                        className={`text-xs rounded-full px-3 py-1 border transition-colors ${on ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400'}`}>
                        {on ? '✓ ' : '+ '}{rr.label}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="min-h-[120px]" placeholder={t('rejectPlaceholder')} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setRejectTarget(null)} className="border-gray-300 text-gray-700">{t('rejectCancel')}</Button>
              <Button onClick={handleReject} disabled={rejecting || !rejectReason.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">
                {rejecting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />} {t('rejectSend')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
