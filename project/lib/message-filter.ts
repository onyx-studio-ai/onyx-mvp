// Strip off-platform contact details from marketplace messages so a talent and a
// client can't route around Onyx. We keep the message but redact contact tokens —
// links, emails, phone numbers. Legitimate file sharing goes through the in-thread
// upload button (an attachment on our own storage), not pasted links.

const EMAIL_RE = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
// bare domains like docs.google.com or foo.io/bar — only redacted when the TLD is real
const BARE_DOMAIN_RE = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?/gi;
const TLD_RE = /\.(?:com|net|org|io|ai|co|me|app|xyz|cn|tw|hk|jp|kr|info|biz|tv|link|gg|to|us|uk|de|fr|live|site|online|shop|store|cc|vip|club|wang|top)(?:[/:]|$)/i;
// 8+ digit runs (with common separators / +) → phone-number-ish
const PHONE_RE = /\+?\d[\d\s().\-]{6,}\d/g;
// common IM handles people paste to move off-platform
const IM_RE = /\b(?:wechat|weixin|微信|line\s*id|line|whatsapp|telegram|tg|qq|skype|ig|instagram|fb|facebook|discord)\b\s*[:：#＠@]?\s*[\w.\-]{2,}/gi;

export function sanitizeMessage(input: string): { clean: string; redacted: boolean } {
  let redacted = false;
  const mark = (label: string) => { redacted = true; return label; };
  let s = String(input || '');
  s = s.replace(EMAIL_RE, () => mark('[聯絡方式已移除]'));
  s = s.replace(URL_RE, () => mark('[連結已移除]'));
  s = s.replace(IM_RE, () => mark('[聯絡方式已移除]'));
  s = s.replace(PHONE_RE, (m) => (m.replace(/\D/g, '').length >= 8 ? mark('[號碼已移除]') : m));
  s = s.replace(BARE_DOMAIN_RE, (m) => (TLD_RE.test(m) ? mark('[連結已移除]') : m));
  return { clean: s, redacted };
}
