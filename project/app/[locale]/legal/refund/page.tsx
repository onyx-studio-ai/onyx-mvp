import { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import '../legal-content.css';

export const metadata: Metadata = {
  title: 'Refund Policy | Onyx Studios',
  description:
    'Refund Policy for Onyx Studios digital services, including AI voice, music production, and live studio services.',
};

type RefundCopy = {
  title: string;
  lastUpdatedLabel: string;
  lastUpdated: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
  footer: string;
};

const EN: RefundCopy = {
  title: 'Refund Policy',
  lastUpdatedLabel: 'Last Updated',
  lastUpdated: 'February 25, 2026',
  intro:
    'This Refund Policy applies to all purchases made through Onyx Studios ("Onyx", "we", "us"), operated by Fine Entertainment | 凡音文化有限公司.',
  sections: [
    {
      title: '1. General Policy',
      body: 'Because our services involve digital content, customized production, and immediate fulfillment, all sales are generally final and non-refundable unless explicitly stated in this policy.',
    },
    {
      title: '2. Non-Refundable Items',
      body: 'The following are non-refundable once work has started, content has been delivered, or download/access has been provided: AI-generated voice or music outputs, director-polished or custom-produced deliverables, live recording sessions after session start, and rights upgrades or expedited delivery fees once fulfilled.',
    },
    {
      title: '3. Eligible Refund Cases (Limited Exceptions)',
      body: 'A full or partial refund may be considered only in the following cases: duplicate charge for the same order, verified technical delivery failure after reasonable remediation attempts, confirmed unauthorized transaction subject to provider review, or cancellation before production starts (less any non-recoverable processing/admin costs).',
    },
    {
      title: '4. Revisions vs Refunds',
      body: 'Creative dissatisfaction (for example style, tone, or artistic preference) is handled through the included revision rounds in your purchased plan and does not qualify for a refund by itself.',
    },
    {
      title: '5. Request Window',
      body: 'Refund requests must be submitted within 48 hours of delivery, or within 7 days of payment for non-delivered orders, whichever is earlier.',
    },
    {
      title: '6. How to Request a Refund',
      body: 'Contact billing@onyxstudios.ai with your order number, payment receipt, reason for request, and supporting evidence. We typically respond within 3 business days.',
    },
    {
      title: '7. Chargebacks',
      body: 'Please contact us before opening a chargeback so we can resolve issues quickly. Abusive or bad-faith chargebacks may result in account suspension.',
    },
    {
      title: '8. Legal Rights',
      body: 'Nothing in this policy limits any mandatory consumer rights that cannot be waived under applicable law.',
    },
    {
      title: '9. Policy Updates',
      body: 'We may update this policy from time to time. The latest version will always be posted on this page with the updated effective date.',
    },
  ],
  footer: 'Refund Policy — Fine Entertainment | 凡音文化有限公司',
};

const ZH_TW: RefundCopy = {
  title: '退款政策',
  lastUpdatedLabel: '最後更新',
  lastUpdated: '2026年2月25日',
  intro:
    '本退款政策適用於透過 Onyx Studios（以下稱「Onyx」、「本公司」、「我們」）所完成之所有購買。Onyx Studios 由 Fine Entertainment | 凡音文化有限公司營運。',
  sections: [
    {
      title: '1. 一般原則',
      body: '因本服務涉及數位內容、客製化製作與即時履約，除本政策明確另有約定外，所有交易原則上為最終交易且不提供退款。',
    },
    {
      title: '2. 不可退款項目',
      body: '一旦開始製作、已交付內容，或已提供下載/存取後，以下項目不予退款：AI 生成配音或音樂成品、導演精修或客製交付內容、已開始之現場錄音服務、以及已履行之權利升級與加急費用。',
    },
    {
      title: '3. 可受理退款之例外情形（有限）',
      body: '僅於下列情形，才可能評估全額或部分退款：同一訂單重複扣款、經確認且在合理修復後仍無法交付之技術故障、經查證之未授權交易（依支付機構審查結果）、或於製作開始前取消客製/現場專案（扣除不可回收之處理成本後）。',
    },
    {
      title: '4. 修改次數與退款之區分',
      body: '對風格、語氣、藝術偏好等主觀不滿，應依購買方案所含修改次數處理，不單獨構成退款理由。',
    },
    {
      title: '5. 申請時限',
      body: '退款申請需於交付後 48 小時內提出；若訂單尚未交付，則需於付款後 7 日內提出。以較早到期者為準。',
    },
    {
      title: '6. 退款申請方式',
      body: '請寄信至 billing@onyxstudios.ai，並提供訂單編號、付款憑證、申請原因與相關佐證。一般於 3 個工作天內回覆。',
    },
    {
      title: '7. 爭議款（Chargeback）',
      body: '提出信用卡爭議款前，請先聯繫我們處理。若屬惡意或濫用之爭議款行為，本公司得暫停或終止帳號。',
    },
    {
      title: '8. 法定權利保留',
      body: '本政策不影響適用法律下不得被排除或放棄之強制性消費者權利。',
    },
    {
      title: '9. 政策更新',
      body: '本公司得不定期更新本政策，最新版本將公告於本頁並標示更新日期。',
    },
  ],
  footer: '退款政策 — Fine Entertainment | 凡音文化有限公司',
};

const ZH_CN: RefundCopy = {
  title: '退款政策',
  lastUpdatedLabel: '最后更新',
  lastUpdated: '2026年2月25日',
  intro:
    '本退款政策适用于通过 Onyx Studios（以下简称“Onyx”、“本公司”、“我们”）完成的所有购买。Onyx Studios 由 Fine Entertainment | 凡音文化有限公司运营。',
  sections: [
    {
      title: '1. 一般原则',
      body: '因本服务涉及数字内容、定制化制作与即时履约，除本政策明确另有约定外，所有交易原则上为最终交易且不提供退款。',
    },
    {
      title: '2. 不可退款项目',
      body: '一旦开始制作、已交付内容，或已提供下载/访问后，以下项目不予退款：AI 生成配音或音乐成品、导演精修或定制交付内容、已开始的现场录音服务、以及已履行的权利升级与加急费用。',
    },
    {
      title: '3. 可受理退款的例外情形（有限）',
      body: '仅在下列情形，才可能评估全额或部分退款：同一订单重复扣款、经确认且在合理修复后仍无法交付的技术故障、经核实的未授权交易（依支付机构审核结果）、或在制作开始前取消定制/现场项目（扣除不可回收处理成本后）。',
    },
    {
      title: '4. 修改次数与退款的区分',
      body: '对风格、语气、艺术偏好等主观不满，应按购买方案所含修改次数处理，不单独构成退款理由。',
    },
    {
      title: '5. 申请时限',
      body: '退款申请需在交付后 48 小时内提出；若订单尚未交付，则需在付款后 7 日内提出。以较早到期者为准。',
    },
    {
      title: '6. 退款申请方式',
      body: '请发送邮件至 billing@onyxstudios.ai，并提供订单编号、付款凭证、申请原因及相关佐证。通常在 3 个工作日内回复。',
    },
    {
      title: '7. 争议款（Chargeback）',
      body: '发起信用卡争议款前，请先联系我们处理。若属于恶意或滥用争议款行为，本公司有权暂停或终止账号。',
    },
    {
      title: '8. 法定权利保留',
      body: '本政策不影响适用法律下不得排除或放弃的强制性消费者权利。',
    },
    {
      title: '9. 政策更新',
      body: '本公司可不定期更新本政策，最新版本将公布于本页并标注更新日期。',
    },
  ],
  footer: '退款政策 — Fine Entertainment | 凡音文化有限公司',
};

function getCopy(locale: string): RefundCopy {
  if (locale === 'zh-TW') return ZH_TW;
  if (locale === 'zh-CN') return ZH_CN;
  return EN;
}

export default async function RefundPage() {
  const locale = await getLocale();
  const copy = getCopy(locale);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-3xl mx-auto pt-32 pb-16 px-6">
        <div className="mb-10 pb-6 border-b border-white/10">
          <p className="text-[11px] text-gray-500 tracking-widest uppercase mb-3">
            Onyx Studios
          </p>
          <h1 className="text-3xl font-bold mb-2">{copy.title}</h1>
          <p className="text-gray-600 text-xs">
            {copy.lastUpdatedLabel}: {copy.lastUpdated}
          </p>
        </div>

        <article className="space-y-8 text-[13px] leading-relaxed text-gray-400">
          <section>
            <p>{copy.intro}</p>
          </section>

          {copy.sections.map(section => (
            <section key={section.title}>
              <h2 className="text-base font-semibold text-white mb-3">{section.title}</h2>
              <div className="legal-content">
                <p>{section.body}</p>
              </div>
            </section>
          ))}

          <div className="text-center pt-6 pb-4 border-t border-white/5">
            <p className="text-gray-600 text-[11px]">{copy.footer}</p>
          </div>
        </article>
      </div>
    </main>
  );
}
