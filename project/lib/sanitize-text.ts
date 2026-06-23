/*
  Strip links + personal contact info from talent free-text (bio, credits).
  Talents tend to paste Google Drive links, emails or phone numbers into their
  public bio — those don't belong there (links go in the dedicated link field;
  contact info stays private and is never shown to clients). Applied server-side
  on self-service save and at publish, so the public profile is always clean.
*/

const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;
// bare domains with a common TLD (catches "drive.google.com/…" without http)
const DOMAIN_RE = /\b[a-z0-9-]+\.(?:com|net|org|io|ai|co|me|tw|cn|hk|jp|kr|sg|app|link|page|site|xyz|info|biz|tv|fm|gl|ly)(?:\/\S*)?/gi;
// + international, or any run of 9+ digits (phone / ID). No \b — a phone glued to a
// word char (e.g. "Name_0975554977") has no word boundary; match the digit run itself.
// 9+ digits avoids stripping years / short codes.
const PHONE_RE = /(?:\+\d[\d\s().-]{7,}\d)|\d{9,}/g;

export function stripContactsAndLinks(s: string): string {
  if (!s) return s;
  return s
    .replace(URL_RE, '')
    .replace(EMAIL_RE, '')
    .replace(DOMAIN_RE, '')
    .replace(PHONE_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
