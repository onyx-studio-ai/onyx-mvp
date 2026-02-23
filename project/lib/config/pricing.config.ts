/**
 * ============================================================================
 * ONYX PRICING CONFIGURATION - SINGLE SOURCE OF TRUTH
 * ============================================================================
 *
 * This file controls ALL pricing across the entire platform.
 *
 * IMPORTANT FOR NON-TECHNICAL EDITORS:
 * - Only edit the NUMBER VALUES in the sections marked "EDIT HERE"
 * - Do NOT change variable names or structure
 * - Prices should be whole numbers (no quotes, no dollar signs)
 * - Keep descriptions in quotes
 *
 * After editing, save this file and rebuild the project.
 * ============================================================================
 */

// ============================================================================
// MUSIC SERVICE PRICING
// ============================================================================

export const MUSIC_TIERS = [
  {
    id: 'ai-curator',
    name: 'AI Curator',
    price: 999, // ← EDIT HERE: Base price in dollars
    badge: '⚡ AI-Powered',
    description: 'AI-generated composition with professional polish',
    features: [
      'AI composition engine',
      'Professional mixing',
      'Non-exclusive license',
      'Personal/Internal use',
      '2 revision rounds'
    ],
    gradient: 'from-slate-600 to-slate-700',
    popular: false,
  },
  {
    id: 'pro-arrangement',
    name: 'Pro Arrangement',
    price: 2499, // ← EDIT HERE: Base price in dollars
    badge: '✨ Human Producer',
    description: 'Human arrangement with live guitar. Radio-ready production.',
    features: [
      'Human arrangement & production',
      'Live guitar & real instruments',
      'Master rights included',
      'Commercial licensing',
      '3 revision rounds',
      'Priority turnaround'
    ],
    gradient: 'from-blue-600 to-cyan-600',
    popular: true, // This tier shows "MOST POPULAR" badge
  },
  {
    id: 'masterpiece',
    name: 'Masterpiece',
    price: 4999, // ← EDIT HERE: Base price in dollars
    badge: '👑 Full Ownership',
    description: 'Complete copyright ownership. Includes 5 complimentary revision rounds.',
    features: [
      'Full copyright buyout',
      'Work-for-hire agreement',
      'Premium studio session',
      'Live orchestra option',
      'Dedicated producer',
      '5 complimentary revision rounds',
      'Global licensing rights'
    ],
    gradient: 'from-amber-600 to-orange-600',
    popular: false,
  },
];

export const MUSIC_STRING_ADDONS = [
  {
    id: 'intimate-ensemble',
    name: 'Intimate Ensemble',
    players: 12,
    price: 749, // ← EDIT HERE: Add-on price in dollars
    description: 'Perfect for indie films, intimate scenes, boutique commercials',
    popular: false,
  },
  {
    id: 'rich-studio-strings',
    name: 'Rich Studio Strings',
    players: 16,
    price: 899, // ← EDIT HERE: Add-on price in dollars
    description: 'Industry standard for TV, games, premium content',
    popular: true, // This tier shows "RECOMMENDED" badge
  },
  {
    id: 'cinematic-symphony',
    name: 'Cinematic Symphony',
    players: 24,
    price: 1299, // ← EDIT HERE: Add-on price in dollars
    description: 'Epic trailers, AAA games, major film productions',
    popular: false,
  },
];

// ============================================================================
// ORCHESTRA / LIVE STRINGS SERVICE PRICING (Standalone)
// ============================================================================

