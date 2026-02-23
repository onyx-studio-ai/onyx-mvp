import React from 'react';

type ZhPair = { tw: string; cn: string };

const headings: Record<string, ZhPair> = {
  // ── Terms of Service ──
  'terms.1':  { tw: '前言與條款接受', cn: '前言与条款接受' },
  'terms.2':  { tw: '服務性質：即時交易模式', cn: '服务性质：即时交易模式' },
  'terms.3':  { tw: '配音方案與授權', cn: '配音方案与授权' },
  'terms.4':  { tw: '音樂製作方案與授權', cn: '音乐制作方案与授权' },
  'terms.5':  { tw: '現場弦樂錄音服務', cn: '现场弦乐录音服务' },
  'terms.6':  { tw: '僱傭作品與權利轉讓', cn: '雇佣作品与权利转让' },
  'terms.7':  { tw: '著作人格權棄權', cn: '著作人格权弃权' },
  'terms.8':  { tw: '授權證書與驗證', cn: '授权证书与验证' },
  'terms.9':  { tw: '禁止行為與客戶義務', cn: '禁止行为与客户义务' },
  'terms.10': { tw: '付款與不退款政策', cn: '付款与不退款政策' },
  'terms.11': { tw: '準據法與爭議解決', cn: '准据法与争议解决' },
  'terms.12': { tw: '責任限制', cn: '责任限制' },
  'terms.13': { tw: '不可抗力', cn: '不可抗力' },
  'terms.14': { tw: '全球合規', cn: '全球合规' },
  'terms.15': { tw: '可分割性、完整協議與不得口頭修改', cn: '可分割性、完整协议与不得口头修改' },
  'terms.16': { tw: '保密條款', cn: '保密条款' },
  'terms.17': { tw: '公開權', cn: '公开权' },
  'terms.18': { tw: '服務標準與 AI 免責聲明', cn: '服务标准与 AI 免责声明' },
  'terms.19': { tw: '智慧財產權擔保', cn: '知识产权担保' },
  'terms.20': { tw: '條款存續', cn: '条款存续' },
  'terms.21': { tw: '當事人關係', cn: '当事人关系' },
  'terms.22': { tw: '修訂與通知', cn: '修订与通知' },
  'terms.23': { tw: '轉讓與繼承', cn: '转让与继承' },
  'terms.24': { tw: '電子簽章接受', cn: '电子签章接受' },
  'terms.25': { tw: '禁止招攬與禁止規避', cn: '禁止招揽与禁止规避' },
  'terms.26': { tw: '語言優先順序', cn: '语言优先顺序' },
  'terms.27': { tw: '資料主權與不用於訓練保證', cn: '数据主权与不用于训练保证' },
  'terms.28': { tw: '禁制令救濟', cn: '禁令救济' },
  'terms.29': { tw: '數位完整性', cn: '数字完整性' },
  'terms.30': { tw: '稅務與扣繳', cn: '税务与扣缴' },
  'terms.31': { tw: '營運持續與永久授權', cn: '营运持续与永久授权' },
  'terms.32': { tw: '不棄權', cn: '不弃权' },
  'terms.33': { tw: '條款優先順序', cn: '条款优先顺序' },
  'terms.34': { tw: '合規驗證', cn: '合规验证' },
  'terms.35': { tw: '意見回饋授權', cn: '意见反馈授权' },
  'terms.36': { tw: '反賄賂與反貪腐', cn: '反贿赂与反腐败' },
  'terms.37': { tw: '現代奴隸制度與人權', cn: '现代奴隶制度与人权' },
  'terms.38': { tw: '不詆毀', cn: '不诋毁' },
  'terms.39': { tw: '定義、解釋與條款建構', cn: '定义、解释与条款构建' },
  'terms.40': { tw: '正式通知', cn: '正式通知' },
  'terms.41': { tw: '轉讓不可撤銷與遺產保護', cn: '转让不可撤销与遗产保护' },
  'terms.42': { tw: '未授權使用追償', cn: '未授权使用追偿' },
  'terms.43': { tw: '資料安全與違規通知', cn: '数据安全与违规通知' },
  'terms.44': { tw: '索賠時效', cn: '索赔时效' },
  'terms.45': { tw: '授權自動撤銷', cn: '授权自动撤销' },
  'terms.46': { tw: '數位指紋與浮水印', cn: '数字指纹与水印' },
  'terms.47': { tw: '無第三方受益人', cn: '无第三方受益人' },
  'terms.48': { tw: '律師費用', cn: '律师费用' },
  'terms.49': { tw: '團體訴訟棄權', cn: '集体诉讼弃权' },
  'terms.50': { tw: '便利性終止', cn: '便利性终止' },
  'terms.51': { tw: '美學輸出非獨占性', cn: '美学输出非独占性' },
  'terms.52': { tw: '客戶端安全擔保', cn: '客户端安全担保' },
  'terms.53': { tw: '心理與情感免責聲明', cn: '心理与情感免责声明' },
  'terms.54': { tw: '專屬 AI 授權（人才義務）', cn: '专属 AI 授权（人才义务）' },
  'terms.55': { tw: 'AI 模型權重與智慧財產權歸屬', cn: 'AI 模型权重与知识产权归属' },
  'terms.56': { tw: '人才離開不溯及既往', cn: '人才离开不溯及既往' },
  'terms.57': { tw: '微修補協議', cn: '微修补协议' },
  'terms.58': { tw: '離開後封存權利', cn: '离开后封存权利' },

  // ── Privacy Policy ──
  'privacy.1':  { tw: '簡介', cn: '简介' },
  'privacy.2':  { tw: '資料收集與最小化', cn: '数据收集与最小化' },
  'privacy.3':  { tw: '付款資訊（安全且代幣化）', cn: '付款信息（安全且代币化）' },
  'privacy.4':  { tw: '我們如何使用您的資訊', cn: '我们如何使用您的信息' },
  'privacy.5':  { tw: '語音與生物辨識資料', cn: '语音与生物识别数据' },
  'privacy.6':  { tw: '資料共享與基礎設施', cn: '数据共享与基础设施' },
  'privacy.7':  { tw: '國際資料傳輸', cn: '国际数据传输' },
  'privacy.8':  { tw: '處理保密性', cn: '处理保密性' },
  'privacy.9':  { tw: '資料安全', cn: '数据安全' },
  'privacy.10': { tw: '反爬蟲與技術完整性', cn: '反爬虫与技术完整性' },
  'privacy.11': { tw: '資料保留與刪除', cn: '数据保留与删除' },
  'privacy.12': { tw: 'Cookie 與追蹤', cn: 'Cookie 与追踪' },
  'privacy.13': { tw: '兒童隱私', cn: '儿童隐私' },
  'privacy.14': { tw: '禁止使用與 AI 倫理', cn: '禁止使用与 AI 伦理' },
  'privacy.15': { tw: 'AI 透明度與揭露', cn: 'AI 透明度与披露' },
  'privacy.16': { tw: '無自動化分析', cn: '无自动化分析' },
  'privacy.17': { tw: '法律機關請求', cn: '法律机关请求' },
  'privacy.18': { tw: '資料韌性', cn: '数据韧性' },
  'privacy.19': { tw: '您的權利', cn: '您的权利' },
  'privacy.20': { tw: '本政策變更', cn: '本政策变更' },
  'privacy.21': { tw: '聯絡資訊', cn: '联系信息' },

  // ── Acceptable Use Policy ──
  'aup.1':  { tw: '目的與範圍', cn: '目的与范围' },
  'aup.2':  { tw: '禁止內容', cn: '禁止内容' },
  'aup.3':  { tw: '冒充與聲音肖像', cn: '冒充与声音肖像' },
  'aup.4':  { tw: '音訊詐欺、社交工程與反垃圾訊息', cn: '音频欺诈、社交工程与反垃圾信息' },
  'aup.5':  { tw: '敏感專業建議', cn: '敏感专业建议' },
  'aup.6':  { tw: '資產使用限制', cn: '资产使用限制' },
  'aup.7':  { tw: '數位溯源與浮水印保護', cn: '数字溯源与水印保护' },
  'aup.8':  { tw: '人才保護、禁止繞過與現場錄音隱私', cn: '人才保护、禁止绕过与现场录音隐私' },
  'aup.9':  { tw: '系統濫用與技術限制', cn: '系统滥用与技术限制' },
  'aup.10': { tw: '高風險與生命安全禁令', cn: '高风险与生命安全禁令' },
  'aup.11': { tw: '禁止虛假代言與品牌關聯', cn: '禁止虚假代言与品牌关联' },
  'aup.12': { tw: '出口管制與制裁合規', cn: '出口管制与制裁合规' },
  'aup.13': { tw: 'AI 透明度與揭露義務', cn: 'AI 透明度与披露义务' },
  'aup.14': { tw: '禁止提交敏感個人資料', cn: '禁止提交敏感个人数据' },
  'aup.15': { tw: '人才姓名與肖像限制', cn: '人才姓名与肖像限制' },
  'aup.16': { tw: '聲譽保障與創意否決權', cn: '声誉保障与创意否决权' },
  'aup.17': { tw: '平台中立與內容免責聲明', cn: '平台中立与内容免责声明' },
  'aup.18': { tw: '稽核限制與商業秘密保護', cn: '审计限制与商业秘密保护' },
  'aup.19': { tw: '著作人格權與人才尊嚴', cn: '著作人格权与人才尊严' },
  'aup.20': { tw: '服務演進與資料處置', cn: '服务演进与数据处置' },
  'aup.21': { tw: '緊急執法合作', cn: '紧急执法合作' },
  'aup.22': { tw: '新興技術', cn: '新兴技术' },
  'aup.23': { tw: '執行與管轄', cn: '执行与管辖' },
  'aup.24': { tw: '執行措施', cn: '执行措施' },
};

