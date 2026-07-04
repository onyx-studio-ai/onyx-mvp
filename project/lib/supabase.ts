import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// autoRefreshToken:client 在背景自動把過期的 access_token 續掉(這正是 authedFetch
// 每次即時 getSession() 能拿到有效 token 的前提)。persistSession:重新整理仍保留登入。
// detectSessionInUrl:維持既有行為(密碼重設 / OAuth 回跳解析 URL 裡的 session)。
// 這三個本來就是 v2 預設值,明確寫出來是為了避免日後被誤改而重現「1 小時後被登出」。
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});

export type Order = {
  id: string;
  email: string;
  language: string;
  voice_selection: string;
  script_text: string;
  status: string;
  created_at: string;
  updated_at: string | null;
  order_number: number;
  tone_style: string;
  use_case: string;
  broadcast_rights: boolean;
  rights_level: string | null;
  download_url: string | null;
  tier: string;
  price: number;
  duration: number;
  project_name: string;
  talent_id: string | null;
  talent_price: number;
  payment_status: string | null;
  paid_at: string | null;
  transaction_id: string | null;
  billing_details: Record<string, unknown> | null;
  user_id: string | null;
};

export type Vibe = {
  id: string;
  title: string;
  genre: string;
  description: string;
  image_url: string;
  audio_url: string;
  created_at: string;
};

export type AudioShowcase = {
  id: string;
  section: string;
  slot_key: string;
  audio_url: string | null;
  label: string | null;
  subtitle: string | null;
  description: string | null;
  tags: string[];
  sort_order: number;
  updated_at: string;
};

export type Talent = {
  id: string;
  name: string;
  email: string | null;
  type: 'VO' | 'Singer' | string;
  category: 'in_house' | 'featured' | string;
  gender: string | null;
  accent: string | null;
  headshot_url: string | null;
  sample_url: string | null;
  demo_urls: { name?: string; url: string; label?: string }[];
  internal_cost: number;
  frontend_price: number;
  languages: string[];
  tags: string[];
  bio: string | null;
  portfolio_url: string | null;   // 網站/作品集連結:內部參考,不進 published_snapshot、不給客戶
  is_active: boolean;
  sort_order: number;
  created_at: string;
  voice_id_status?: string;
  voice_id_number?: string;
  voice_id_file_url?: string;
  voice_id_submitted_at?: string;
  voice_id_signature_url?: string;
  application_id?: string | null;
  phone?: string | null;
  country?: string | null;
  expected_rates?: Record<string, number | null> | null;
  payment_method?: 'paypal' | 'bank_transfer' | null;
  payment_details?: {
    paypal_email?: string;
    bank_name?: string;
    bank_code?: string;
    account_name?: string;
    account_number?: string;
    swift_code?: string;
    notes?: string;
  } | null;
  /**
   * Wing's two-path payout model (2026-06-07):
   *  - 'commission' (default): talent earns 25% of each platform AI
   *    generation sale. Ongoing revenue share.
   *  - 'buyout': Onyx pays talent a one-off lump sum. 100% of future
   *    platform revenue from that voice flows to Onyx. No royalty.
   * Wing decides per-talent (not talent self-selection — avoids
   * adverse selection). New talents default to 'commission'; flip
   * to 'buyout' from /admin/talents only after evaluation.
   */
  compensation_model?: 'commission' | 'buyout';
};