export const ORCHESTRA_TIERS = [
  {
    id: 'tier1',
    name: 'Pop / Indie Setup',
    players: 11,
    section: '(4-3-2-2-0) No Double Bass',
    basePrice: 899,        // ← EDIT HERE: Base price in dollars
    overagePerMin: 200,    // ← EDIT HERE: Price per extra minute
    includedMinutes: 4,
    suitable: 'Pop, R&B, EDM where synth bass dominates.',
  },
  {
    id: 'tier2',
    name: 'Acoustic Chamber',
    players: 16,
    section: '(5-4-3-3-1)',
    basePrice: 1149,       // ← EDIT HERE
    overagePerMin: 250,    // ← EDIT HERE
    includedMinutes: 4,
    suitable: 'Indie films, intimate ballads, acoustic arrangements.',
  },
  {
    id: 'tier3',
    name: 'Television Standard',
    players: 20,
    section: '(7-5-3-3-2)',
    basePrice: 1349,       // ← EDIT HERE
    overagePerMin: 300,    // ← EDIT HERE
    includedMinutes: 4,
    suitable: 'TV series, commercials, standard game scores.',
    recommended: true,
  },
  {
    id: 'tier4',
    name: 'Cinematic Epic',
    players: 24,
    section: '(8-6-4-4-2)',
    basePrice: 1599,       // ← EDIT HERE
    overagePerMin: 350,    // ← EDIT HERE
    includedMinutes: 4,
    suitable: 'Blockbuster trailers, epic cinematic gaming.',
  },
];

// ============================================================================
// VOICE SERVICE PRICING
// ============================================================================

export const VOICE_TIERS = [
  {
    id: 'tier-1',
    name: 'AI Instant Voice',
    price: 49,
    badge: null,
    description: 'Fast, scalable, and 100% royalty-free for standard commercial use.',
    features: [
      'Pure AI generation',
      'Standard Commercial Rights included',
      '2 rounds of AI retakes & regenerations',
      'Minor script updates allowed',
      '24-hour fast delivery',
      'WAV + MP3 high-quality delivery',
      'Self-serve client portal access',
    ],
    priceLabel: 'US$49 / block (approx. 1 min)',
    gradient: 'from-slate-600 to-slate-700',
    popular: false,
    isCustom: false,
  },
  {
    id: 'tier-2',
    name: "Director's Cut",
    price: 149,
    badge: 'MOST POPULAR',
    description: 'AI generation polished by a human director. Perfect emotional delivery, guaranteed.',
    features: [
      'AI + Human Director emotional tuning',
      'Standard Commercial Rights included',
      '2 rounds of Director revisions',
      'Original actor micro-patching included (if needed)',
      '100% perfect pronunciation guarantee',
      'Priority delivery queue',
      'WAV + MP3 high-quality delivery',
    ],
    priceLabel: 'US$149 / block (approx. 1 min)',
    gradient: 'from-blue-600 to-cyan-600',
    popular: true,
    isCustom: false,
  },
  {
    id: 'tier-3',
    name: '100% Live Studio',
    price: 299,
    badge: 'PREMIUM',
    description: 'Recorded live by the human voice actor for premium, custom-directed projects.',
    features: [
      '100% Human actor studio recording',
      'Broadcast & Full Media Buyout options available',
      '1 round of performance pickups (script changes billed separately)',
      'Live directed session available',
      'Dedicated production manager',
      'Custom delivery formats & stems',
      'Multi-language project coordination',
    ],
    priceLabel: 'Starting at US$299',
    gradient: 'from-amber-600 to-orange-600',
    popular: false,
    isCustom: true,
  },
];

// In-House Elite Vocalist flat rate
export const VOCALIST_FLAT_PRICE = 499;

// Usage rights add-ons for voice (legacy — retained for backward compatibility)
export const VOICE_USAGE_RIGHTS = [
  {
    id: 'social-media',
    name: 'Social Media Rights',
    price: 0,
    description: 'Use on your social media channels',
  },
  {
    id: 'broadcast-tv',
    name: 'Broadcast TV Rights',
    price: 500,
    description: 'Television broadcasting rights',
  },
  {
    id: 'global-advertising',
    name: 'Global Advertising',
    price: 1000,
    description: 'Worldwide advertising campaigns',
  },
];

// ============================================================================
// VOICE RIGHTS PRICING (Cumulative 3-Tier System)
// ============================================================================

export type VoiceRightsLevel = 'standard' | 'broadcast' | 'global';