const pageTitles: Record<string, ZhPair> = {
  terms:   { tw: '服務條款', cn: '服务条款' },
  privacy: { tw: '隱私政策', cn: '隐私政策' },
  aup:     { tw: '合理使用政策', cn: '合理使用政策' },
};

function isChinese(locale: string) {
  return locale === 'zh-TW' || locale === 'zh-CN';
}

function zh(pair: ZhPair, locale: string) {
  return locale === 'zh-TW' ? pair.tw : pair.cn;
}

export function DisclaimerBanner({ locale }: { locale: string }) {
  if (!isChinese(locale)) return null;
  const text = locale === 'zh-TW'
    ? '本文件為英文版之翻譯，僅供參考。如中英文版本有任何不一致之處，以英文版本為準。'
    : '本文件为英文版之翻译，仅供参考。如中英文版本有任何不一致之处，以英文版本为准。';
  return (
    <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg px-5 py-4 mb-8 text-amber-200/90 text-[13px] leading-relaxed">
      {text}
    </div>
  );
}

export function PageTitle({ page, locale, children }: {
  page: string;
  locale: string;
  children: React.ReactNode;
}) {
  const pair = pageTitles[page];
  if (!pair || !isChinese(locale)) {
    return <h1 className="text-3xl font-bold mb-2">{children}</h1>;
  }
  return (
    <h1 className="text-3xl font-bold mb-2">
      <span>{zh(pair, locale)}</span>
      <span className="block text-lg font-medium text-gray-500 mt-1">{children}</span>
    </h1>
  );
}

export function SH({ id, locale, children }: {
  id: string;
  locale: string;
  children: React.ReactNode;
}) {
  const pair = headings[id];
  if (!pair || !isChinese(locale)) {
    return <h2 className="text-base font-semibold text-white mb-3">{children}</h2>;
  }
  return (
    <h2 className="text-base font-semibold text-white mb-3">
      <span>{zh(pair, locale)}</span>
      <span className="block text-sm font-normal text-gray-500 mt-0.5">{children}</span>
    </h2>
  );
}

export function LastUpdated({ locale, date }: { locale: string; date: string }) {
  if (!isChinese(locale)) {
    return <p className="text-gray-600 text-xs">Last Updated: {date}</p>;
  }
  const label = locale === 'zh-TW' ? '最後更新' : '最后更新';
  return <p className="text-gray-600 text-xs">{label}：{date}</p>;
}
