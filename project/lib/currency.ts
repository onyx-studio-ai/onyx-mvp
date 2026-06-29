export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  TWD: 30.1,
  CNY: 7.2,
};

const LOCALE_CURRENCY_MAP: Record<string, string> = {
  en: "USD",
  "zh-TW": "TWD",
  "zh-CN": "CNY",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  TWD: "NT$",
  CNY: "¥",
};

export function getCurrencyCode(locale: string): string {
  return LOCALE_CURRENCY_MAP[locale] ?? "USD";
}

export function getCurrencySymbol(locale: string): string {
  const code = getCurrencyCode(locale);
  return CURRENCY_SYMBOLS[code] ?? "$";
}

// Code-based symbol for an ORDER's stored currency (invoices / checkout / finance /
// admin). Explicit per currency so an amount never shows an ambiguous bare "$"
// (NT$ vs US$) or falls through to a raw "JPY " text prefix. Distinct from the
// locale-based getCurrencySymbol above (which is for rate-converted display pricing).
export function currencySymbol(code?: string | null): string {
  switch ((code || 'USD').toUpperCase()) {
    case 'TWD': return 'NT$';
    case 'USD': return 'US$';
    case 'CNY': return '¥';
    case 'JPY': return '¥';
    case 'KRW': return '₩';
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'HKD': return 'HK$';
    default: return `${(code || '').toUpperCase()} `;
  }
}

// "NT$12,000" — symbol + grouped amount, the format used across order surfaces.
export function formatMoney(code: string | null | undefined, amount: number): string {
  return `${currencySymbol(code)}${Number(amount || 0).toLocaleString()}`;
}

export function formatPrice(amount: number, locale: string): string {
  const currencyCode = getCurrencyCode(locale);
  const rate = EXCHANGE_RATES[currencyCode] ?? 1;
  const converted = Math.round(amount * rate);

  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return formatter.format(converted);
}
