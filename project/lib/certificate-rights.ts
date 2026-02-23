/**
 * Certificate Rights Mapping Engine
 *
 * Maps product tiers and rights levels to the specific rights
 * that appear on the License Certificate.
 */

export type RightsLevel = 'standard' | 'broadcast' | 'global';

export interface CertificateRights {
  validityPeriod: string;
  geographicTerritory: string;
  mediaChannels: string[];
  sublicensingRights: { granted: boolean; note: string };
  distributionRights: { granted: boolean; note: string };
  transferability: { transferable: boolean; note: string };
  ownershipStatus: string;
  voiceAffidavit: { included: boolean; note: string };
  indemnification: string;
}

interface RightsInput {
  orderType: 'voice' | 'music' | 'orchestra';
  tier: string;
  rightsLevel: RightsLevel;
  voiceIdRef?: string;
}

const STANDARD_MEDIA = [
  'Digital: YouTube, TikTok, Instagram, Facebook, and all Social Media',
  'Website & Internal Presentations',
  'Podcast & Online Radio',
];

const BROADCAST_MEDIA = [
  ...STANDARD_MEDIA,
  'Broadcast: Television (Terrestrial/Cable), Radio, and Cinema',
  'Gaming: Video games, OTT platforms, and interactive media',
];

const GLOBAL_MEDIA = [
  ...BROADCAST_MEDIA,
  'Global Advertising: All territories, all channels',
  'Distribution on streaming platforms (Spotify, Apple Music, etc.)',
];

export function mapRightsForCertificate(input: RightsInput): CertificateRights {
  const { orderType, tier, voiceIdRef } = input;
  const effectiveRights: RightsLevel =
    orderType === 'orchestra' ? 'global' :
    (orderType === 'voice' && tier === 'tier-3') ? 'global' :
    input.rightsLevel;

  const mediaChannels =
    effectiveRights === 'global' ? GLOBAL_MEDIA :
    effectiveRights === 'broadcast' ? BROADCAST_MEDIA :
    STANDARD_MEDIA;

  const isFullBuyout =
    (orderType === 'voice' && tier === 'tier-3' && effectiveRights === 'global') ||
    (orderType === 'music' && tier === 'masterpiece') ||
    (orderType === 'orchestra');

  const ownershipStatus =
    orderType === 'orchestra'
      ? 'Work Made for Hire: This recording was commissioned by the Licensee. Upon full payment, the Master Recording is owned outright by the Licensee. The underlying composition rights remain with their respective owner(s).'
      : isFullBuyout
        ? 'Full Media Buyout: Full ownership of the Master and Composition is transferred to the Licensee.'
        : 'Master Usage: Perpetual commercial usage of the recording is granted.';

  const sublicensingGranted = effectiveRights !== 'standard';
  const distributionGranted = isFullBuyout || effectiveRights === 'global';

  return {
    validityPeriod: 'Perpetual (Forever). There is no expiration date for the usage of this asset.',
    geographicTerritory: 'Worldwide. Use is permitted in all countries and regions.',
    mediaChannels,
    sublicensingRights: {
      granted: sublicensingGranted,
      note: sublicensingGranted
        ? 'Granted. Licensee has the right to sub-license this asset to third-party clients (e.g., end-clients of advertising agencies) as part of a larger project.'
        : 'Not included in this license tier. Upgrade to Broadcast or Global for sublicensing rights.',
    },
    distributionRights: {
      granted: distributionGranted,
      note: distributionGranted
        ? 'Granted. Permitted for distribution on streaming platforms (Spotify, Apple Music, etc.).'
        : 'Not included in this license tier.',
    },
    transferability: {
      transferable: isFullBuyout,
      note: isFullBuyout
        ? 'Freely transferable. The Client may assign ownership rights to third parties. All restrictions under Prohibited Conduct, including the AI Training Ban, remain perpetually binding on any assignee.'
        : 'Non-transferable. This License may not be assigned or transferred to any third party without prior written consent from Onyx Studios.',
    },
    ownershipStatus,
    voiceAffidavit: {
      included: !!voiceIdRef,
      note: voiceIdRef
        ? `This asset is linked to a verified Voice Affidavit (Ref: #${voiceIdRef}). The performer has provided a vocal recording confirming their identity and the absolute transfer of rights to Onyx Studios.`
        : 'Voice affidavit not applicable for this asset type.',
    },
    indemnification: orderType === 'orchestra'
      ? 'All session musicians performed on a Work Made for Hire basis. Performers have waived their moral rights and any right to claim additional compensation directly from the Licensee. This recording is 100% royalty-free to the Licensee — no ongoing royalties, residuals, or additional fees will ever be required.'
      : 'Onyx Studios warrants that all performers (Onyx Global Talent Network) have waived their moral rights and any right to claim additional compensation directly from the Licensee. This asset is 100% royalty-free to the Licensee — no ongoing royalties, residuals, or additional fees will ever be required.',
  };
}

export function getAssetType(orderType: 'voice' | 'music' | 'orchestra'): string {
  switch (orderType) {
    case 'voice': return 'Vocal';
    case 'music': return 'Music';
    case 'orchestra': return 'Live Strings';
    default: return 'Audio';
  }
}

export function getProductCategory(orderType: 'voice' | 'music' | 'orchestra', tier: string): string {
  if (orderType === 'voice') {
    const map: Record<string, string> = {
      'tier-1': 'AI Instant Voice',
      'tier-2': "Director's Cut",
      'tier-3': '100% Live Studio',
    };
    return map[tier] || tier;
  }
  if (orderType === 'music') {
    const map: Record<string, string> = {
      'ai-curator': 'AI Curator',
      'pro-arrangement': 'Pro Arrangement',
      'masterpiece': 'Masterpiece',
    };
    return map[tier] || tier;
  }
  return 'Live Strings Recording';
}

export function getRightsLevelLabel(level: RightsLevel): string {
  const map: Record<RightsLevel, string> = {
    standard: 'Standard Commercial',
    broadcast: 'Broadcast TV & Full Media Buyout',
    global: 'Global TV & Game Rights',
  };
  return map[level];
}