export const VOICE_RIGHTS_PRICING: Record<string, Record<VoiceRightsLevel, number>> = {
  'tier-1': {
    standard: 0,      // ← Included in base price
    broadcast: 99,     // ← EDIT HERE: Broadcast add-on for AI Instant
    global: 199,       // ← EDIT HERE: Global add-on for AI Instant
  },
  'tier-2': {
    standard: 0,
    broadcast: 150,    // ← EDIT HERE: Broadcast add-on for Director's Cut
    global: 350,       // ← EDIT HERE: Global add-on for Director's Cut
  },
  'tier-3': {
    standard: 0,
    broadcast: 0,      // ← Included in 100% Live Studio
    global: 0,         // ← Included in 100% Live Studio
  },
};

export const VOICE_RIGHTS_LABELS: Record<VoiceRightsLevel, { name: string; description: string }> = {
  standard: {
    name: 'Standard Commercial',
    description: 'YouTube, Social Media, Podcast, Website',
  },
  broadcast: {
    name: 'Broadcast TV & Full Media Buyout',
    description: 'Television, Radio, Cinema, plus all Standard channels',
  },
  global: {
    name: 'Global TV & Game Rights',
    description: 'All territories, all channels, gaming, OTT, streaming platforms',
  },
};

export function getVoiceRightsAddonPrice(tierId: string, level: VoiceRightsLevel): number {
  return VOICE_RIGHTS_PRICING[tierId]?.[level] ?? 0;
}

// ============================================================================
// LOCKED CALCULATION FUNCTIONS - DO NOT EDIT BELOW THIS LINE
// ============================================================================

/**
 * Calculate total price for Music service
 */
export function calculateMusicTotal(config: {
  baseTierId?: string;
  stringAddonId?: string;
  talentPrice?: number;
}): number {
  let total = 0;

  // Add base tier price
  if (config.baseTierId) {
    const tier = MUSIC_TIERS.find(t => t.id === config.baseTierId);
    if (tier) total += tier.price;
  }

  // Add string addon price
  if (config.stringAddonId) {
    const addon = MUSIC_STRING_ADDONS.find(a => a.id === config.stringAddonId);
    if (addon) total += addon.price;
  }

  // Add talent price
  if (config.talentPrice) {
    total += config.talentPrice;
  }

  return total;
}

/**
 * Get tier details by ID for Music service
 */
export function getMusicTier(tierId: string) {
  return MUSIC_TIERS.find(t => t.id === tierId);
}

/**
 * Get string addon details by ID for Music service
 */
export function getMusicStringAddon(addonId: string) {
  return MUSIC_STRING_ADDONS.find(a => a.id === addonId);
}

/**
 * Get tier details by ID for Voice service
 */
export function getVoiceTier(tierId: string) {
  return VOICE_TIERS.find(t => t.id === tierId);
}

/**
 * Get usage right details by ID for Voice service
 */
export function getVoiceUsageRight(rightId: string) {
  return VOICE_USAGE_RIGHTS.find(r => r.id === rightId);
}

// ============================================================================
// TIER LABEL HELPERS
// ============================================================================

export function getVoiceTierLabel(tierId: string): string {
  const tier = VOICE_TIERS.find(t => t.id === tierId);
  return tier?.name ?? tierId;
}

export function getMusicTierLabel(tierId: string): string {
  const tier = MUSIC_TIERS.find(t => t.id === tierId);
  return tier?.name ?? tierId;
}

export function getOrchestraTier(tierId: string) {
  return ORCHESTRA_TIERS.find(t => t.id === tierId);
}

export function getOrchestraTierLabel(tierId: string): string {
  const tier = ORCHESTRA_TIERS.find(t => t.id === tierId);
  return tier?.name ?? tierId;
}

// ============================================================================
// CONFIGURATION METADATA
// ============================================================================

export const PRICING_META = {
  lastUpdated: '2026-02-16',
  version: '1.0',
  currency: 'USD',
  taxIncluded: false,
  notes: 'All prices in US Dollars. Talent prices fetched from Supabase database.',
};
