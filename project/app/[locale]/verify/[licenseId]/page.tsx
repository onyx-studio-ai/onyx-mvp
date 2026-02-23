'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Shield, CheckCircle, XCircle, Download, Loader2, Globe, Tv, Youtube, Music, Ban, FileText, AlertTriangle } from 'lucide-react';

interface CertificateData {
  license_id: string;
  order_type: string;
  order_number: string;
  product_category: string;
  asset_type: string;
  rights_level: string;
  rights_details: {
    validityPeriod: string;
    geographicTerritory: string;
    mediaChannels: string[];
    sublicensingRights: { granted: boolean; note: string };
    distributionRights: { granted: boolean; note: string };
    transferability?: { transferable: boolean; note: string };
    ownershipStatus: string;
    voiceAffidavit: { included: boolean; note: string };
    indemnification: string;
  };
  voice_id_ref: string;
  talent_name: string;
  audio_specs: string;
  pdf_url: string;
  issued_at: string;
}

type PageState = 'loading' | 'found' | 'not_found';

export default function VerifyPage() {
  const t = useTranslations('verify');
  const locale = useLocale();
  const params = useParams();
  const licenseId = params.licenseId as string;
  const [state, setState] = useState<PageState>('loading');
  const [cert, setCert] = useState<CertificateData | null>(null);

  useEffect(() => {
    if (!licenseId) return;
    fetch(`/api/verify?id=${encodeURIComponent(licenseId)}`)
      .then(async r => {
        const data = await r.json();
        if (r.ok && data.certificate) {
          setCert(data.certificate);
          setState('found');
        } else {
          setState('not_found');
        }
      })
      .catch(() => setState('not_found'));
  }, [licenseId]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
          <p className="text-gray-400 text-sm">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (state === 'not_found') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t('notFoundTitle')}</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            {t.rich('notFoundDesc', { id: licenseId, code: (c) => <span className="text-white font-mono">{c}</span> })}
          </p>
          <a href="mailto:support@onyxstudios.ai" className="inline-block text-green-400 text-sm hover:underline">
            {t('contactSupport')}
          </a>
        </div>
      </div>
    );
  }

  if (!cert) return null;

  const dateLocaleMap: Record<string, string> = { en: 'en-US', 'zh-TW': 'zh-TW', 'zh-CN': 'zh-CN' };
  const issuedDate = new Date(cert.issued_at).toLocaleDateString(dateLocaleMap[locale] || 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const rightsLevelLabels: Record<string, string> = {
    standard: t('rightsStandard'),
    broadcast: t('rightsBroadcast'),
    global: t('rightsGlobal'),
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Verified Badge */}
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-green-500/10 border-2 border-green-500/30 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 text-green-400 text-sm font-medium mb-3">
              <Shield className="w-4 h-4" />
              {t('verifiedBadge')}
            </div>
            <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
            <p className="text-gray-400 text-sm mt-1">{t('verifiedByOnyx')}</p>
          </div>
        </div>

        {/* License Info Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">{t('licenseId')}</p>
              <p className="text-green-400 text-lg font-mono font-bold">#{cert.license_id}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-xs uppercase tracking-wider">{t('issued')}</p>
              <p className="text-white text-sm font-medium">{issuedDate}</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label={t('productCategory')} value={cert.product_category} />
              <InfoRow label={t('assetType')} value={cert.asset_type} />
              <InfoRow label={t('rightsLevel')} value={rightsLevelLabels[cert.rights_level] || cert.rights_level} />
              {cert.audio_specs && <InfoRow label={t('audioSpecs')} value={cert.audio_specs} />}
              {cert.talent_name && <InfoRow label={t('performer')} value={cert.talent_name} />}
              {cert.voice_id_ref && <InfoRow label={t('voiceAffidavit')} value={`#${cert.voice_id_ref}`} />}
            </div>
          </div>
        </div>

        {/* Scope of Licensing */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Globe className="w-4 h-4 text-green-400" />
            {t('scopeOfLicensing')}
          </h2>

          <div className="space-y-3">
            <ScopeItem label={t('validity')} value={cert.rights_details.validityPeriod} />
            <ScopeItem label={t('territory')} value={cert.rights_details.geographicTerritory} />
          </div>

          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{t('mediaChannels')}</p>
            <div className="space-y-1.5">
              {cert.rights_details.mediaChannels.map((ch, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  {ch}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <RightsBadge
              label={t('sublicensing')}
              granted={cert.rights_details.sublicensingRights.granted}
              grantedLabel={t('granted')}
              notGrantedLabel={t('notIncluded')}
            />
            <RightsBadge
              label={t('distribution')}
              granted={cert.rights_details.distributionRights.granted}
              grantedLabel={t('granted')}
              notGrantedLabel={t('notIncluded')}
            />
            <RightsBadge
              label={t('transferability')}
              granted={cert.rights_details.transferability?.transferable ?? false}
              grantedLabel={cert.rights_details.transferability?.transferable ? t('transferable') : undefined}
              notGrantedLabel={!cert.rights_details.transferability?.transferable ? t('nonTransferable') : undefined}
            />
          </div>
        </div>

        {/* Ownership */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            {t('ownershipLegal')}
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed">{cert.rights_details.ownershipStatus}</p>
          <p className="text-gray-400 text-sm leading-relaxed">{cert.rights_details.indemnification}</p>
          {cert.rights_details.voiceAffidavit.included && (
            <p className="text-gray-400 text-sm leading-relaxed">{cert.rights_details.voiceAffidavit.note}</p>
          )}
        </div>

        {/* Prohibited Use: AI Training */}
        <div className="bg-red-950/20 border border-red-500/15 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-400" />
            {t('prohibitedUseTitle')}
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            {t('prohibitedUseDesc')}
          </p>
          <div className="flex items-start gap-2 bg-red-950/30 border border-red-500/10 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-gray-400 text-xs leading-relaxed">
              {t('enforcementNotice')}
            </p>
          </div>
        </div>

        {/* License Conditions */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-green-400" />
            {t('licenseConditions')}
          </h2>

          {cert.rights_details.transferability && (
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{t('transferability')}</p>
              <p className="text-gray-300 text-sm leading-relaxed">{cert.rights_details.transferability.note}</p>
            </div>
          )}

          <div className="space-y-3 text-gray-400 text-sm leading-relaxed">
            <p>
              <span className="text-gray-300 font-medium">{t('noResaleLabel')}</span> {t('noResaleDesc')}
            </p>
            <p>
              <span className="text-gray-300 font-medium">{t('watermarkLabel')}</span> {t('watermarkDesc')}
            </p>
            <p>
              <span className="text-gray-300 font-medium">{t('scopeExceedanceLabel')}</span> {t('scopeExceedanceDesc')}
            </p>
            <p>
              <span className="text-gray-300 font-medium">{t('businessContinuityLabel')}</span> {t('businessContinuityDesc')}
            </p>
          </div>
        </div>

        {/* Download */}
        {cert.pdf_url && (
          <div className="text-center">
            <a
              href={cert.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              {t('downloadPdf')}
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-600 text-xs space-y-1 pt-4 border-t border-zinc-800">
          <p>{t('footerBrand')}</p>
          <p>{t('footerSupport')}</p>
          <p className="pt-2 italic">
            {t.rich('footerLegal', {
              terms: (c) => <a href="/legal/terms" className="text-gray-500 underline underline-offset-2 hover:text-gray-400 transition-colors">{c}</a>,
              aup: (c) => <a href="/legal/aup" className="text-gray-500 underline underline-offset-2 hover:text-gray-400 transition-colors">{c}</a>,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-white text-sm font-medium">{value}</p>
    </div>
  );
}

function ScopeItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-gray-300 text-sm">{value}</p>
    </div>
  );
}

function RightsBadge({ label, granted, grantedLabel, notGrantedLabel }: { label: string; granted: boolean; grantedLabel?: string; notGrantedLabel?: string }) {
  return (
    <div className={`p-3 rounded-xl border ${
      granted
        ? 'bg-green-500/5 border-green-500/20'
        : 'bg-zinc-800/50 border-zinc-700'
    }`}>
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        {granted ? (
          <>
            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            <span className="text-green-400 text-sm font-medium">{grantedLabel}</span>
          </>
        ) : (
          <>
            <XCircle className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-gray-500 text-sm">{notGrantedLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}
